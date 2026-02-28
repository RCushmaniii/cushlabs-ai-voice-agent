# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                      FRONTEND                            │
│  index.html / nyc-coaching.html / medspa.html           │
│  portfolio.html                                          │
│                                                          │
│  Vapi Web SDK (ESM) ←→ /api/config?service=X            │
│  Browser mic/speaker ←→ Vapi Cloud (WebRTC)             │
└─────────────────────────────────────────────────────────┘
                          │
                    WebRTC Audio
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    VAPI CLOUD                            │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  Clara    │  │  James   │  │  Sophia  │              │
│  │  Sonnet   │  │  Groq    │  │  Sonnet  │              │
│  │  Vapi     │  │  Nathan  │  │  Cindy   │              │
│  │  Clara    │  │  Voice   │  │  Voice   │              │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       │              │              │                    │
│       └──────────────┼──────────────┘                    │
│                      │ Function Calls                    │
└──────────────────────┼──────────────────────────────────┘
                       │
                POST /api/webhook
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                 OUR SERVER (Render)                       │
│                                                          │
│  server.js ──→ routes/webhook.js                         │
│                    │                                     │
│         ┌──────────┼──────────────┐                      │
│         ▼          ▼              ▼                      │
│  services/     services/     services/                   │
│  redis.js      calendar.js   db.js                      │
│  (session)     (Google Cal)  (Neon PG)                   │
│                                                          │
└─────────────────────────────────────────────────────────┘
         │              │              │
         ▼              ▼              ▼
    ┌─────────┐  ┌───────────┐  ┌──────────┐
    │  Redis  │  │  Google   │  │   Neon   │
    │ (Render)│  │ Calendar  │  │ Postgres │
    │ Session │  │   API     │  │  (Perm)  │
    └─────────┘  └───────────┘  └──────────┘
```

## File Structure

```
cushlabs-ai-voice-agent/
├── server.js                      # Express entry point, routes, config endpoint
├── package.json                   # pnpm, Node.js deps
├── pnpm-lock.yaml
├── render.yaml                    # Render Blueprint (web + Redis)
├── vapi-config.json               # Reference Vapi config (Phase 1 docs)
├── .env                           # Local secrets (git-ignored)
├── .env.example                   # Template for local setup
├── .gitignore
│
├── public/                        # Static frontend (served by Express)
│   ├── index.html                 # CushLabs — Clara (orange, #FF6A3D)
│   ├── nyc-coaching.html          # NYC Coaching — James (gold, #C9A84C)
│   ├── medspa.html                # Med Spa — Sophia (rose gold, #C4956A)
│   ├── portfolio.html             # Portfolio showcase page
│   └── images/
│       └── voice_agent_logo.png
│
├── routes/
│   └── webhook.js                 # Vapi webhook handler (all function calls)
│
├── services/
│   ├── redis.js                   # Redis client — session lead data (24h TTL)
│   ├── calendar.js                # Google Calendar — FreeBusy + event creation
│   └── db.js                      # Neon Postgres — permanent leads + bookings
│
├── scripts/
│   └── setup-medspa-assistant.js  # Creates Sophia assistant via Vapi API
│
└── docs/
    ├── DEPLOYMENT.md              # Deployment, env vars, external services
    ├── ARCHITECTURE.md            # This file
    ├── medspa-system-prompt.md    # Sophia system prompt reference
    ├── medspa-demo-build-checklist.md  # Build priorities + demo script
    └── vapi-medspa-config.json    # Vapi assistant config reference
```

## Key Patterns

### Multi-Assistant Routing

Each page fetches its config from `/api/config?service=<name>`:
```
Frontend: fetch("/api/config?service=medspa")
Server:   returns { publicKey, assistantId } from env vars
Frontend: new Vapi(publicKey) → vapi.start(assistantId)
```

Assistants map:
```js
const assistants = {
    cushlabs: process.env.VAPI_ASSISTANT_ID_CUSHLABS,
    coaching: process.env.VAPI_ASSISTANT_ID_COACHING,
    medspa:   process.env.VAPI_ASSISTANT_ID_MEDSPA,
};
```

### Vapi SDK ESM Quirk

The Vapi Web SDK requires a double-default unwrap when loaded as ESM:
```js
import VapiModule from "https://cdn.jsdelivr.net/npm/@vapi-ai/web@latest/+esm";
const Vapi = VapiModule.default || VapiModule;
```

### Webhook Response Format

All function-call responses must use this exact structure:
```json
{
    "results": [{
        "toolCallId": "<functionCall.id>",
        "result": "Message that the LLM will use to respond to the caller"
    }]
}
```

### Data Flow: Session → Permanent

1. **During call**: Lead data stored in Redis (fast, session-scoped, 24h TTL)
2. **During call**: Also written to Neon Postgres (permanent, for CRM/analytics)
3. **End of call**: Transcript + summary written to Postgres, Redis cleared

### Graceful Degradation

Every external service has a fallback:
- **Google Calendar down** → Returns default business hours (9-5 ET weekdays)
- **DATABASE_URL not set** → Skips Neon, logs to console only
- **Redis down** → Logs error, call still works (lead data not cached)
- **Neon write fails** → Logs error, Redis data still available

### Page Theming

All pages share the same design system with per-page accent colors:

| Page | Accent | Aurora Opacity | Button Style |
|------|--------|---------------|--------------|
| CushLabs | `#FF6A3D` (orange) | 0.12, 3 orbs | Solid fill + glow |
| Coaching | `#C9A84C` (gold) | 0.08, 2 orbs | Outline, fill on hover |
| Med Spa | `#C4956A` (rose gold) | 0.08, 2 orbs | Outline, fill on hover |
| Portfolio | `#FF6A3D` (orange) | 0.08, 3 orbs | N/A (no voice button) |

Shared: Space Grotesk (headings) + Source Serif 4 (body), dark bg, aurora orbs,
breathing ring animation, `prefers-reduced-motion` support.
