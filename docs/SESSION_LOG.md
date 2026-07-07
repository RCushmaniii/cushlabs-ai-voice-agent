# Session Log — cushlabs-ai-voice-agent

Entries are newest-first. Each entry documents one Claude Code working session.

---

<!-- New entries go above this line -->

## Session: 2026-07-07

### Accomplished

- Fixed the voice widget (was fully broken in prod) across 3 CSP PRs: #34 allow Daily.co domains, #35 add media/TURN relays (`*.pluot.blue` + broad `wss:`), #36 add `'unsafe-eval'` — the actual fix. Daily eval()s its call-machine bundle; the real error was hidden behind a generic `daily-error` and only surfaced by reproducing headless with Playwright (`server.js` CSP block).
- Pinned Vapi web SDK `@latest` → `2.5.2` on all 4 widget pages (#37).
- Shipped Mexican Spanish (es-MX) voice tied to the site language switcher (#38): created 4 es-MX Vapi assistants (Clara/Mike/Sophia/James) with Mexican Cartesia voices + Deepgram `nova-2/es` + es-MX prompts; `/api/config?lang=es` returns `*_ES` assistant with English fallback; widget pages re-resolve assistant at click time from `localStorage['cushlabs-lang']`. New tooling: `scripts/create-spanish-assistants.js`. 32 tests pass.
- Verified end-to-end headless: EN and ES both connect clean; ES path requests `lang=es` and loads the Spanish assistant.
- Fixed a 24h HTML cache bug (#39): `express.static` sent `Cache-Control: max-age=86400` on unhashed HTML, so returning visitors ran stale code for a day — this is why the Spanish voice looked broken live (cached HTML called `/api/config` without `&lang`). HTML/CSS/JS now `no-cache` (ETag revalidate); images/fonts stay immutable.

### Decisions Made

- Separate es-MX assistants over one bilingual auto-detect assistant: brand standard requires guaranteed Mexican voice + es-MX prompt.
- `'unsafe-eval'` accepted in CSP: Daily's documented requirement (Vapi doesn't expose `avoidEval`); acceptable for a public demo page.
- Deepgram `nova-2` (not `nova-3`) for Spanish STT — proven es support.

### Immediate Next Steps

- [ ] Robert to place a live Spanish call (real mic) on https://voice.cushlabs.ai/ to confirm audio + accent quality.
- [ ] Consider enabling the language switcher on medspa/nyc-coaching pages (assistants + wiring already Spanish-ready; nav.js `i18nPages` currently excludes them).

### Technical Debt

- realestate/David (outbound-only) has no Spanish variant — out of scope for web widget, revisit if outbound Spanish is needed.
- Daily 0.85.0 "nearing end of support" console notice is Vapi-owned (bundles `@daily-co/daily-js ^0.85.0`); clears when Vapi bumps upstream.
- Testing gap: headless Playwright verify uses a fresh (cacheless) context, so it passed while real returning browsers served stale cached HTML. Post-deploy checks should assert `Cache-Control` headers, not just a clean fresh-context load.

### Open Questions / Blockers

- None.
