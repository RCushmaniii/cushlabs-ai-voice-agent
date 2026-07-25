/**
 * Durable rate limiting backed by Upstash Redis.
 *
 * Replaces the in-process Map limiter, which had three problems on Render:
 *   1. It reset on every deploy and every free-plan spin-down.
 *   2. It could not be shared if the service ever scales past one instance.
 *   3. Per-IP limits alone do not stop abuse — rotating IPs is trivial, and
 *      /api/outbound-call spends real money (Twilio PSTN + Vapi + LLM + TTS).
 *
 * So this module provides two distinct controls:
 *
 *   perIpLimiter()   — courtesy throttle. Stops casual hammering from one client.
 *   globalBudget()   — the control that actually protects the wallet. A hard
 *                      ceiling on total actions per window across ALL callers,
 *                      which no amount of IP rotation can bypass.
 *
 * Fixed-window counters via INCR + EXPIRE. Fixed windows allow a burst at a
 * window boundary (up to 2x the limit across the seam); that is acceptable here
 * because the global budget is sized well below the spend level we care about.
 *
 * Failure policy:
 *   - perIpLimiter degrades to no-op if Redis is unavailable. It guards
 *     convenience, and a Redis blip should not take the demo offline.
 *   - globalBudget degrades to an IN-PROCESS global counter. It never returns
 *     503 for infrastructure reasons.
 *
 * Why not fail closed on the budget? Fail-closed is the textbook answer for a
 * spending gate, but it could only be justified by confirming Redis is actually
 * configured in production — and that could NOT be verified: render.yaml
 * provisions a Render Redis and injects REDIS_URL (TCP), while services/redis.js
 * reads the UPSTASH_REDIS_REST_URL / _TOKEN pair, which render.yaml never sets.
 * If those Upstash vars are absent on the live service, a fail-closed gate would
 * 503 every outbound call on a client-facing demo.
 *
 * The in-process fallback is strictly better than what it replaces (an in-memory
 * PER-IP map, which IP rotation walks straight through) because the fallback
 * counter is GLOBAL — it still bounds total spend per window on that instance,
 * which is the actual attack. Render free plan runs a single instance, so in
 * practice the fallback is close to a true global cap. Every degraded decision
 * is logged loudly so the gap is visible rather than silent.
 *
 * TODO: once UPSTASH_REDIS_REST_URL / _TOKEN are confirmed present on the Render
 * service, revisit whether globalBudget should fail closed.
 */

const { Redis } = require("@upstash/redis");

const configured = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
);

const redis = configured
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

if (!configured) {
  console.warn(
    "[rate-limit] UPSTASH_REDIS_REST_URL / _TOKEN not set. Falling back to " +
      "in-process counters: limits still apply but are per-instance and reset " +
      "on restart. Set both vars for durable, shared limits.",
  );
}

/**
 * In-process global fallback counters, used only when Redis is unavailable.
 * Keyed by budget name; each entry holds the window's start time and count.
 * Global (not per-IP) on purpose — IP rotation must not reset it.
 */
const memoryBudgets = new Map();

function bumpMemory(name, windowSec, now = Date.now()) {
  const windowMs = windowSec * 1000;
  const entry = memoryBudgets.get(name);
  if (!entry || now - entry.start >= windowMs) {
    memoryBudgets.set(name, { start: now, count: 1 });
    return 1;
  }
  entry.count += 1;
  return entry.count;
}

/**
 * In-process PER-IP fallback, so removing the old Map limiter never leaves us
 * weaker than before when Redis is unavailable. Same fixed-window shape, keyed
 * by name + IP. Swept periodically so it cannot grow without bound.
 */
const memoryIps = new Map();

function bumpMemoryIp(name, ip, windowSec, now = Date.now()) {
  const windowMs = windowSec * 1000;
  const key = `${name}:${ip}`;
  const entry = memoryIps.get(key);
  if (!entry || now - entry.start >= windowMs) {
    memoryIps.set(key, { start: now, count: 1, windowMs });
    return 1;
  }
  entry.count += 1;
  return entry.count;
}

// Evict expired per-IP entries so an IP flood cannot grow the map forever.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryIps) {
    if (now - entry.start >= entry.windowMs) memoryIps.delete(key);
  }
}, 60_000).unref();

