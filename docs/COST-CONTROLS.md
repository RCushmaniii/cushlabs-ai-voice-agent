# Cost Controls

Every agent on this service spends real money per call — telephony (Twilio),
LLM tokens, STT, and TTS. This document records what bounds that spend, what it
does **not** bound, and the dashboard settings that are the actual backstop.

---

## What the code controls

Implemented in `services/rate-limit.js`, wired in `server.js`.

| Endpoint | Guard | Limit | What it stops |
|---|---|---|---|
| `POST /api/outbound-call` | `perIpLimiter` | 1 per 30s per IP | Casual hammering from one client |
| `POST /api/outbound-call` | `globalBudget` | **50 per day, all callers** (`OUTBOUND_CALLS_PER_DAY`) | IP rotation — the real attack |
| `POST /api/contact` | `perIpLimiter` | 5 per 15 min per IP | Contact-form spam |
| `GET /api/config` | `perIpLimiter` | 30 per min per IP | Scripted enumeration of assistant IDs |

**Why a global budget and not just per-IP:** IP addresses are cheap to rotate.
A per-IP limit on a spending endpoint gives the *appearance* of protection while
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

### ⚠️ Open item: Redis may not be configured in production

`render.yaml` provisions a Render Redis service and injects **`REDIS_URL`** (a
TCP connection string). But `services/redis.js` and `services/rate-limit.js`
both read **`UPSTASH_REDIS_REST_URL`** and **`UPSTASH_REDIS_REST_TOKEN`**, which
`render.yaml` never sets.

If those two vars were not added manually in the Render dashboard, then in
production today:

- rate limits run on the in-process fallback (works, but per-instance), **and**
- `services/redis.js` lead-session caching is silently failing.

This could not be verified from the CLI — the available `RENDER_API_KEY` returned
no services. **Confirm in the Render dashboard** (steps below) before assuming
either component is healthy.

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

### 4. Verify the Redis wiring while you are in dashboards

Open https://dashboard.render.com → service **cushlabs-voice-agent** →
**Environment** tab, and check whether these two keys exist:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

- **If both present:** Redis-backed limits and lead caching are working. Nothing
  to do.
- **If absent:** either add them (from the Upstash console) so limits become
  durable and shared, or migrate `services/redis.js` and `services/rate-limit.js`
  to the TCP `REDIS_URL` that `render.yaml` already provides. Do not leave the
  two halves disagreeing — that is the current state and it fails silently.

---

## Tuning

`OUTBOUND_CALLS_PER_DAY` (default `50`) sets the global daily ceiling on outbound
PSTN calls. Raise it for a demo push; lower it if the number ever looks abused.
Budget exhaustion logs `GLOBAL BUDGET REACHED` and returns `429` with a
`Retry-After` header.
