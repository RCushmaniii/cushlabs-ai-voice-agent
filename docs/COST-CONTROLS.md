# Cost Controls

Every agent on this service spends real money per call — telephony (Twilio),
LLM tokens, STT, and TTS. This document records what bounds that spend, what it
does **not** bound, and the dashboard settings that are the actual backstop.

---

## What the code controls

Implemented in `services/rate-limit.js`, wired in `server.js`.

| Endpoint                  | Guard          | Limit                                                  | What it stops                         |
| ------------------------- | -------------- | ------------------------------------------------------ | ------------------------------------- |
| `POST /api/outbound-call` | `perIpLimiter` | 1 per 30s per IP                                       | Casual hammering from one client      |
| `POST /api/outbound-call` | `globalBudget` | **50 per day, all callers** (`OUTBOUND_CALLS_PER_DAY`) | IP rotation — the real attack         |
| `POST /api/contact`       | `perIpLimiter` | 5 per 15 min per IP                                    | Contact-form spam                     |
| `GET /api/config`         | `perIpLimiter` | 30 per min per IP                                      | Scripted enumeration of assistant IDs |

**Why a global budget and not just per-IP:** IP addresses are cheap to rotate.
A per-IP limit on a spending endpoint gives the _appearance_ of protection while
leaving the bill unbounded. The global counter is the control that actually caps
the day's spend, and it is the one to tune if the demo needs more headroom.

### Storage and degradation

Limits prefer Upstash Redis (durable, shared across instances). If Redis is
unavailable, both guards fall back to **in-process counters** — limits still
apply, but per instance and reset on restart. The fallback logs loudly.

The budget deliberately does **not** fail closed. Fail-closed is the textbook
choice for a spending gate, but it would 503 a client-facing demo whenever Redis
hiccups, and — see the open item below — Redis may not be wired in production at
all. The in-process fallback is strictly stronger than the per-IP Map it
replaced, because the fallback counter is global.

### Redis in production — VERIFIED WORKING (2026-07-25)

Checked directly against the running container, not inferred:

```
UPSTASH_REDIS_REST_URL     present
UPSTASH_REDIS_REST_TOKEN   present
VAPI_WEBHOOK_SECRET        present
Upstash round-trip         WORKING   (set → get → del inside voice-agent)
```

So rate limits run on **durable, shared Redis**, not the in-process fallback,
and `services/redis.js` lead caching is healthy.

> **Do not trust `render.yaml` in this repo — it is a dead artifact.** The whole
> stack was migrated off Render to a self-hosted Hetzner VPS in **March 2026**
> (see `cushlabs-prod-server`). Reasoning from `render.yaml` produced a false
> conclusion that Redis was misconfigured. `REDIS_URL` still appears in the
> container env as a leftover and is unused. Verify against the box, never
> against `render.yaml`.

---

## What the code does NOT control

**Inbound web calls (Clara, James, Sophia, Mike) are not rate-limited by this
service, and cannot be.** The browser talks to Vapi Cloud directly using
`VAPI_API_PUBLIC_KEY`, which the Vapi Web SDK requires in the page. It is a
public key by design, not a leaked secret. Anyone who opens the page can read it
and start calls without ever touching our server again, so throttling
`/api/config` slows enumeration but does not bound inbound spend.

**The only real controls for inbound spend live in the Vapi dashboard.**

---

## Vapi dashboard settings (do these — they are the actual backstop)

Open https://dashboard.vapi.ai

### 1. Account spending limit

1. Left sidebar → **Settings** → **Billing**
2. Find **Spending Limit** (or **Monthly Budget**)
3. Set a hard monthly cap you are willing to lose in the worst case
4. Set **Alert threshold** to ~50% so warning arrives with room to react
5. Confirm the alert email is one that is actually read
6. Click **Save**

### 2. Per-assistant call duration

