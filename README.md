# CushLabs AI Voice Agent

Production-ready AI voice agents that qualify leads, book appointments, and handle customer conversations — 24/7, with sub-500ms response times.

**Live:** [voice.cushlabs.ai](https://voice.cushlabs.ai) | **Bilingual:** English + Spanish

---

## Live Agents

| Agent | Role | Industry | Voice | LLM | Page |
|-------|------|----------|-------|-----|------|
| **Clara** | Lead Qualification | AI Services | Cartesia | Claude Sonnet | [/](https://voice.cushlabs.ai) |
| **James** | Appointment Booking | Executive Coaching | Cartesia Nathan | Groq Llama 3.1 | [/nyc-coaching](https://voice.cushlabs.ai/nyc-coaching) |
| **Sophia** | AI Front Desk | Medical Spa | Cartesia Cindy | Claude Sonnet | [/medspa](https://voice.cushlabs.ai/medspa) |
| **Mike** | AI Dispatcher | Home Services | Cartesia Wyatt | Claude Sonnet | [/trades](https://voice.cushlabs.ai/trades) |
| **David** | Real Estate Setter | Real Estate | Cartesia | Claude Sonnet | [/realestate](https://voice.cushlabs.ai/realestate) |

Clara, James, Sophia, and Mike are **inbound** agents (click the mic button to talk). David is the first **outbound** agent — enter a phone number and he calls you via Twilio PSTN.

---

## Architecture

```
INBOUND (Clara, James, Sophia, Mike):
Browser (Vapi Web SDK)
    │
    ├── /api/config ─────► Express returns { publicKey, assistantId }
    │
    ├── Vapi Cloud ──────► Handles STT, LLM, TTS, call orchestration
    │       │
    │       └── /api/webhook ──► Express handles function calls:
    │               ├── check_availability    → Google Calendar FreeBusy
    │               ├── book_appointment      → Google Calendar + Meet link
    │               ├── qualify_lead          → Redis + Neon Postgres
    │               └── save_lead            → Redis + Neon Postgres
    │
    └── end-of-call-report ──► Transcript + summary saved to Postgres

OUTBOUND (David):
Browser → POST /api/outbound-call
    │
    ├── E.164 validation + rate limiting (30s/IP)
    │
    └── Vapi API (server-side) ──► Twilio PSTN call to prospect
            │
            └── /api/webhook ──► Express handles function calls:
                    ├── lookup_property      → Mock MLS data (6 NJ listings)
                    ├── qualify_buyer        → Redis + Neon Postgres
                    ├── check_tour_availability → Google Calendar FreeBusy
                    └── book_tour            → Google Calendar + Meet link
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Orchestration** | [Vapi](https://vapi.ai) — voice AI platform (Web SDK + webhooks) |
| **Backend** | Node.js + Express 5 |
| **Database** | Neon Postgres (leads, bookings, transcripts) |
| **Session State** | Redis (call-scoped data, 24h TTL) |
| **Calendar** | Google Calendar API (OAuth2 + FreeBusy + Meet links) |
| **Hosting** | [Render](https://render.com) with self-ping keep-alive |
| **Frontend** | Static HTML, Vapi Web SDK (ESM), client-side i18n |

---

## Project Structure

```
├── server.js                    # Express entry, routes, CORS, outbound endpoint, keep-alive
├── routes/webhook.js            # Vapi webhook handler (8 function calls)
├── services/
│   ├── calendar.js              # Google Calendar OAuth + FreeBusy + booking
│   ├── db.js                    # Neon Postgres (leads, bookings, auto-init)
│   └── redis.js                 # Redis client (session-scoped lead data)
├── data/
│   └── mock-mls.json            # 6 NJ property listings for real estate demo
├── public/
│   ├── index.html               # CushLabs landing page (Clara) — bilingual
│   ├── nyc-coaching.html        # Executive coaching page (James)
│   ├── medspa.html              # Med spa demo page (Sophia)
│   ├── trades.html              # Home services demo page (Mike) — bilingual
│   ├── realestate.html          # Real estate outbound demo (David) — bilingual
│   ├── portfolio.html           # Portfolio showcase (all 5 agents)
│   ├── contact.html             # Contact page with iframes — bilingual
│   └── consultation.html        # Consultation booking page
├── scripts/
│   ├── update-all-assistants.js # Batch-update Vapi assistant configs
│   ├── create-trades-assistant.js # Create Mike trades assistant
│   ├── create-realestate-assistant.js # Create David real estate assistant
│   ├── list-cartesia-voices.js  # Voice discovery utility
│   └── setup-medspa-assistant.js
├── docs/
│   ├── DEPLOYMENT.md            # Full deployment + infra documentation
│   ├── ARCHITECTURE.md          # System design + patterns
│   ├── realestate-system-prompt.md # David's system prompt
│   └── vapi-realestate-config.json # Vapi reference config for David
├── render.yaml                  # Render Blueprint (web + Redis)
└── package.json                 # pnpm, Node 18+
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm
- A [Vapi](https://vapi.ai) account with at least one assistant configured

### Local Development

```bash
# Clone and install
git clone https://github.com/RCushmaniii/cushlabs-ai-voice-agent.git
cd cushlabs-ai-voice-agent
pnpm install

# Configure environment
cp .env.example .env
# Fill in your Vapi keys and assistant IDs

# Run
pnpm dev
# → http://localhost:3000
```

### Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `VAPI_API_PUBLIC_KEY` | Yes | Vapi public key (sent to frontend) |
| `VAPI_API_PRIVATE_KEY` | Yes | Vapi private key (server-side API calls) |
| `VAPI_ASSISTANT_ID_CUSHLABS` | Yes | Clara assistant ID |
| `VAPI_ASSISTANT_ID_COACHING` | Yes | James assistant ID |
| `VAPI_ASSISTANT_ID_MEDSPA` | Yes | Sophia assistant ID |
| `VAPI_ASSISTANT_ID_TRADES` | Yes | Mike assistant ID |
| `VAPI_ASSISTANT_ID_REALESTATE` | Yes | David assistant ID |
| `VAPI_PHONE_NUMBER_ID` | Yes | Vapi phone number for outbound calls (Twilio) |
| `REDIS_URL` | Yes | Redis connection string |
| `DATABASE_URL` | Optional | Neon Postgres (leads + bookings persist) |
| `GOOGLE_CLIENT_ID` | Optional | Google Calendar real-time availability |
| `GOOGLE_CLIENT_SECRET` | Optional | Google OAuth |
| `GOOGLE_REFRESH_TOKEN` | Optional | Google OAuth refresh token |
| `CALENDAR_ID` | Optional | Google Calendar ID for FreeBusy |

---

## Features

### Bilingual (EN/ES)
The landing page and contact page support English and Spanish with a client-side language toggle. Language preference persists across pages via `localStorage`.

### Server Keep-Alive
Self-ping every 14 minutes prevents Render free-tier cold starts. Uses `RENDER_EXTERNAL_URL` in production, falls back to localhost in dev.

### Graceful Degradation
- **No Google creds?** Calendar returns default business hours (9-5 ET, weekdays)
- **No DATABASE_URL?** Leads still cached in Redis (24h TTL)
- **No Redis?** Server still serves pages and Vapi calls work (no lead persistence)

---

## Deployment

Deployed via [Render Blueprint](https://render.com/docs/infrastructure-as-code) — push to `main` triggers auto-deploy.

```
git push origin main → Render builds → pnpm install → node server.js
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for full infrastructure documentation.

---

## License

[ISC](LICENSE) — CushLabs AI Services
