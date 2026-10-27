# CLAUDE.md — CushLabs AI Voice Agent

## Why this matters before you change anything

Answers the phone for client businesses.

**If this breaks:** Calls go unanswered or are answered badly, in real time, out loud, to a caller who is deciding whether to buy. There is no draft stage here -- what it says is said.

Its risk class and revenue proximity are recorded in `operating-system/portfolio/repo-metadata.json`, and are read from there rather than restated here -- the same rule that governs prices, client facts and platform approvals.
<!-- capability-registry-pointer -->
## Platform approvals — read the registry, never restate it

**Canonical source:** `C:/Users/Robert Cushman/Projects/operating-system/cushlabs/capability-registry.json`

This repo does **not** record platform approval status in prose. Anything here that states whether
Meta, Google, or any other platform has approved something is a **bug** — it will drift, and it has,
four separate times in one week. Ask the registry instead:

```powershell
node "C:/Users/Robert Cushman/Projects/operating-system/scripts/validate-capability-registry.mjs"
```

**What this repo depends on:**

- No platform approval gates this repo today. It ships on the Ultra tier; if that changes, the approval is recorded centrally, not here.

**The distinction that keeps causing errors:** `status: approved` and `reachable_by: any_client` are
different facts. An approval can be granted and still unusable by a paying client. Only
`reachable_by: any_client` makes a capability sellable.

Deep-dive how-to docs in this repo stay where they are — the registry owns *state*, not procedure.

---

## Project Overview

Production AI voice agent platform for lead qualification, appointment booking, and customer conversations. Powered by Vapi (voice infrastructure), Claude (AI), and Google Calendar (scheduling). Express 5 backend with Neon Postgres for persistence and Redis for session caching.

## Tech Stack

- Node.js 22 (Alpine in Docker, runs as the unprivileged `node` user, uid 1000)
- Express 5
- Vapi — voice agent infrastructure (webhook-driven)
- Anthropic Claude — conversational AI
- Google Calendar API — appointment scheduling
- Neon Postgres — persistent storage
- Upstash Redis (REST) — session cache, 24 h TTL per call
- pnpm — package manager

## Project Structure

```
cushlabs-ai-voice-agent/
├── server.js               # Express app entry point
├── routes/
│   └── webhook.js          # Vapi webhook handlers
├── services/
│   ├── calendar.js         # Google Calendar integration
│   ├── db.js               # Neon Postgres client
│   └── redis.js            # Upstash Redis session cache (REST)
├── data/                   # Static data files
├── scripts/                # Utility scripts
├── docs/                   # Documentation
├── Dockerfile              # Node 22 Alpine, pnpm, USER node (non-root)
├── vapi-config.json        # Vapi assistant configuration
└── package.json
```

## Development Commands

```powershell
# Install dependencies
pnpm install

# Run dev server (auto-restart on changes)
pnpm dev

# Run production
pnpm start
```

## Key Patterns & Conventions

- **Webhook-driven:** Vapi sends events to `/webhook` — the app processes and responds
- **Session caching:** Upstash Redis (REST) stores lead data per call with a 24 h TTL
- **External databases:** Neon Postgres is remote (connection string in env), not self-hosted
- **Stateless app layer:** App can be restarted without losing data (Redis is a cache, Postgres is persistent)

## Environment Variables

See `.env` on VPS at `~/apps/cushlabs-prod-server/.env.voice-agent`. Key vars include:
- Vapi API credentials
- Anthropic API key
- Google Calendar OAuth credentials
- Neon Postgres connection string
- Upstash Redis REST URL + token

## Production Deployment — Hetzner VPS

- **Hosted on:** Hetzner VPS (cushlabs-prod-01) via Docker
- **Host:** `178.156.192.117`
- **SSH:** `ssh deploy@178.156.192.117`
- **URL:** https://voice.cushlabs.ai
- **VPS path:** none — the box holds no checkout of this repo (removed 2026-10-26); it runs the GHCR image only
- **Orchestration:** `~/apps/cushlabs-prod-server/docker-compose.yml`
- **Domain:** `voice.cushlabs.ai` (HTTPS via Caddy/Let's Encrypt)
- **Internal port:** 3000 (behind Caddy reverse proxy, bound to `127.0.0.1`)
- **Redis:** Upstash (REST, external) via `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`; there is no Redis container on the box
- **Database:** Neon Postgres (external, connection string in env)
- **Health check:** `GET /healthz`

### Deploy

```bash
ssh deploy@178.156.192.117 'cd ~/apps/cushlabs-prod-server && git pull && docker compose pull voice-agent && docker compose up -d voice-agent'
```

The box never builds: CI pushes `ghcr.io/rcushmaniii/cushlabs-ai-voice-agent:latest` from main, and the compose service pulls it (verified on the box 2026-10-12, `cushlabs-prod-server/docker-compose.yml`). Wait for the main `build-image` run before deploying. Config-only changes (env vars) just need `docker compose restart voice-agent`. Roll back by re-tagging a previous image as `:latest` and running `docker compose up -d voice-agent` without pulling.

### Logs

```bash
ssh deploy@178.156.192.117 'docker logs -f voice-agent'
```

### Vitals

Add to HTML pages:
```html
<script src="https://vitals.cushlabs.ai/tracker.js" data-site="voice" defer></script>
```

## Known Issues

- Redis is a cache only — if Upstash is unreachable, in-flight lead data for a call is lost but nothing persistent is affected
- Google Calendar OAuth tokens need periodic refresh


## Session Log

A running log of all working sessions is maintained at `docs/SESSION_LOG.md`.
Always append a new entry at the top of this file before closing a session.
Use the `session-logger` skill to generate the entry.

---

<!-- BEGIN operating-system-sync -->

## Canonical data this repo does not own

> Generated by `operating-system/scripts/sync-stamp.mjs`. Do not hand-edit — the revisions
> are content hashes and a hand-typed one silently defeats the drift check.
>
> **These files are the truth. This repo must never restate their contents as prose.**
> A doc here asserting a price, a client count, a trial length or an approval status is a bug,
> even when it happens to be correct today. Link to the file instead.

| Canonical file | Owns | Reconciled at |
| --- | --- | --- |
| `operating-system/cushlabs/operating-vision.json` | How the business is run - the operations vision, the six operating principles, and the precedence order that settles conflicts between them. | `eea191dbd2c5` |
| `operating-system/cushlabs/capability-registry.json` | Every platform approval, entitlement and quota, and whether a client can actually reach it. **(internal — never quote to a client)** | `70a576351068` |
| `operating-system/cushlabs/tech-standard.json` | The sanctioned technology lanes, the gate a new technology must pass, and the baseline every deployed repo must meet. | `913dded097dc` |

If a revision above no longer matches what `operating-system` holds, this repo is reading a
stale assumption. Re-read the file before acting on anything it covers. To check:

```powershell
node scripts/sync-check.mjs
```

(run from `operating-system`)

<!-- END operating-system-sync -->
