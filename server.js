require("dotenv").config();
const Sentry = require("@sentry/node");

// Initialize Sentry before anything else
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || "development",
  tracesSampleRate: 0.2,
});

const express = require("express");
const cors = require("cors");
const compression = require("compression");
const path = require("path");
const webhookRouter = require("./routes/webhook");
const { initDb } = require("./services/db");
const { validateEnv } = require("./services/env");
const { perIpLimiter, globalBudget } = require("./services/rate-limit");

// Fail fast if critical env vars are missing
validateEnv();

const app = express();
const PORT = process.env.PORT || 3000;

// --- Security Headers ---
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
  );
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), geolocation=()");
  res.setHeader("X-XSS-Protection", "0"); // Disabled per modern best practice (CSP preferred)
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      // Vapi's Web SDK runs on Daily.co's WebRTC stack. Daily's call-object mode evaluates its
      // fetched call-machine bundle via eval() → 'unsafe-eval' is required (Vapi doesn't expose
      // Daily's avoidEval option). blob: for worker bundles, *.daily.co for hosted assets.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://cdn.jsdelivr.net https://vitals.cushlabs.ai https://*.daily.co",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob:",
      // Per Daily's CSP guide: *.daily.co = signaling/assets, *.pluot.blue = media/TURN relays,
      // broad wss: = TURN-over-WebSocket relays on dynamic hosts (else calls time out at join).
      // *.sentry.io = Vapi/Daily telemetry; cdn.jsdelivr.net = SDK sourcemap fetches.
      "connect-src 'self' https://*.vapi.ai https://*.daily.co https://*.pluot.blue https://*.sentry.io https://cdn.jsdelivr.net https://formspree.io https://vitals.cushlabs.ai wss:",
      "media-src 'self' blob: https://*.daily.co https://*.pluot.blue",
      "worker-src 'self' blob:", // Daily spawns audio-processing workers from blob URLs
      "frame-src 'none'",
    ].join("; "),
  );
  next();
});

// --- Gzip Compression ---
app.use(compression());

// CORS — restrict to production domain + local dev
const allowedOrigins = ["https://voice.cushlabs.ai", "http://localhost:3000"];
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow server-to-server requests (no origin, e.g. Vapi webhooks) + allowed origins
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
  }),
);

// Body parser with size limit (100KB — webhooks can include transcripts)
app.use(express.json({ limit: "100kb" }));

// Serve static frontend files.
// Filenames are NOT content-hashed, so long-caching HTML/CSS/JS would serve
// stale code (e.g. the voice widget) for a day after every deploy. Images and
// fonts are safe to cache hard; everything else uses no-cache so the browser
// revalidates via ETag on each load (fast 304 when unchanged, fresh on deploy).
app.use(
  express.static(path.join(__dirname, "public"), {
    etag: true,
    setHeaders: (res, filePath) => {
      if (/\.(png|jpg|jpeg|webp|svg|ico|woff2?|ttf|eot)$/i.test(filePath)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      } else {
        // HTML, CSS, JS — must revalidate so deploys are picked up immediately.
        res.setHeader("Cache-Control", "no-cache");
      }
    },
  }),
);

// Health check endpoints — /healthz for Render's health check path, /api/health for internal use
app.get("/healthz", (req, res) => {
  res.status(200).send("OK");
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "cushlabs-ai-voice-agent" });
});

// Serve public Vapi config to frontend (only public key + assistant ID, never private key)
const assistants = {
  cushlabs: process.env.VAPI_ASSISTANT_ID_CUSHLABS,
  coaching: process.env.VAPI_ASSISTANT_ID_COACHING,
  medspa: process.env.VAPI_ASSISTANT_ID_MEDSPA,
  trades: process.env.VAPI_ASSISTANT_ID_TRADES,
  realestate: process.env.VAPI_ASSISTANT_ID_REALESTATE,
};

// Mexican-Professional-Spanish (es-MX) assistant variants. Falls back to the
// English assistant for any service without a Spanish counterpart.
const assistantsEs = {
  cushlabs: process.env.VAPI_ASSISTANT_ID_CUSHLABS_ES,
  coaching: process.env.VAPI_ASSISTANT_ID_COACHING_ES,
  medspa: process.env.VAPI_ASSISTANT_ID_MEDSPA_ES,
  trades: process.env.VAPI_ASSISTANT_ID_TRADES_ES,
};

// Throttled to slow scripted enumeration of assistant IDs.
//
// NOTE ON WHAT THIS DOES AND DOES NOT PROTECT: VAPI_API_PUBLIC_KEY is a
// browser-side key by design — the Vapi Web SDK needs it in the page, so it is
// not a secret and rate-limiting this route does not stop someone who has
// already read it from starting calls. The controls that actually bound inbound
// spend live in the Vapi dashboard (spending limit, max concurrent calls,
// per-assistant max call duration). See docs/COST-CONTROLS.md.
const configLimiter = perIpLimiter({
  name: "config",
  windowSec: 60,
  max: 30,
});

app.get("/api/config", configLimiter, (req, res) => {
  const service = assistants[req.query.service]
    ? req.query.service
    : "cushlabs";
  const lang = req.query.lang === "es" ? "es" : "en";
  const assistantId =
    (lang === "es" && assistantsEs[service]) || assistants[service];
  res.json({
    publicKey: process.env.VAPI_API_PUBLIC_KEY,
    assistantId,
    lang,
  });
});

