# Repo Purpose & Ecosystem Map

> **You are here:** `cushlabs-ai-voice-agent` — the **voice line**. The only CushLabs surface
> where a customer _speaks_ and gets spoken to in real time, and the only one where an
> anonymous visitor can spend real money by the second. Live at `voice.cushlabs.ai`.

_Last verified: 2026-08-07 — sibling repo roles cross-checked against the live `Projects/`
tree and the running `docker-compose.yml` on the Hetzner box._

## Read this before the platform-state question

This file describes **roles and relationships** — what each repo is for and how they connect.
It deliberately records **no** platform approval state. Whether Meta, Google, or anyone else has
approved something lives in exactly one place:

`C:/Users/Robert Cushman/Projects/operating-system/cushlabs/capability-registry.json`

```powershell
node "C:/Users/Robert Cushman/Projects/operating-system/scripts/validate-capability-registry.mjs"
```

Approval status written into prose has drifted four separate times in one week. If you find a
sentence in this file that states an approval, it is a bug — delete it and ask the registry.

## What this repo is

**cushlabs-ai-voice-agent** is the CushLabs voice agent platform: an Express server that gives
Vapi somewhere to call. Vapi owns the telephony and the audio pipeline; this repo owns the
_business logic_ Vapi invokes mid-conversation — calendar availability, booking, lead capture,
transcript persistence — plus the public demo pages that let a prospect talk to an agent in
their browser.

- **Stack:** Node 20 (Alpine) · Express 5 · Vapi (Web SDK + webhooks) · Anthropic Claude ·
  Google Calendar (OAuth2, FreeBusy, Meet links) · Neon Postgres · Upstash Redis over REST ·
  pnpm
- **Runtime:** Docker Compose on the Hetzner box (`178.156.192.117`) behind Caddy. Image is
  built in GitHub Actions and pushed to GHCR; the box pulls a prebuilt image rather than
  building on-box. **Not Vercel, not Render** — Render was left on 2026-07-25 and every
  artifact naming it is stale.
- **Surfaces:** five browser voice demos (`cushlabs`, `coaching`, `medspa`, `trades`,
  `realestate`), four with es-MX counterparts, plus one outbound PSTN endpoint.

### The constraint that makes this repo different

Every other CushLabs conversational repo costs money per _message_, cheaply, on a channel where
the sender is identified. This one costs money per _second of audio_, to an anonymous visitor,
on a public page.

The Vapi Web SDK requires a browser-side public key to exist in the page. That is by design and
cannot be hidden. It means **server-side rate limiting cannot protect spend on the demo path** —
an abuser talks to Vapi directly, never touching this server. `server.js` says so at the
`/api/config` handler; believe it.

Read **[`docs/COST-CONTROLS.md`](./COST-CONTROLS.md) before changing anything that can place or
accept a call.** It records which controls are real (per-assistant duration caps; the credit
balance) and which two this repo once documented but do not exist on the platform at all.

## Where it sits — the CushLabs conversational surfaces

Three product lines, three modalities, same clients and the same es-MX Mexican-market focus.
They share no code. They are siblings by business, not by dependency.

| Repo                                 | Modality                           | Role                                                                            |
| ------------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------- |
| **cushlabs-ai-voice-agent** _(here)_ | **Voice** — spoken, real-time      | Vapi agents for lead qualification, booking and FAQs; five public browser demos |
| **cushlabs-messenger-bot**           | **Text** — Facebook Messenger      | Multi-tenant Worker at `messenger.cushlabs.ai`, per-tenant prompts + RAG        |
| **cushlabs-messenger**               | — (intake)                         | Client onboarding survey that configures the Messenger runtime                  |
| **cushlabs-whatsapp**                | **Text** — WhatsApp, single tenant | NY English class reminders on CushLabs' own WABA. Runs the business             |
| **cushlabs-connect**                 | **Text** — WhatsApp, multi-tenant  | Tech Provider evolution of the above; clients bring their own WABAs. Sells it   |

**This table is deliberately not the Messenger family's table.** `cushlabs-messenger-bot`,
`cushlabs-messenger` and `cushlabs-marketsignal` share one identical ecosystem table across
three repos; `cushlabs-whatsapp` maps the Meta/WhatsApp line instead. This file maps the
conversational surfaces from the voice end. **Do not sync them** — the same mistake the
WhatsApp doc calls out.

### What this repo is not

- **Not multi-tenant.** Assistants are enumerated from environment variables in `server.js`;
  there is no tenant table, no per-client routing, no KV of prompts. The five demos are
  CushLabs' own showcase agents, not client deployments.
- **Probably not the place to add a client dashboard.** The white-glove-not-self-serve boundary
  was decided 2026-04-23 **for the Messenger product**, and no equivalent ruling has been made
  here — this is an inference from the same reasoning, not a recorded decision. Treat it as a
  reason to ask before building ops UI, not as settled law.
- **Not fed by `cushlabs-messenger`.** The survey → digest → RAG pipeline belongs to the
  Messenger platform. Voice agent prompts are authored directly (`docs/realestate-system-prompt.md`,
  `vapi-config.json`) and pushed to Vapi.

## The Hetzner box — who owns what

This repo is one of several services sharing a single VPS. **The division of labor is strict:**

| Concern                                                     | Repo                     |
| ----------------------------------------------------------- | ------------------------ |
| Application code, Dockerfile, routes, business logic        | **this repo**            |
| `docker-compose.yml`, `Caddyfile`, env files, TLS, the host | **cushlabs-prod-server** |

Co-tenants on the same box and compose file: `resume-tailor`, `webscraper`, `unwatermark`,
`marketsignal`, `vitals`, `cushlabs`. **A change to compose or Caddy is a change to all of
them** — it does not belong in a voice-agent PR. Deploy from here is
`docker compose pull voice-agent && docker compose up -d voice-agent`, run in that repo's
directory.

## Relationships to the rest of the estate

- **cushlabs** (portfolio / marketing site) — where this work is sold. This repo's
  `PORTFOLIO.md` is the entry that surfaces there. A capability described there as live
  must actually be live; outbound PSTN is currently switched off and `PORTFOLIO.md` says so.
- **operating-system** — owns the capability registry (above) and
  `strategy/accomplished.json`, which feeds `dashboard.cushlabs.ai`. Never restate approval
  state here.
- **ny-eng** — the NY English site. Historically it tracked voice-agent open items inside its
  own `docs/HANDOFF.md`, where nobody working on voice would look. Those items were moved to
  this repo's Open Items register on 2026-08-06. **Voice-agent work is tracked here now.** If
  you find voice items accumulating in another repo's handoff doc again, that is the bug.
- **cushlabs-OS-dashboard** — reads `accomplished.json` live from GitHub. Nothing to do here
  beyond logging accomplishments in the canonical file.

## Keeping this doc honest

- **Open Items live in [`docs/SESSION_LOG.md`](./SESSION_LOG.md)**, pinned above the dated
  entries. That register is the state; this file is the map. An item leaves it only when
  verified end to end against the real system.
- **Cost and spend controls live in [`docs/COST-CONTROLS.md`](./COST-CONTROLS.md)**, and that
  file now marks two non-existent Vapi controls as unavailable rather than deleting them, so
  the same wrong steps do not get re-derived. Same discipline applies to anything added here.
- **`docs/DEPLOYMENT.md` still describes the Render deployment in its body.** It carries a
  historical banner, so it is a labelled record rather than a live claim. Tracked in Open Items.
- When a repo is renamed, re-homed, or a relationship changes, update this file the same day —
  same standing as a CLAUDE.md correction.
