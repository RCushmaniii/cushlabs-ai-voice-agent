const test = require("node:test");
const assert = require("node:assert");
const express = require("express");

// Exercise the in-process fallback deliberately. Production runs the Redis path
// (Upstash verified working on the box 2026-07-25), but the fallback is what
// carries the service through an Upstash outage, so it is the path most worth
// pinning down with tests — an untested degradation path is a silent one.
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

const { perIpLimiter, globalBudget } = require("../services/rate-limit");

/** Boot a throwaway app on an ephemeral port and return {url, close}. */
function serve(routes) {
  const app = express();
  routes(app);
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      resolve({
        url: `http://127.0.0.1:${server.address().port}`,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

const codes = async (url, n) => {
  const out = [];
  for (let i = 0; i < n; i++) out.push((await fetch(url)).status);
  return out;
};

test("perIpLimiter throttles a single IP without Redis", async () => {
  const { url, close } = await serve((app) =>
    app.get(
      "/",
      perIpLimiter({ name: "t-ip", windowSec: 60, max: 2 }),
      (_q, r) => r.json({ ok: true }),
    ),
  );
  const got = await codes(url + "/", 5);
  await close();

  // The limiter this replaced was an in-memory Map. Losing per-IP protection
  // when Redis is absent would be a regression, so assert it explicitly.
  assert.strictEqual(got.filter((c) => c === 200).length, 2, `got ${got}`);
  assert.ok(got.includes(429), `expected a 429 in ${got}`);
});

test("globalBudget cannot be bypassed by rotating IPs", async () => {
  // The real attack on a spending endpoint: IPs are cheap, so a per-IP limit
  // alone does not bound the bill. The global counter must hold regardless.
  const { url, close } = await serve((app) =>
    app.get(
      "/",
      globalBudget({ name: "t-budget", windowSec: 60, max: 3 }),
      (_q, r) => r.json({ ok: true }),
    ),
  );

  const got = [];
  for (let i = 0; i < 6; i++) {
    const res = await fetch(url + "/", {
      headers: { "x-forwarded-for": `10.0.0.${i}` }, // a new IP every request
    });
    got.push(res.status);
  }
  await close();

  assert.strictEqual(got.filter((c) => c === 200).length, 3, `got ${got}`);
  assert.strictEqual(got.filter((c) => c === 429).length, 3, `got ${got}`);
});

test("globalBudget degrades without 503-ing the demo", async () => {
  // Redis absence is an infrastructure fault, not a reason to take a
  // client-facing demo offline. Requests under budget must still succeed.
  const { url, close } = await serve((app) =>
    app.get(
      "/",
      globalBudget({ name: "t-no503", windowSec: 60, max: 5 }),
      (_q, r) => r.json({ ok: true }),
    ),
  );
  const got = await codes(url + "/", 3);
  await close();

  assert.deepStrictEqual(got, [200, 200, 200]);
});

test("blocked responses advertise Retry-After", async () => {
  const { url, close } = await serve((app) =>
    app.get(
      "/",
      globalBudget({ name: "t-hdr", windowSec: 42, max: 1 }),
      (_q, r) => r.json({ ok: true }),
    ),
  );
  await fetch(url + "/");
  const res = await fetch(url + "/");
  await close();

  assert.strictEqual(res.status, 429);
  assert.strictEqual(res.headers.get("retry-after"), "42");
});

test("budget window rollover releases capacity", async () => {
  const { url, close } = await serve((app) =>
    app.get(
      "/",
      globalBudget({ name: "t-roll", windowSec: 1, max: 1 }),
      (_q, r) => r.json({ ok: true }),
    ),
  );

  assert.strictEqual((await fetch(url + "/")).status, 200);
  assert.strictEqual((await fetch(url + "/")).status, 429);
  await new Promise((r) => setTimeout(r, 1100));
  assert.strictEqual((await fetch(url + "/")).status, 200);

  await close();
});
