# Session Log — cushlabs-ai-voice-agent

Entries are newest-first. Each entry documents one Claude Code working session.
**Open Items** is a standing register pinned above them — read it first.

---

## Open Items

Standing register, scoped to this repo. **An item leaves this list only when it
has been verified end to end against the real system.** "Tests pass" and "the
config looks right" are not verification.

Opened 2026-08-06. Both items below arrived from `ny-eng/docs/HANDOFF.md`, which
had been tracking voice-agent work inside the website repo where nobody would
think to look for it. Verified against this codebase on arrival.

---

- [ ] **Decide whether outbound PSTN calling should exist at all.**
      _Blocks: real money, on a client-facing route._ Robert flagged he may not want
      outbound calling in any form. PR #41 only _capped_ it — the decision was never
      made.
      _Verified 2026-08-06:_ `server.js:257` reads
      `Number(process.env.OUTBOUND_CALLS_PER_DAY) || 50`, and that variable is absent
      from the env file on the box (`docs/COST-CONTROLS.md:131`). So **the default of
      50 billed Twilio calls/day is live right now** on `voice.cushlabs.ai/realestate`
      (the "David" agent) — a ceiling nobody chose, not a configured limit.
      _Closes when:_ Robert decides. To disable, set `OUTBOUND_CALLS_PER_DAY=0` in the
      env file on the VPS and re-up the container, or gate the route behind a feature
      flag. Claude has SSH access and can do either.

- [ ] **Vapi auto-recharge state has never been re-verified.**
      _Blocks: the spend ceiling above._ Robert changed the payment method on
      2026-07-25 and auto-recharge was not re-checked afterward. If it is OFF, the
      credit balance is a natural ceiling and nothing more is needed. If it is ON with
      no Spending Limit set, there is no ceiling at all — and the outbound route above
      bills against it.
      _Closes when:_ Vapi → Settings → Billing is read. Dashboard-only; no API access
      is configured from here.

---

<!-- New entries go above this line -->

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
