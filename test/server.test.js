const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");

// Set env vars before requiring any app modules
process.env.VAPI_API_PUBLIC_KEY = "test-public-key";
process.env.VAPI_API_PRIVATE_KEY = "test-private-key";
process.env.VAPI_ASSISTANT_ID_CUSHLABS = "test-cushlabs-id";
process.env.VAPI_ASSISTANT_ID_COACHING = "test-coaching-id";
process.env.VAPI_ASSISTANT_ID_MEDSPA = "test-medspa-id";
process.env.VAPI_ASSISTANT_ID_TRADES = "test-trades-id";
process.env.VAPI_ASSISTANT_ID_REALESTATE = "test-realestate-id";
process.env.DATABASE_URL = "postgresql://fake:fake@localhost/fake";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.VAPI_WEBHOOK_SECRET = "test-webhook-secret";
process.env.SENTRY_DSN = "";
process.env.NODE_ENV = "test";

// Pre-populate require cache with mock modules before anything imports them
const servicesDir = path.join(__dirname, "..", "services");

require.cache[require.resolve(path.join(servicesDir, "redis.js"))] = {
  id: require.resolve(path.join(servicesDir, "redis.js")),
  filename: require.resolve(path.join(servicesDir, "redis.js")),
  loaded: true,
  exports: {
    getRedisClient: async () => ({}),
    storeLeadData: async () => {},
    getLeadData: async () => null,
    deleteLeadData: async () => {},
  },
};

require.cache[require.resolve(path.join(servicesDir, "db.js"))] = {
  id: require.resolve(path.join(servicesDir, "db.js")),
  filename: require.resolve(path.join(servicesDir, "db.js")),
  loaded: true,
  exports: {
    initDb: async () => {},
    saveLead: async () => ({ id: 1 }),
    saveBooking: async () => ({ id: 1 }),
    updateLeadWithCallData: async () => {},
  },
};

require.cache[require.resolve(path.join(servicesDir, "calendar.js"))] = {
  id: require.resolve(path.join(servicesDir, "calendar.js")),
  filename: require.resolve(path.join(servicesDir, "calendar.js")),
  loaded: true,
  exports: {
    getAvailableSlots: async () => [
      {
        dayLabel: "Monday, April 7",
        date: "2026-04-07",
        times: ["10:00 AM", "2:00 PM"],
      },
    ],
    bookAppointment: async () => ({
      success: true,
      friendlyTime: "Monday, April 7, 10:00 AM",
      meetLink: "https://meet.google.com/test",
      eventId: "test-event-id",
    }),
  },
};

// Now require the webhook router (it will get mocked redis/db/calendar)
const express = require("express");
const cors = require("cors");
const compression = require("compression");
const webhookRouter = require("../routes/webhook");

// Helper to make HTTP requests
function request(server, method, urlPath, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const opts = {
      hostname: "127.0.0.1",
      port: addr.port,
      path: urlPath,
      method,
      headers: { "Content-Type": "application/json", ...headers },
    };

    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let parsed = data;
        try {
          parsed = JSON.parse(data);
        } catch {}
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });

    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

