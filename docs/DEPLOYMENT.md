# Deployment & Infrastructure

## Hosting: Render (Free Tier)

- **Live URL**: https://cushlabs-voice-agent.onrender.com
- **Platform**: [Render](https://render.com) — free web service + free Redis
- **Domain**: `cushlabs-voice-agent.onrender.com` (Render-assigned, not custom)
- **Deploy method**: Auto-deploy from GitHub on push to `main`
- **GitHub repo**: https://github.com/RCushmaniii/cushlabs-ai-voice-agent
- **Blueprint file**: `render.yaml` (defines services + env var declarations)

### How It Was Deployed

The app was deployed to Render via **Blueprint** (Infrastructure as Code) on **Feb 23, 2026**
in commit `ee6b80a`. Render reads `render.yaml` from the repo root and provisions:

1. **Web Service** (`cushlabs-voice-agent`) — Node.js, `pnpm install` → `node server.js`
2. **Redis** (`cushlabs-voice-redis`) — Free tier, `allkeys-lru` eviction, auto-connected via `REDIS_URL`

### Render Account Access

- **Sign in at**: https://dashboard.render.com
- **Auth method**: Likely GitHub OAuth (account `RCushmaniii`)
- If you don't see the service, try signing in with your GitHub account rather than email

### Known Free Tier Limitations

- **Cold starts**: ~50 seconds after 15 min idle (service spins down)
- **Redis**: 25 MB, no persistence guarantees, connections may drop
- **Upgrade path**: $7/mo "Starter" plan removes cold starts entirely

---

## Environment Variables

All secrets are stored as env vars in Render dashboard (never committed to git).

### Required on Render

| Variable | Purpose | Example |
|----------|---------|---------|
| `NODE_ENV` | Set to `production` | `production` |
| `VAPI_API_PUBLIC_KEY` | Vapi public key (sent to frontend) | `e6cb9059-...` |
| `VAPI_API_PRIVATE_KEY` | Vapi private key (server-side only, for API calls) | `eb3f8f64-...` |
| `VAPI_ASSISTANT_ID_CUSHLABS` | Clara assistant ID | `c9ca3aaf-...` |
| `VAPI_ASSISTANT_ID_COACHING` | James assistant ID | `71cadc36-...` |
| `VAPI_ASSISTANT_ID_MEDSPA` | Sophia assistant ID | `432d9f70-...` |
| `REDIS_URL` | Auto-injected by Render from Redis service | `redis://...` |

### Optional (Enable Features)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Neon Postgres connection string (permanent lead/booking storage) |
| `GOOGLE_CLIENT_ID` | Google OAuth — enables real calendar availability |
| `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `GOOGLE_REFRESH_TOKEN` | Google OAuth refresh token |
| `CALENDAR_ID` | Google Calendar ID for FreeBusy + event creation |
| `COACH_EMAIL` | Email for calendar invite attendee (default: `rcushmaniii@gmail.com`) |
| `GROQ_API_KEY` | Not used by server directly — Vapi uses it internally for James |
| `CARTESIA_API_KEY` | Not used by server directly — for voice setup scripts only |

### Local Development

Copy `.env.example` to `.env` and fill in values. Run with `pnpm dev` (uses `node --watch`).

---

## External Services

### Vapi (Voice AI Orchestration)

- **Dashboard**: https://dashboard.vapi.ai
- **Role**: Manages assistants, LLM routing, voice synthesis, call handling
- **Webhook URL**: `https://cushlabs-voice-agent.onrender.com/api/webhook`
- **How assistants work**: Created via Vapi dashboard or API. Each has its own LLM, voice, system prompt, and tool definitions. Our server only provides the assistant ID to the frontend; Vapi handles everything else.

| Assistant | Vapi ID | LLM | Voice |
|-----------|---------|-----|-------|
| Clara | `c9ca3aaf-9bc1-4277-b0d3-08c9d925e695` | Claude Sonnet (Anthropic) | Vapi Clara |
| James | `71cadc36-0f08-49f0-bca5-99199a5ed269` | Groq Llama 3.1 8B | Cartesia Nathan |
| Sophia | `432d9f70-1548-4532-9fb9-f030223bae2b` | Claude Sonnet (Anthropic) | Cartesia Cindy (Receptionist) |

### Neon Postgres (Database)

- **Dashboard**: https://console.neon.tech
- **Role**: Permanent storage for leads and bookings
- **Tables**: `leads`, `bookings` (auto-created on startup by `services/db.js`)
- **Status**: Requires `DATABASE_URL` env var on Render (graceful skip if not set)

### Google Calendar

- **Role**: Real-time availability (FreeBusy API) + event creation with Meet links
- **Calendar ID**: `9lg6pj8ht2blt3ob4v1rtddsts@group.calendar.google.com`
- **Auth**: OAuth2 refresh token flow (same creds as cushlabs booking system)
- **Fallback**: Returns default business hours (9-5 ET, weekdays) if creds not set

### Redis (Render)

- **Role**: Session-scoped lead data during active calls (24h TTL)
- **Provisioned by**: Render Blueprint (`render.yaml`)
- **Connection**: Auto-injected via `REDIS_URL` from Render service linking

---

## Routes & Pages

| Route | File | Description |
|-------|------|-------------|
| `/` | `public/index.html` | CushLabs main page — Clara (lead qualification) |
| `/nyc-coaching` | `public/nyc-coaching.html` | NYC Executive Coaching — James (appointment booking) |
| `/medspa` | `public/medspa.html` | Radiance Medical Spa — Sophia (front desk) |
| `/portfolio` | `public/portfolio.html` | Portfolio showcase — all demos + industry use cases |
| `/api/config?service=X` | `server.js` | Returns `{ publicKey, assistantId }` for frontend |
| `/api/webhook` | `routes/webhook.js` | Vapi webhook endpoint for function calls |
| `/api/health` | `server.js` | Health check (`{ status: 'ok' }`) |

---

## Build & Deploy Flow

```
git push origin main
    ↓
Render detects push (GitHub integration)
    ↓
Build: pnpm install
    ↓
Start: node server.js
    ↓
initDb() creates tables if DATABASE_URL is set
    ↓
Server listens on PORT (Render assigns this)
```

---

## Webhook Data Flow

```
Caller speaks → Vapi processes speech → LLM decides to call a tool
    ↓
Vapi POSTs to /api/webhook with function-call message
    ↓
Server handles: check_availability | book_appointment | qualify_lead | save_lead
    ↓
Response sent back to Vapi → LLM uses result to respond to caller
    ↓
Call ends → Vapi POSTs end-of-call-report
    ↓
Server stores transcript in Postgres, clears Redis session
```