/** Client IP, honouring Render's proxy. Falls back to the socket address. */
function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0)
    return fwd.split(",")[0].trim();
  return req.ip || req.socket?.remoteAddress || "unknown";
}

/**
 * Increment a fixed-window counter and return its current value.
 * Sets the TTL only on first increment so the window does not slide forever.
 */
async function bump(key, windowSec) {
  const n = await redis.incr(key);
  if (n === 1) await redis.expire(key, windowSec);
  return n;
}

/**
 * Per-IP Express middleware.
 *
 * Prefers Redis (durable, shared). Without it, falls back to an in-process
 * per-IP window — the same protection the old Map limiter gave — so this is
 * never weaker than the code it replaced.
 *
 * @param {object}  opts
 * @param {string}  opts.name       Namespace, e.g. "contact"
 * @param {number}  opts.windowSec  Window length in seconds
 * @param {number}  opts.max        Max requests per IP per window
 */
function perIpLimiter({ name, windowSec, max }) {
  const tooMany = (res) => {
    res.set("Retry-After", String(windowSec));
    return res.status(429).json({
      error: "Too many requests. Please try again later.",
    });
  };

  return async (req, res, next) => {
    const ip = clientIp(req);

    if (!redis) {
      const n = bumpMemoryIp(name, ip, windowSec);
      if (n > max) return tooMany(res);
      return next();
    }

    try {
      const n = await bump(`rl:${name}:${ip}`, windowSec);
      if (n > max) return tooMany(res);
      return next();
    } catch (err) {
      console.error(
        `[rate-limit] per-IP check failed for ${name} (${err.message}); ` +
          "using in-process fallback.",
      );
      const n = bumpMemoryIp(name, ip, windowSec);
      if (n > max) return tooMany(res);
      return next();
    }
  };
}

/**
 * Global spend ceiling across ALL callers.
 *
 * Use on any endpoint that costs money. Per-IP limits cannot protect spend
 * because IPs are cheap to rotate; this cap is the real backstop.
 *
 * Degrades to an in-process global counter rather than 503-ing a client-facing
 * demo — see the failure-policy note at the top of this file.
 *
 * @param {object}  opts
 * @param {string}  opts.name       Namespace, e.g. "outbound-call"
 * @param {number}  opts.windowSec  Window length in seconds (e.g. 86400 = daily)
 * @param {number}  opts.max        Max total actions per window, all callers
 */
function globalBudget({ name, windowSec, max }) {
  const overBudget = (res, n, degraded) => {
    console.warn(
      `[rate-limit] GLOBAL BUDGET REACHED for ${name}: ${n}/${max} in a ` +
        `${windowSec}s window${degraded ? " (in-process fallback)" : ""}. ` +
        "Refusing further spend.",
    );
    res.set("Retry-After", String(windowSec));
    return res.status(429).json({
      error:
        "This demo has reached its usage limit for now. Please try again later.",
    });
  };

  return async (req, res, next) => {
    // No Redis configured — bound spend with the in-process global counter.
    if (!redis) {
      const n = bumpMemory(name, windowSec);
      if (n > max) return overBudget(res, n, true);
      return next();
    }

    const key = `budget:${name}:${Math.floor(Date.now() / (windowSec * 1000))}`;
    try {
      const n = await bump(key, windowSec);
      if (n > max) return overBudget(res, n, false);
      if (n === Math.floor(max * 0.8)) {
        console.warn(`[rate-limit] ${name} at 80% of budget (${n}/${max}).`);
      }
      return next();
    } catch (err) {
      // Redis unreachable mid-flight. Do not 503 a client-facing demo for an
      // infrastructure fault — degrade to the in-process global counter, which
      // still bounds spend on this instance, and make the degradation loud.
      console.error(
        `[rate-limit] ${name}: Redis budget check failed (${err.message}). ` +
          "Falling back to in-process counter — spend bounded per instance only.",
      );
      const n = bumpMemory(name, windowSec);
      if (n > max) return overBudget(res, n, true);
      return next();
    }
  };
}

module.exports = {
  perIpLimiter,
  globalBudget,
  clientIp,
  redisConfigured: configured,
};
