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

- [ ] **`OUTBOUND_CALLS_PER_DAY=0` silently does nothing — the documented disable
      method is a no-op.**
      _Blocks: anyone who trusts the docs to turn off spending._ `server.js:257` reads
      `Number(process.env.OUTBOUND_CALLS_PER_DAY) || 50`. `Number("0")` is `0`, which
      is falsy, so `|| 50` fires and the cap lands back on **50**. Setting the
      variable to zero to stop outbound calling leaves it running at exactly the rate
      it was already running at, while reporting success. This was the disable
      instruction written in `ny-eng/docs/HANDOFF.md` and repeated in
      `docs/COST-CONTROLS.md`; it was never tested.
      _Not urgent as of 2026-08-06_ — outbound is off by a stronger mechanism (see
      today's entry), so this is a latent trap rather than a live hole.
      _Closes when:_ the parse handles `0` (`Number(x)` with an explicit
      `Number.isFinite` check, or an `OUTBOUND_ENABLED` flag), a test covers the zero
      case, and the fix is deployed and re-probed on the box. A unit test alone does
      not close this — the whole point is that the deployed path was never checked.

- [ ] **Vapi auto-recharge state has never been re-verified.**
      _Blocks: the spend ceiling on everything that is still live._ Robert changed the
      payment method on 2026-07-25 and auto-recharge was not re-checked afterward. If
      it is OFF, the credit balance is a natural ceiling and nothing more is needed. If
      it is ON with no Spending Limit set, there is no ceiling at all.
      Outbound PSTN is now disabled, but the five browser voice demos
      (`cushlabs`, `coaching`, `medspa`, `trades`, `realestate`) still start real Vapi
      sessions from a public page using a browser-side key, so this still matters.
      _Closes when:_ Vapi → Settings → Billing is read. Dashboard-only; no API access
      is configured from here.

---

<!-- New entries go above this line -->

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
