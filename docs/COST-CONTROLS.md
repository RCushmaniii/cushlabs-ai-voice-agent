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

> **Corrected 2026-08-07 against the vendor docs and the live dashboard.** Two of
> the four controls this section used to recommend do not exist. They were written
> on 2026-07-25 from assumption, not from the dashboard, and the giveaway was the
> hedged parenthetical — "Find **Spending Limit** (or **Monthly Budget**)" is what
> guessing at a UI looks like in prose. Both are documented below as unavailable
> rather than deleted, so nobody re-derives them and writes the same steps again.

### 1. Account spending limit — DOES NOT EXIST

**Vapi has no spending limit, monthly budget, or hard spend ceiling of any kind.**
Confirmed against https://docs.vapi.ai/billing/manage-billing-and-credits, which
lists exactly three billing controls: manual credit purchases (min $10), auto
reload, and payment method. There is no proactive cap, and no alert threshold.

The practical consequence is severe and drives everything below: **the credit
balance is the only aggregate spend ceiling that exists on this platform.** There
is no second line of defence behind it. See §4.

### 2. Per-assistant call duration

For **each** assistant (Clara / cushlabs, James / coaching, Sophia / medspa,
Mike / trades, David / realestate):

1. Left sidebar → **Assistants** → select the assistant
2. Open the **Advanced** (or **Settings**) tab
3. **Maximum Duration** — set to `600` seconds (10 min). Demo conversations do
   not legitimately run longer; without this a stuck call bills indefinitely.
4. **Silence Timeout** — set to `30` seconds so abandoned sessions end
5. Click **Publish** / **Save** on that assistant before moving to the next

### 3. Concurrency — CANNOT BE LOWERED

Every Vapi account includes **10 concurrent call slots** and concurrency can only
be bought _upward_ (Reserved concurrency, +$10/mo per line). There is no setting
to cap it below the included 10. The old instruction here — "Max Concurrent Calls
— set to a small number (e.g. 5)" — describes a control that is not offered.

10 is therefore a floor, not a dial, and it is an input to the worst case rather
than a lever against it: 10 lines × 6 calls/hour × $0.84 = **~$50/hour**.

### 4. Credit balance is the ONLY aggregate ceiling (PAYG)

The org is on **Pay-as-you-go**. Because §1 does not exist, whatever sits in
**Credit Balance** is the entire worst case for runaway spend — _and only while
auto reload is off_.

**Auto reload is the switch that deletes the last ceiling.** It tops up a fixed
amount whenever the balance falls to a threshold, with no documented cap on how
many times it can fire. Turning it on converts a bounded loss into an open-ended
one billed to the card in small increments.

**Decision rule — one input:**

| Is there a paying client whose live call must not drop? | Auto reload                                                                             |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| No (state as of 2026-08-07 — no clients)                | **OFF.** Balance is a hard ceiling; worst case is the balance.                          |
| Yes                                                     | ON, accepting there is NO backstop behind it. Compensate with monitoring, not settings. |

Verified 2026-08-07 from the billing dashboard: auto reload **ON**, $10 reload at a
$5 threshold, one credit purchase in the account's life ($10 on 2026-07-25). It has
therefore never actually fired — lifetime spend is $0.21 — so this is a live
exposure that has never been exercised, not an active leak.

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
  Setting it to `0` now genuinely means zero — see Tuning below.

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

`OUTBOUND_CALLS_PER_DAY=0` **is honoured** and means zero calls per day — every
request gets a `429`, including the first. Fixed 2026-08-06.

> **History, kept deliberately.** Until 2026-08-06 this document said the opposite,
> and it was right to: `server.js:257` read
> `Number(process.env.OUTBOUND_CALLS_PER_DAY) || 50`, and because `Number("0")` is
> falsy the documented shutoff silently restored the ceiling of **50** — the rate it
> was already running at. That instruction was written in two repos and carried
> through three sessions without ever being executed. The parse now goes through
> `intFromEnv` in `services/rate-limit.js`, which treats `0` as a real value, and
> five regression tests cover it — one of which asserts the old broken expression
> so the trap stays visible in the test output.
>
> **The stronger kill switch is still unsetting `VAPI_PHONE_NUMBER_ID`**, as described
> above, and that is what is in force on the box today. It short-circuits at the
> `503` before any Vapi request is built, rather than relying on a counter.
