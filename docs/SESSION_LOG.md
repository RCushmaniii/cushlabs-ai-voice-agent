# Session Log — cushlabs-ai-voice-agent

Entries are newest-first. Each entry documents one Claude Code working session.
**Open Items** is a standing register pinned above them — read it first.

---

## Open Items

Standing register, scoped to this repo. **An item leaves this list only when it
has been verified end to end against the real system.** "Tests pass" and "the
config looks right" are not verification.

Opened 2026-08-06. These arrived from `ny-eng/docs/HANDOFF.md`, which had been
tracking voice-agent work inside the website repo where nobody would think to look
for it. Verified against this codebase and the live box on arrival.

---

- [ ] **`docs/DEPLOYMENT.md` still describes the Render deployment in its body.**
      _Blocks: nothing operationally; it is labelled, not silently wrong._ The file
      carries a historical banner at the top, so it reads as a record. Lower priority
      than the README was, but it is the last Render artifact in the repo.
      _Closes when:_ the body is rewritten for Hetzner + Docker Compose + GHCR, or the
      file is explicitly retitled as a historical record.

---

_Closed 2026-08-07: auto reload turned OFF by Robert. **The credit balance is now the spend
ceiling, and on Vapi it is the only one that exists** — no spending limit, no monthly budget,
and concurrency cannot be lowered below 10. Worst case is therefore the remaining balance,
about $9.79, instead of ~$50/hour billed to the card indefinitely._

_Recorded honestly: this is **owner-confirmed, not tool-verified.** Vapi exposes no billing API,
so unlike every other item closed in this register there is no probe behind it — the evidence is
Robert's word and the screenshot he sent. If it is ever worth re-confirming, it is a dashboard
read, and the decision rule to apply is in `docs/COST-CONTROLS.md` §4: flip it back ON only for a
paying client whose live call must not drop, accepting that nothing sits behind it._

_Closed 2026-08-07: "Vapi auto-recharge state has never been re-verified." It has now been read
— auto reload ON, $10 at a $5 threshold — and replaced by the item above, which records the
finding rather than the question. Reading it also exposed a defect in the plan that had been
sitting behind this item the whole time: the fallback it assumed, "if ON, set a Spending Limit,"
was never available, because **Vapi has no spending limit.** That instruction was written on
2026-07-25 in `1caf1ef` from assumption rather than from the dashboard, and it made ON look
survivable for two weeks. `docs/COST-CONTROLS.md` §1 and §3 now document both fictional controls
as unavailable instead of deleting them, so the same steps do not get re-derived later._

_Closed 2026-08-06: the `OUTBOUND_CALLS_PER_DAY=0` no-op, fixed in #49 and merged as `bab5ae1`.
Closed against the stated bar, not below it. The parse now goes through `intFromEnv`; five
regression tests cover it, one asserting the old broken expression so the trap shows up in test
output; and the fix was probed in the **deployed container**, not just in CI —_
`docker exec -e T_CAP=0 voice-agent node -e "…"` _returned `0` from `intFromEnv` and `50` from
the old `Number(x) || 50` form side by side in the same process. Live re-probe after deploy:
outbound still `503`, `/healthz` `200`, all five browser demos `200` with assistant and browser
token present._

_Closed 2026-08-06: PR #45 merged as `fe072a8` once GitHub Actions recovered. Worth keeping
the reason it was held — the red check on that PR was_ "The job was not acquired by Runner of
type hosted" _, meaning no test ever executed. A phantom red from a platform outage is
indistinguishable at a glance from a real failure, and the fix is to re-trigger and get a
genuine run, never to merge past it. Re-run on the same HEAD went green in 21s; the local
suite was independently confirmed at 37/37 first._

<!-- New entries go above this line -->

## Session: 2026-08-08 (Closeout — repo purpose doc, and the accomplishments record)

Continuation of the 2026-08-07 session past midnight; the substantive work is in that entry.

### Accomplished