// Serve NYC Coaching page
app.get("/nyc-coaching", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "nyc-coaching.html"));
});

// Serve Med Spa demo page
app.get("/medspa", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "medspa.html"));
});

// Serve Portfolio page
app.get("/portfolio", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "portfolio.html"));
});

// Serve Contact page
app.get("/contact", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "contact.html"));
});

// Serve Consultation / Book a Call page
app.get("/consultation", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "consultation.html"));
});

// Serve Trades demo page
app.get("/trades", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "trades.html"));
});

// Serve Real Estate demo page
app.get("/realestate", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "realestate.html"));
});

// Rate limit: 5 contact form submissions per 15 min per IP.
// Redis-backed so it survives deploys and free-plan spin-downs; see
// services/rate-limit.js for the fail-open / fail-closed split.
const contactLimiter = perIpLimiter({
  name: "contact",
  windowSec: 15 * 60,
  max: 5,
});

// Contact form endpoint
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
app.post("/api/contact", contactLimiter, async (req, res) => {
  const { name, email, phone, message } = req.body;
  if (!name || !email || !message) {
    return res
      .status(400)
      .json({ error: "Name, email, and message are required." });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "Invalid email address." });
  }
  // Truncate inputs to reasonable lengths
  const safeName = String(name).slice(0, 200);
  const safeEmail = String(email).slice(0, 254);
  const safePhone = phone ? String(phone).slice(0, 30) : null;
  const safeMessage = String(message).slice(0, 5000);

  try {
    if (process.env.DATABASE_URL) {
      const { neon } = require("@neondatabase/serverless");
      const sql = neon(process.env.DATABASE_URL);
      await sql`
                INSERT INTO contact_messages (name, email, phone, message)
                VALUES (${safeName}, ${safeEmail}, ${safePhone}, ${safeMessage})
            `;
    }
    console.log(
      `[Contact] Message from ${safeName} <${safeEmail}>: ${safeMessage.substring(0, 100)}`,
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("[Contact] Failed to save message:", err.message);
    res.json({ ok: true }); // Still return success — message is logged
  }
});

// --- Outbound Call Endpoint (Real Estate) ---
// This endpoint SPENDS MONEY: it places a Twilio PSTN call through Vapi, which
// bills telephony + LLM + TTS per call. Two layers guard it:
//
//   outboundLimiter — 1 call per 30s per IP. Courtesy throttle only; an attacker
//                     rotating IPs walks straight through it.
//   outboundBudget  — hard ceiling of 50 calls/day across ALL callers. This is
//                     the control that actually bounds the bill, and it fails
//                     CLOSED: if Redis cannot confirm we are under budget, the
//                     call is refused rather than placed.
//
// Tune OUTBOUND_CALLS_PER_DAY in the environment if the demo needs more room.
const outboundLimiter = perIpLimiter({
  name: "outbound-call",
  windowSec: 30,
  max: 1,
});

const outboundBudget = globalBudget({
  name: "outbound-call",
  windowSec: 86400,
  max: Number(process.env.OUTBOUND_CALLS_PER_DAY) || 50,
});

app.post(
  "/api/outbound-call",
  outboundLimiter,
  outboundBudget,
  async (req, res) => {
    const { phoneNumber, propertyId } = req.body;

    // Validate env vars
    const vapiKey = process.env.VAPI_API_PRIVATE_KEY;
    const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;
    const assistantId = process.env.VAPI_ASSISTANT_ID_REALESTATE;

    if (!vapiKey || !phoneNumberId || !assistantId) {
      return res.status(503).json({
        error:
          "Outbound calling is not configured. Missing VAPI_API_PRIVATE_KEY, VAPI_PHONE_NUMBER_ID, or VAPI_ASSISTANT_ID_REALESTATE.",
      });
    }

    // Validate phone number (E.164 US format)
    if (!phoneNumber || !/^\+1\d{10}$/.test(phoneNumber)) {
      return res.status(400).json({
        error: "Invalid phone number. Must be US E.164 format: +1XXXXXXXXXX",
      });
    }

    try {
      const callBody = {
        phoneNumberId,
        assistantId,
        customer: { number: phoneNumber },
        metadata: { source: "realestate-demo", propertyId: propertyId || null },
      };

      console.log(`[Outbound] Initiating call to ${phoneNumber}`, {
        propertyId,
      });

      const vapiRes = await fetch("https://api.vapi.ai/call", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${vapiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(callBody),
      });

      const data = await vapiRes.json();

      if (!vapiRes.ok) {
        console.error("[Outbound] Vapi API error:", JSON.stringify(data));
        return res.status(vapiRes.status >= 500 ? 502 : 400).json({
          error: data.message || "Failed to initiate outbound call.",
        });
      }

      console.log(`[Outbound] Call initiated: ${data.id} → ${phoneNumber}`);
      return res.json({ callId: data.id, status: data.status || "queued" });
    } catch (err) {
      console.error("[Outbound] Error:", err.message);
      return res
        .status(500)
        .json({ error: "Internal server error initiating call." });
    }
  },
);

// Vapi webhook endpoint
app.use("/api/webhook", webhookRouter);

// Sentry error handler — must be after all routes/middleware
Sentry.setupExpressErrorHandler(app);

app.listen(PORT, async () => {
  console.log(`CushLabs AI Voice Agent backend running on port ${PORT}`);
  console.log(`Webhook URL: http://localhost:${PORT}/api/webhook`);
  console.log(`Frontend: http://localhost:${PORT}`);
  await initDb();
});