describe("Server", () => {
  let server;

  before(async () => {
    const app = express();

    // Security headers (mirrors server.js)
    app.use((req, res, next) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-Frame-Options", "DENY");
      res.setHeader(
        "Strict-Transport-Security",
        "max-age=63072000; includeSubDomains; preload",
      );
      res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
      res.setHeader("Permissions-Policy", "camera=(), geolocation=()");
      res.setHeader("X-XSS-Protection", "0");
      res.setHeader(
        "Content-Security-Policy",
        [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' blob: https://cdn.jsdelivr.net https://vitals.cushlabs.ai https://*.daily.co",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' https://fonts.gstatic.com",
          "img-src 'self' data: blob:",
          "connect-src 'self' https://*.vapi.ai wss://*.vapi.ai https://*.daily.co wss://*.daily.co https://*.sentry.io https://cdn.jsdelivr.net https://formspree.io https://vitals.cushlabs.ai",
          "media-src 'self' blob: https://*.daily.co",
          "worker-src 'self' blob:",
          "frame-src 'none'",
        ].join("; "),
      );
      next();
    });

    app.use(compression());
    app.use(cors());
    app.use(express.json({ limit: "100kb" }));

    app.get("/healthz", (req, res) => res.status(200).send("OK"));
    app.get("/api/health", (req, res) =>
      res.json({ status: "ok", service: "cushlabs-ai-voice-agent" }),
    );

    const assistants = {
      cushlabs: process.env.VAPI_ASSISTANT_ID_CUSHLABS,
      coaching: process.env.VAPI_ASSISTANT_ID_COACHING,
      medspa: process.env.VAPI_ASSISTANT_ID_MEDSPA,
      trades: process.env.VAPI_ASSISTANT_ID_TRADES,
      realestate: process.env.VAPI_ASSISTANT_ID_REALESTATE,
    };
    app.get("/api/config", (req, res) => {
      const service = req.query.service || "cushlabs";
      const assistantId = assistants[service] || assistants.cushlabs;
      res.json({ publicKey: process.env.VAPI_API_PUBLIC_KEY, assistantId });
    });

    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    app.post("/api/contact", async (req, res) => {
      const { name, email, phone, message } = req.body;
      if (!name || !email || !message) {
        return res
          .status(400)
          .json({ error: "Name, email, and message are required." });
      }
      if (!EMAIL_RE.test(email)) {
        return res.status(400).json({ error: "Invalid email address." });
      }
      res.json({ ok: true });
    });

    app.use("/api/webhook", webhookRouter);

    await new Promise((resolve) => {
      server = app.listen(0, "127.0.0.1", resolve);
    });
  });

  after(() => {
    server?.close();
  });

  // --- Health Endpoints ---
  describe("Health endpoints", () => {
    it("GET /healthz returns 200 OK", async () => {
      const res = await request(server, "GET", "/healthz");
      assert.equal(res.status, 200);
      assert.equal(res.body, "OK");
    });

    it("GET /api/health returns JSON status", async () => {
      const res = await request(server, "GET", "/api/health");
      assert.equal(res.status, 200);
      assert.equal(res.body.status, "ok");
      assert.equal(res.body.service, "cushlabs-ai-voice-agent");
    });
  });

  // --- Security Headers ---
  describe("Security headers", () => {
    it("returns all security headers", async () => {
      const res = await request(server, "GET", "/healthz");
      assert.equal(res.headers["x-content-type-options"], "nosniff");
      assert.equal(res.headers["x-frame-options"], "DENY");
      assert.ok(
        res.headers["strict-transport-security"].includes("max-age=63072000"),
      );
      assert.equal(
        res.headers["referrer-policy"],
        "strict-origin-when-cross-origin",
      );
      assert.ok(
        res.headers["content-security-policy"].includes("default-src 'self'"),
      );
      assert.ok(
        res.headers["content-security-policy"].includes("cdn.jsdelivr.net"),
      );
      assert.ok(
        res.headers["content-security-policy"].includes("fonts.googleapis.com"),
      );
      assert.ok(
        res.headers["content-security-policy"].includes("vitals.cushlabs.ai"),
      );
      // Vapi rides on Daily.co WebRTC — connect-src must allow it or voice calls silently fail.
      assert.ok(
        res.headers["content-security-policy"].includes("wss://*.daily.co"),
      );
    });
  });

  // --- Config Endpoint ---
  describe("GET /api/config", () => {
    it("returns default cushlabs assistant", async () => {
      const res = await request(server, "GET", "/api/config");
      assert.equal(res.status, 200);
      assert.equal(res.body.publicKey, "test-public-key");
      assert.equal(res.body.assistantId, "test-cushlabs-id");
    });

    it("returns service-specific assistant", async () => {
      const res = await request(server, "GET", "/api/config?service=medspa");
      assert.equal(res.body.assistantId, "test-medspa-id");
    });

    it("falls back to cushlabs for unknown service", async () => {
      const res = await request(
        server,
        "GET",
        "/api/config?service=nonexistent",
      );
      assert.equal(res.body.assistantId, "test-cushlabs-id");
    });
  });

  // --- Contact Form ---
  describe("POST /api/contact", () => {
    it("accepts valid submission", async () => {
      const res = await request(server, "POST", "/api/contact", {
        name: "Test User",
        email: "test@example.com",
        message: "Hello",
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.ok, true);
    });

    it("rejects missing fields", async () => {
      const res = await request(server, "POST", "/api/contact", {
        name: "Test",
      });
      assert.equal(res.status, 400);
      assert.ok(res.body.error.includes("required"));
    });

    it("rejects invalid email", async () => {
      const res = await request(server, "POST", "/api/contact", {
        name: "Test",
        email: "bad",
        message: "Hello",
      });
      assert.equal(res.status, 400);
      assert.ok(res.body.error.includes("email"));
    });
  });

  // --- Webhook Auth ---
  describe("Webhook authentication", () => {
    it("rejects unauthenticated requests", async () => {
      const res = await request(server, "POST", "/api/webhook", {
        message: { type: "status-update", status: "in-progress" },
      });
      assert.equal(res.status, 401);
    });

    it("accepts Bearer token", async () => {
      const res = await request(
        server,
        "POST",
        "/api/webhook",
        {
          message: { type: "status-update", status: "in-progress" },
        },
        { Authorization: "Bearer test-webhook-secret" },
      );
      assert.equal(res.status, 200);
    });

    it("accepts legacy x-vapi-secret header", async () => {
      const res = await request(
        server,
        "POST",
        "/api/webhook",
        {
          message: { type: "status-update", status: "in-progress" },
        },
        { "x-vapi-secret": "test-webhook-secret" },
      );
      assert.equal(res.status, 200);
    });

    it("rejects wrong secret", async () => {
      const res = await request(
        server,
        "POST",
        "/api/webhook",
        {
          message: { type: "status-update", status: "in-progress" },
        },
        { Authorization: "Bearer wrong" },
      );
      assert.equal(res.status, 401);
    });
  });

  // --- Webhook Event Routing ---
  describe("Webhook events", () => {
    const AUTH = { Authorization: "Bearer test-webhook-secret" };

    it("rejects missing message", async () => {
      const res = await request(server, "POST", "/api/webhook", {}, AUTH);
      assert.equal(res.status, 400);
    });

    it("handles status-update", async () => {
      const res = await request(
        server,
        "POST",
        "/api/webhook",
        {
          message: { type: "status-update", status: "in-progress" },
        },
        AUTH,
      );
      assert.equal(res.status, 200);
    });

    it("handles transcript", async () => {
      const res = await request(
        server,
        "POST",
        "/api/webhook",
        {
          message: { type: "transcript", role: "user", transcript: "Hello" },
        },
        AUTH,
      );
      assert.equal(res.status, 200);
    });

    it("handles unknown event type", async () => {
      const res = await request(
        server,
        "POST",
        "/api/webhook",
        {
          message: { type: "future-event" },
        },
        AUTH,
      );
      assert.equal(res.status, 200);
    });

    it("handles check_availability", async () => {
      const res = await request(
        server,
        "POST",
        "/api/webhook",
        {
          message: {
            type: "function-call",
            call: { id: "call-1" },
            functionCall: {
              id: "fc-1",
              name: "check_availability",
              parameters: {},
            },
          },
        },
        AUTH,
      );
      assert.equal(res.status, 200);
      assert.ok(res.body.results[0].result.includes("available slots"));
    });

    it("handles book_appointment — missing params", async () => {
      const res = await request(
        server,
        "POST",
        "/api/webhook",
        {
          message: {
            type: "function-call",
            call: { id: "call-2" },
            functionCall: {
              id: "fc-2",
              name: "book_appointment",
              parameters: { caller_name: "Test" },
            },
          },
        },
        AUTH,
      );
      assert.equal(res.status, 200);
      assert.ok(res.body.results[0].result.includes("need"));
    });

    it("handles book_appointment — full params", async () => {
      const res = await request(
        server,
        "POST",
        "/api/webhook",
        {
          message: {
            type: "function-call",
            call: { id: "call-3" },
            functionCall: {
              id: "fc-3",
              name: "book_appointment",
              parameters: {
                caller_name: "Jane",
                caller_email: "j@test.com",
                date_time: "2026-04-07T10:00:00-06:00",
              },
            },
          },
        },
        AUTH,
      );
      assert.equal(res.status, 200);
      assert.ok(res.body.results[0].result.includes("booked"));
    });

    it("handles qualify_lead", async () => {
      const res = await request(
        server,
        "POST",
        "/api/webhook",
        {
          message: {
            type: "function-call",
            call: { id: "call-4" },
            functionCall: {
              id: "fc-4",
              name: "qualify_lead",
              parameters: {
                user_name: "John",
                business_type: "Plumbing",
                ai_interest: "Scheduling",
              },
            },
          },
        },
        AUTH,
      );
      assert.equal(res.status, 200);
      assert.ok(res.body.results[0].result.includes("saved"));
    });

    it("handles lookup_property — found", async () => {
      const mockMLS = require("../data/mock-mls.json");
      const res = await request(
        server,
        "POST",
        "/api/webhook",
        {
          message: {
            type: "function-call",
            call: { id: "call-5" },
            functionCall: {
              id: "fc-5",
              name: "lookup_property",
              parameters: { propertyId: mockMLS[0].id },
            },
          },
        },
        AUTH,
      );
      assert.equal(res.status, 200);
      assert.ok(res.body.results[0].result.includes(mockMLS[0].address));
    });

    it("handles lookup_property — not found", async () => {
      const res = await request(
        server,
        "POST",
        "/api/webhook",
        {
          message: {
            type: "function-call",
            call: { id: "call-6" },
            functionCall: {
              id: "fc-6",
              name: "lookup_property",
              parameters: { propertyId: "FAKE" },
            },
          },
        },
        AUTH,
      );
      assert.equal(res.status, 200);
      assert.ok(res.body.results[0].result.includes("could not find"));
    });

    it("handles end-of-call-report", async () => {
      const res = await request(
        server,
        "POST",
        "/api/webhook",
        {
          message: {
            type: "end-of-call-report",
            call: { id: "call-7" },
            transcript: "Hi. Hello!",
            summary: "Brief call.",
            endedReason: "hangup",
          },
        },
        AUTH,
      );
      assert.equal(res.status, 200);
    });

    it("handles unknown function call", async () => {
      const res = await request(
        server,
        "POST",
        "/api/webhook",
        {
          message: {
            type: "function-call",
            call: { id: "call-8" },
            functionCall: {
              id: "fc-8",
              name: "future_function",
              parameters: {},
            },
          },
        },
        AUTH,
      );
      assert.equal(res.status, 200);
      assert.ok(res.body.results[0].result.includes("acknowledged"));
    });
  });
});