- **`docs/REPO_PURPOSE.md` added (#54).** This was the last CushLabs repo without one. Written
  as its own map of the conversational surfaces from the voice end, following the
  `cushlabs-whatsapp` precedent — explicitly **not** a clone of the Messenger family's shared
  table, and the file says so, because "update all three" applies only inside that family.
  The section that earns its place is _"The constraint that makes this repo different"_: this
  is the only CushLabs surface billing per second of audio to an anonymous visitor, and because
  the Vapi Web SDK requires a browser-side key in the page, server-side rate limiting cannot
  protect that path. Previously that was only discoverable as a comment in `server.js`.
- **Also recorded the strict split with `cushlabs-prod-server`** — app code here,
  `docker-compose.yml` and `Caddyfile` there, six co-tenant services on the same box — so a
  compose change never lands in a voice-agent PR and takes the other five services with it.
- **Three accomplishments logged** (`a-163` infrastructure, `a-164` portfolio, `a-165`
  infrastructure) plus a correction appended to `a-155`, whose title claimed every repo had a
  purpose doc before this one existed.

### Decisions Made

- **One inference in REPO_PURPOSE.md is labelled as an inference.** The white-glove-not-self-serve
  boundary was decided for the Messenger product, not here, so it reads as a reason to ask before
  building ops UI rather than as settled law. Inventing a decision that was never made is how
  these documents start drifting.

### Technical Debt

- **`operating-system/strategy/accomplished.json` is written concurrently by parallel sessions.**
  Mid-task it grew 156 → 162 items when another session committed `bf0db24`, invalidating IDs read
  minutes earlier. Caught by a guard rather than by luck. Not this repo's file, so not on this
  register — but the next thing writing to it should derive IDs at write time, not from an
  earlier read.

### Open Questions / Blockers

- None.

---

## Session: 2026-08-07 (Vapi's cost controls are mostly imaginary, and the shutoff left a public leak)

### Accomplished

- **Turned off the last unbounded spend path.** Auto reload was ON ($10 at a $5 threshold) with
  nothing behind it. Robert switched it off; the credit balance (~$9.79) is now the ceiling.
- **Found that two of the four cost controls this repo documented do not exist** (#51). Vapi has
  no spending limit, no monthly budget, and concurrency cannot be lowered below 10 — verified
  against vendor docs, not assumed. Both were written here on 2026-07-25 from guesswork.
- **Closed a live leak on a public page** (#52). `public/realestate.html` renders the server's
  `error` verbatim, so pressing "Call Now" on the portfolio demo returned
  _"Missing VAPI_API_PRIVATE_KEY, VAPI_PHONE_NUMBER_ID, or VAPI_ASSISTANT_ID_REALESTATE"_ to any
  visitor. The 503 body is now generic, details go to `console.warn`, `/api/config` exposes an
  `outboundEnabled` boolean, and the dial form disables itself up front with a bilingual note.
- **Corrected the PORTFOLIO.md outbound claim** to say built-and-working-but-switched-off, rather
  than implying a live capability behind a disabled button.

### Decisions Made

- **The auto-reload question has one input, written down to stop it oscillating:** a paying client
  whose live call must not drop. No client → OFF. This had read as contradictory advice for two
  weeks only because the docs offered a third option, "ON plus a Spending Limit," that was never real.
- **Marked the fictional controls as unavailable rather than deleting them**, so the same steps do
  not get re-derived in six weeks.

### Technical Debt

- `docs/DEPLOYMENT.md` — last Render artifact. Labelled with a banner, so not silently wrong.

### Open Questions / Blockers

- None. The auto-reload close is owner-confirmed rather than tool-verified; Vapi has no billing API.

---

## Session: 2026-08-06 (Backlog closeout — 7 Dependabot PRs, all 7 advisories, and the falsy-zero bug)

### Accomplished

- **All 7 Dependabot PRs closed; zero PRs now open.** Batched into #47 (npm) and #48 (actions)
  rather than merged in sequence, which would have meant four lockfile rebase cycles.
- **All 7 security advisories cleared** — 3 high, 3 moderate, 1 low. `brace-expansion` (3 high)
  left the tree entirely with googleapis 174; `@opentelemetry/core` came along with the Sentry
  bump; `qs` → 6.15.3 and `body-parser` → 2.3.0 needed no override, because Express 5.2.1's
  ranges already permitted the patched versions and the lockfile was simply stale.
- **Fixed the `|| 50` falsy-zero bug (#49)** and closed its register item against the stated bar —
  deployed and probed in the running container, not just green in CI. See the closed-items note.
- **Deleted `keep-alive.yml`** — pinged every 14 min to stop a Render cold start on a platform
  this service left on 2026-07-25. ~103 no-op runs/day, and it swallowed failures with `|| echo`
  so it was never monitoring either.
- **Corrected the public README**, which still advertised Render hosting and a self-ping
  keep-alive that does not exist in `server.js` (`RENDER_EXTERNAL_URL` appears nowhere in code).

### Decisions Made

- **Superseded rather than merged the Dependabot PRs:** #29 would not even have fixed its own
  advisory — it proposed brace-expansion 5.0.6 where the high alerts require 5.0.9. #24 was
  obsolete outright; `redis` left the project in `eb8ee69`.
- **No pnpm override for `qs`/`body-parser`:** pinning against Express's own resolution for a
  staleness problem would be debt, not a fix.

### Technical Debt

- `docs/DEPLOYMENT.md` still describes the Render deployment in its body. It carries a historical
  banner, so it is labelled rather than misleading — lower priority than the README was.

### Open Questions / Blockers

- Vapi auto-recharge — still the one control that cannot be read from here. Dashboard-only.

---

## Session: 2026-08-06 (Spend audit — answering "is something wasting my money" from the API, not from reasoning)

### Accomplished

- **Answered the spend question with evidence: nothing was ever spending.** `GET /call?limit=100`
  returned exactly **1 call in the account's entire history** — a `webCall` on 2026-07-28, 148s,
  **$0.2066**, `customer-ended-call`. **Zero outbound phone calls have ever been placed.** Lifetime
  spend on the account is twenty-one cents.
- **Confirmed nothing is scheduled.** VPS crontab holds one line (weekly `docker image prune`);
  systemd timers are OS housekeeping plus two `marketsignal-*` units belonging to a different app.
  Nothing touches the voice agent. No Claude-side crons or routines either.
- **Re-confirmed outbound is off:** `VAPI_PHONE_NUMBER_ID` — 0 active, 1 commented out.
- **Put a number on the one live spend path.** All 9 assistants carry `maxDurationSeconds: 600`,
  so the public-key web-call path — which `server.js:129-134` correctly notes the per-IP limiter
  cannot protect, since the browser key is public by design — is bounded at ~$0.84 per call.

### Decisions Made

- **PR #45 left unmerged:** GitHub platform incident, not a review concern. Moved to Open Items.
- **`|| 50` still not fixed:** unchanged from this morning's reasoning — outbound is off by a
  stronger mechanism, so it stays a latent trap, tracked, not bundled into a spend shutoff.

### Immediate Next Steps

- [ ] Merge PR #45 once GitHub merges are available again.
- [ ] Read Vapi → Settings → Billing for auto-recharge + Spending Limit. Last unverified control.
- [ ] Fix `server.js:257` `|| 50`, cover the zero case, deploy, re-probe on the box.

### Technical Debt

- Aggregate spend on the public demo key is bounded per-call but not in total. Per-call is verified;
  the org-level ceiling is not, and there is no Vapi API for it.

### Open Questions / Blockers

- Vapi auto-recharge state — dashboard-only, unreadable from here.

---

## Session: 2026-08-06 (Outbound PSTN calling turned off — and the documented way to do it turned out to be a no-op)

### Accomplished

- **Outbound billed calling is off, verified against the live system.** Robert's
  decision; the question had been open since PR #41 in July, which capped outbound
  but never settled whether it should exist.
- **Caught that the approved method would not have worked.** The plan of record — in
  `ny-eng/docs/HANDOFF.md` and echoed in `docs/COST-CONTROLS.md` — was
  `OUTBOUND_CALLS_PER_DAY=0`. `server.js:257` is
  `Number(process.env.OUTBOUND_CALLS_PER_DAY) || 50`, and `0` is falsy, so zero
  resolves back to **50**. Following the documented procedure would have produced a
  confident "outbound is disabled" report with outbound still running at its
  original rate.
- **Used the kill switch already in the code instead.** `server.js:272` returns 503
  _"Outbound calling is not configured"_ if `VAPI_API_PRIVATE_KEY`,
  `VAPI_PHONE_NUMBER_ID`, or `VAPI_ASSISTANT_ID_REALESTATE` is missing — before any
  Vapi/Twilio request is made. `VAPI_PHONE_NUMBER_ID` is read in exactly **one**
  runtime place (`server.js:269`, inside that handler), so commenting it out in
  `.env.voice-agent` disables outbound and nothing else. The other two are shared:
  `VAPI_API_PRIVATE_KEY` is used across the service, and
  `VAPI_ASSISTANT_ID_REALESTATE` also feeds the `assistants` map at `server.js:115`
  — blanking that one would have made `/api/config?service=realestate` silently fall
  through to the CushLabs assistant (`server.js:142`) rather than fail, which is
  worse than a visible error.
- **Verified end to end, before and after, on the real endpoint.** Probed
  `POST /api/outbound-call` with a deliberately invalid number (`+1000`) so no call
  could be placed in either state — the env check at `:272` runs before phone
  validation at `:280`, so the two states are distinguishable at zero cost:

  |        | Response                                                                     |
  | ------ | ---------------------------------------------------------------------------- |
  | Before | `HTTP 400` — _"Invalid phone number"_, i.e. env check **passed**, route live |
  | After  | `HTTP 503` — _"Outbound calling is not configured"_                          |

  All five browser voice demos re-checked after the restart: `realestate`,
  `cushlabs`, `coaching`, `medspa`, `trades` each return `200` with `assistantId`
  and `publicKey` present. All six compose services healthy.

### Decisions Made

- **Commented the line out rather than deleting it**, with a marker comment above,
  so the value never left the box and re-enabling is removing one `#`.
- **Did not fix the `|| 50` falsy-zero bug in the same change.** Outbound is already
  off by a stronger mechanism, so the bug is now latent; fixing it means a code
  change plus an image rebuild and manual pull, and bundling that with a spend
  shutoff would have made it impossible to tell which change did what. Tracked in
  Open Items.

### Files Touched

- `.env.voice-agent` **on the box** (not in the repo) — `VAPI_PHONE_NUMBER_ID`
  commented out. Timestamped backup written alongside it before the edit.
- `/home/deploy/toggle_outbound.py` on the box — idempotent
  `check` / `disable` / `enable` helper. Reports counts and filenames only; never
  reads or prints a value. **`enable` is the one-command rollback.**
- `docs/COST-CONTROLS.md` — corrected the tuning section.

### Lessons

- **The `||` default is a footgun for any numeric env var whose meaningful value is
  zero**, which is every cap, ceiling, limit, and timeout. `server.js:257` was the
  only instance in this repo; worth grepping for on sight elsewhere.
- **A documented procedure nobody has executed is a hypothesis.** This one had been
  written down twice, in two repos, and carried forward through three sessions
  without once being run.

## Session: 2026-07-07

### Accomplished

- Fixed the voice widget (was fully broken in prod) across 3 CSP PRs: #34 allow Daily.co domains, #35 add media/TURN relays (`*.pluot.blue` + broad `wss:`), #36 add `'unsafe-eval'` — the actual fix. Daily eval()s its call-machine bundle; the real error was hidden behind a generic `daily-error` and only surfaced by reproducing headless with Playwright (`server.js` CSP block).
- Pinned Vapi web SDK `@latest` → `2.5.2` on all 4 widget pages (#37).
- Shipped Mexican Spanish (es-MX) voice tied to the site language switcher (#38): created 4 es-MX Vapi assistants (Clara/Mike/Sophia/James) with Mexican Cartesia voices + Deepgram `nova-2/es` + es-MX prompts; `/api/config?lang=es` returns `*_ES` assistant with English fallback; widget pages re-resolve assistant at click time from `localStorage['cushlabs-lang']`. New tooling: `scripts/create-spanish-assistants.js`. 32 tests pass.
- Verified end-to-end headless: EN and ES both connect clean; ES path requests `lang=es` and loads the Spanish assistant.
- Fixed a 24h HTML cache bug (#39): `express.static` sent `Cache-Control: max-age=86400` on unhashed HTML, so returning visitors ran stale code for a day — this is why the Spanish voice looked broken live (cached HTML called `/api/config` without `&lang`). HTML/CSS/JS now `no-cache` (ETag revalidate); images/fonts stay immutable.
- Fixed premature Spanish call termination (#40): es-MX `endCallPhrases` contained courtesy phrases ("muchas gracias", "que tenga buen día") — these fire when the assistant says them, and Clara opens turns with "muchas gracias", so calls ended at 22–36s (diagnosed via Vapi call logs + transcripts). Now only true farewells (adiós/hasta luego/hasta pronto), patched live on all 4 es-MX assistants + tooling constant. Also: widget error handlers now treat the benign "Meeting has ended"/ejected Daily error as a normal end (no more "Something went wrong" on a clean hangup).

### Decisions Made

- Separate es-MX assistants over one bilingual auto-detect assistant: brand standard requires guaranteed Mexican voice + es-MX prompt.
- `'unsafe-eval'` accepted in CSP: Daily's documented requirement (Vapi doesn't expose `avoidEval`); acceptable for a public demo page.
- Deepgram `nova-2` (not `nova-3`) for Spanish STT — proven es support.

### Immediate Next Steps

- [ ] Robert to place a live Spanish call (real mic) on https://voice.cushlabs.ai/ to confirm a full multi-turn conversation now holds (post-endCallPhrases fix) + accent quality.
- [ ] Consider enabling the language switcher on medspa/nyc-coaching pages (assistants + wiring already Spanish-ready; nav.js `i18nPages` currently excludes them).

### Technical Debt

- realestate/David (outbound-only) has no Spanish variant — out of scope for web widget, revisit if outbound Spanish is needed.
- Daily 0.85.0 "nearing end of support" console notice is Vapi-owned (bundles `@daily-co/daily-js ^0.85.0`); clears when Vapi bumps upstream.
- Testing gap: headless Playwright verify uses a fresh (cacheless) context, so it passed while real returning browsers served stale cached HTML. Post-deploy checks should assert `Cache-Control` headers, not just a clean fresh-context load.

### Open Questions / Blockers

- None.