For **each** assistant (Clara / cushlabs, James / coaching, Sophia / medspa,
Mike / trades, David / realestate):

1. Left sidebar → **Assistants** → select the assistant
2. Open the **Advanced** (or **Settings**) tab
3. **Maximum Duration** — set to `600` seconds (10 min). Demo conversations do
   not legitimately run longer; without this a stuck call bills indefinitely.
4. **Silence Timeout** — set to `30` seconds so abandoned sessions end
5. Click **Publish** / **Save** on that assistant before moving to the next

### 3. Concurrency

1. Left sidebar → **Settings** → **Account** (or **Org**)
2. **Max Concurrent Calls** — set to a small number (e.g. `5`). This is what
   converts a scripted flood into a queue instead of a bill.
3. Click **Save**

### 4. Credit balance is itself a ceiling (PAYG)

The Vapi org is on **Pay-as-you-go**. Whatever sits in **Credit Balance** is the
practical worst case for runaway spend — _provided auto-recharge is off_. Check
**Settings → Billing → Payment method**: if auto-recharge/auto-top-up is
enabled, that ceiling disappears and the spending limit in step 1 becomes the
only backstop.

---

## Deployment (not Render)

The stack runs on a **Hetzner CPX21 VPS** (`178.156.192.117`), Docker Compose
behind Caddy. Orchestration lives in the **`cushlabs-prod-server`** repo.

- Push to `main` → GitHub Actions (`.github/workflows/build-image.yml`) builds
  and pushes `ghcr.io/rcushmaniii/cushlabs-ai-voice-agent:latest`.
- The box **does not auto-pull** — there is no Watchtower. Deploy is manual:

```
ssh deploy@178.156.192.117
cd ~/apps/cushlabs-prod-server
docker compose pull voice-agent && docker compose up -d voice-agent
```

- Env lives in `~/apps/cushlabs-prod-server/.env.voice-agent` on the box, **not**
  in any dashboard. `OUTBOUND_CALLS_PER_DAY` is absent there, so the 50/day
  default applies; add it to that file and re-up the container to change it.

---

## Outbound PSTN calling is currently DISABLED

**As of 2026-08-06, by owner decision.** `VAPI_PHONE_NUMBER_ID` is commented out in
`.env.voice-agent` on the box, so `POST /api/outbound-call` returns `503 Outbound
calling is not configured` at `server.js:272` — before any Vapi or Twilio request
is made. Verified live: the route answered `400` (invalid number, i.e. configured)
before the change and `503` after.

Nothing else is affected. `VAPI_PHONE_NUMBER_ID` is read in exactly one runtime
place (`server.js:269`). The five browser voice demos, all other assistants, and
the other five compose services were re-checked after the restart and are
unaffected.

**To re-enable:**

```
ssh deploy@178.156.192.117
python3 /home/deploy/toggle_outbound.py enable
cd ~/apps/cushlabs-prod-server && docker compose up -d --wait voice-agent
```

That helper reports counts and filenames only and never prints a value. It backs
the env file up before every change. `toggle_outbound.py check` is read-only.

---

## Tuning

`OUTBOUND_CALLS_PER_DAY` (default `50`) sets the global daily ceiling on outbound
PSTN calls. Raise it for a demo push. Budget exhaustion logs
`GLOBAL BUDGET REACHED` and returns `429` with a `Retry-After` header.

> **`OUTBOUND_CALLS_PER_DAY=0` does NOT disable outbound calling.** `server.js:257`
> is `Number(process.env.OUTBOUND_CALLS_PER_DAY) || 50`. `Number("0")` is `0`,
> which is falsy, so `|| 50` fires and the ceiling lands back on **50** — the
> default it was already at. Setting it to zero reports success and changes
> nothing. This is a known bug, tracked in `docs/SESSION_LOG.md` Open Items. Until
> it is fixed, the only working kill switch is removing `VAPI_PHONE_NUMBER_ID`
> as described above.
