# tuhclip Development Log

## Current phase

Phase 2: Google Meet Caption Capture, complete. Manual verification remains pending.

## Completed work

- Initialized a minimal TypeScript, React, Vite, and Vitest Chrome MV3 extension.
- Added stable production entries at `dist/assets/background.js` and `dist/assets/content.js`.
- Added the side-panel page, action-to-side-panel behavior, Google Meet content-script scope, and only the `sidePanel` permission.
- Added typed runtime messages with validation at the untrusted runtime boundary.
- Added a namespaced logger that defaults off in production and can be disabled explicitly.
- Added the five required side-panel states: not on Meet, Meet detected, captions off, transcribing, and idle.
- Added session loading and error views; the not-on-Meet state serves as the empty view.
- Added a compact responsive light UI using the preserved paperclip logo, warm paper neutrals, ink, and a teal capture accent.
- Added keyboard-visible focus CSS, native button semantics, and 44px minimum control targets.
- Recorded major visual decisions in `DESIGN.md`.
- Preserved `docs/` and `logo/paperclip.png`; Vite copies the logo to `dist/paperclip.png`.
- Added the Google Meet adapter under `src/platforms/googleMeet/`: centralized selectors, normalized parser, typed observations, and lifecycle controller.
- Added semantic, ARIA, stable data-attribute, and structural selector strategies; generated CSS classes are not used as sole evidence.
- Added one low-cost document discovery observer that remains active, filters mutation records, detects detached caption ancestors, and only re-scans for relevant additions or disconnected regions.
- Added a caption-region observer that reads the current connected region directly for text and visibility mutations without scanning the document.
- Added idempotent observer scheduling and cleanup, including shared ref-counted `pushState`, `replaceState`, `popstate`, and `hashchange` SPA navigation detection.
- Added typed `MEET_DETECTED`, `CAPTIONS_WAITING`, `CAPTIONS_ACTIVE`, `CAPTIONS_INACTIVE`, and `CAPTION_OBSERVATION` runtime messages with validation.
- Added background relay for Meet-origin state signals so the open side panel reflects state immediately; polling remains the recovery path.
- Added development-only caption instrumentation for region found/lost, observer reattachment, speaker, text, and state changes.
- Added the safe `Unknown speaker` fallback without participant-name inference.
- Kept Phase 2 observations ephemeral: no persistence, audio capture, caption control, or added permissions.
- Fixed `createSequentialPoll` so rejected tasks clear running state in `finally`, remain retryable, and do not leak unhandled rejections.

## Exact checks and results

- `npm install`: dependencies installed; 111 packages audited. npm warned that `esbuild@0.28.2` has an install script pending npm's optional allowScripts review. Build execution confirms esbuild is available.
- `npm test`: 5 test files passed, 14 tests passed, 0 failed.
- `npm run typecheck`: exit 0, no TypeScript errors.
- `npm run build`: exit 0; Vite 7.3.6 transformed 34 modules and generated `sidepanel.html`, `manifest.json`, `paperclip.png`, stable content/background entries, side-panel JS/CSS, and a shared message chunk.
- `npm audit --omit=dev`: 0 vulnerabilities.
- Isolated logger check: `npm test -- src/shared/logger.test.ts -t "does not emit output when disabled"` passed 1 test with the unrelated test skipped.
- Dist audit: `manifest.json` references existing `assets/background.js`, `assets/content.js`, `sidepanel.html`, and `paperclip.png`; host scope is exactly `https://meet.google.com/*`; permission is exactly `sidePanel`; minimum Chrome version is 116.
- Contrast checks: ink/paper 8.46:1, secondary text/base 5.42:1, button text/teal 5.95:1, focus ink/base 11.77:1. All pass WCAG AA for normal text.
- Browser render at 945x917: expected extension-API error state rendered outside extension context; document width 897px; page scroll width matched viewport; retry target measured 162.28x44px.

## Phase 2 exact checks and results

- TDD RED, adapter/integration/poll: focused run produced 3 missing-module suites, 5 expected assertion failures, and 1 unhandled rejected poll task before production changes.
- TDD RED, narrow lifecycle/SPA: focused run passed selector tests and failed 2 observer tests because discovery remained broad and History API navigation hooks were absent.
- TDD RED, state relay: `npm test -- src/background/messageRelay.test.ts` failed because `messageRelay` did not exist.
- TDD GREEN, adapter: focused selector/lifecycle run passed 2 files and 7 tests.
- TDD GREEN, integration/poll: focused parser, messaging, session, polling, and view-state run passed 5 files and 18 tests.
- TDD GREEN, relay: focused relay run passed 1 file and 5 tests.
- TDD RED, Phase 2 review: focused review run failed 16 tests across hidden caption visibility, unrelated live regions, direct-element parsing, persistent discovery, document rescans, visibility attributes, SPA reset, multi-tab relay, and shared navigation ownership.
- TDD GREEN, Phase 2 review: focused run passed 4 files and 27 tests after the fixes.
- `npm test`: 9 test files passed, 53 tests passed, 0 failed.
- `npm run typecheck`: exit 0, no TypeScript errors.
- `npm run build`: exit 0; Vite 7.3.6 transformed 40 modules and generated `sidepanel.html`, `manifest.json`, `paperclip.png`, stable content/background entries, side-panel JS/CSS, and a shared message chunk.
- Manifest audit: host scope remains exactly `https://meet.google.com/*`; permission remains exactly `sidePanel`; no `microphone`, `tabCapture`, or `desktopCapture`; every referenced output exists.
- Source audit: no `click()`, `getUserMedia`, `tabCapture`, `desktopCapture`, or `chrome.storage` use under `src/`; `indexedDB` is used only by the local transcript store.
- Manual Meet verification unavailable: no real Google Meet session could be exercised in this environment. Live selector compatibility and changing captions still require unpacked-extension verification on Meet.

## Phase 2 review fixes

- Caption blocks now require semantic/computed visibility. `hidden`, `inert`, `aria-hidden="true"`, inline `display:none`/`visibility:hidden`, and equivalent computed styles suppress observations; no `getClientRects()` dependency is used.
- Region observation now includes `hidden`, `aria-hidden`, `style`, and `class` attribute changes.
- Caption-region selection now requires explicit caption semantics or stable caption data evidence. Named chat, participant, and notification live/region fixtures are rejected.
- Direct elements matching caption text and caption identity attributes now parse correctly through `Element.matches()`.
- Caption mutations read the connected region directly. Full discovery runs only initially, after SPA reset, when connectivity is lost, or when document mutations add a relevant candidate.
- The persistent filtered document observer catches removal of any ancestor containing the active region.
- SPA navigation clears prior region/caption history, emits `CAPTIONS_WAITING`, then rediscovers.
- Navigation hooks are shared per window with subscriber reference counting. Cleanup restores only wrappers still owned by tuhclip, preserving later third-party replacements.
- State relay now validates sender and active tab IDs plus both Meet URLs. The side panel refreshes authoritative active-tab state instead of forcing `onMeet: true` from a relayed signal.

## Phase 2 review fix round 2

- TDD RED: focused selector/observer run failed 8 tests for nested duplicate observations, no-region irrelevant mutation searches, missing `inert` observation, and external ancestor visibility changes.
- TDD GREEN: focused selector/observer run passed 2 files and 25 tests.
- Nested caption candidates now resolve to canonical outer blocks when a matching ancestor exists, preserving speaker and source identity while suppressing inner `Unknown speaker` duplicates.
- No-region discovery now ignores character mutations and irrelevant child additions. Global search runs only for added nodes containing caption-region candidates.
- Document removals trigger discovery only when the current region is no longer connected.
- Both region and document visibility observation include `inert`; document attribute records read the current region directly when a containing ancestor changes.
- Visibility evaluation now walks beyond the selected region through its ancestor chain, handling external `hidden`, `aria-hidden`, `inert`, inline style, and computed-style changes.

## Phase 2 review fix round 3

- TDD RED: focused observer run failed 1 test because adding a caption block to an existing empty semantic caption region scheduled no discovery.
- TDD GREEN: focused observer run passed 1 file and 13 tests.
- No-region child-list filtering now checks the mutation target as well as added subtrees for caption-region candidacy. Existing empty caption regions are discovered when their first block arrives; irrelevant target/addition and character mutations still schedule no global search.

## Issues and fixes

- `npm install && npm test` initially timed out while installing on the Windows-mounted WSL filesystem. Re-ran install with a longer timeout.
- Vitest 5 bus-errored or hung under Node 26.7.0 on both drvfs and ext4. Pinned Vitest to the mature 3.x line.
- The latest React Vite plugin expected Vite 8 internals. Pinned `@vitejs/plugin-react` 5 with Vite 7.
- Typecheck lacked Vite and Node ambient types and used CommonJS `__dirname` in ESM config. Added `@types/node`, Vite client types, and `import.meta.url` path resolution.
- Browser-harness viewport emulation failed with its own CDP `sessionId` protocol error. Wide rendering, overflow, control sizing, CSS narrow-state rules, and fluid sizing were inspected; automated 280px viewport rendering remains unavailable in this environment.

## Phase 1 review fixes

- Replaced volatile worker-owned readiness with a fresh `GET_CONTENT_STATUS` probe to the active tab's current top-level content script on every status request. Worker suspension and document navigation no longer depend on remembered state.
- Replaced ambiguous caption booleans with the explicit `waiting`, `active`, and `ended` meeting lifecycle.
- Added pure session-resolution tests for non-Meet tabs, recoverable active-document readiness, and unavailable content scripts.
- Added `minimum_chrome_version: "116"` for `sidePanel.setPanelBehavior` compatibility.
- Removed the unused `storage` permission; later IndexedDB work requires no extension permission.
- Isolated logger state in `beforeEach`; the disabled case passes as a standalone filtered test.
- Replaced overlapping `setInterval` polling with one sequential timeout chain. Manual retry queues behind an active request; errors clear only after a successful response.
- Added `.gitignore` entries for `node_modules/` and `dist/`.
- TDD RED: 4 behavioral assertions failed and 2 pure modules were missing before implementation.
- TDD GREEN: 5 test files and 14 tests passed after minimal implementation.

## Phase 3 exact checks and results

- TDD RED: new `src/transcript/transcriptEngine.test.ts` failed to load because `transcriptEngine` did not exist.
- TDD GREEN: `src/transcript/transcriptEngine.test.ts` passed 7 tests after minimal implementation.
- Reconciliation strategy: one in-memory active segment per content script; progressive extension or shrinkage of the same normalized text updates in place; whitespace/casing-only and identical repeats are no-ops; speaker change, source-block replacement, caption disappearance, inactivity timeout (default 2000ms), and pagehide each finalize once.
- Deduplication: layer 1 active normalized-text guard, layer 2 speaker+normalized fingerprint, layer 3 bounded recent cache (default 60s window, 50 entries) so genuine later repetition is preserved.
- Timestamps: `Date.now()` source of truth; segments carry absolute `startedAt`/`endedAt` plus `relativeStartMs` against meeting start for absolute/relative UI display.
- Content script owns one engine per page, relays ephemeral observations plus finalized `TRANSCRIPT_SEGMENT` messages, finalizes on caption loss, checks inactivity every second, and flushes on pagehide. Nothing persists to disk in Phase 3.
- `npm test`: 10 files passed, 61 tests passed, 0 failed (includes all 6 required engine cases plus inactivity).
- `npm run typecheck`: exit 0.
- `npm run build`: exit 0; 43 modules transformed.

## Phase 4 exact checks and results

- TDD RED: `src/export/export.test.ts` and `src/storage/storage.test.ts` failed to load because export formatters and the storage layer did not exist.
- TDD GREEN: both suites passed 7 tests after minimal implementation (4 export, 3 storage).
- Ruling: meeting title derives from `document.title` stripped of the Google Meet suffix via one `MEETING_STARTED` message per page; empty or generic titles fall back to `Google Meet - YYYY-MM-DD HH:mm`. No `tabs` permission added.
- IndexedDB stores `meetings`, `segments` (indexed by `by-meeting`), and `settings`. Only finalized segments persist; active captions stay in memory. Duplicate segment IDs are ignored. All reads fail safe to empty/null.
- Side panel has Live and History tabs: live status header, in-progress caption replaced in place, finalized list, TXT/MD/JSON export of the current meeting; history lists title, date, duration, and line count with full transcript view and the same three exports.
- Persistence resilience: transcript survives side-panel close/reopen because all finalized state lives in IndexedDB and reloads on open.
- `npm test`: 12 files passed, 68 tests passed, 0 failed.
- `npm run typecheck`: exit 0.
- `npm run build`: exit 0; 50 modules transformed.

## Phase 5 exact checks and results

- Added 4 regression tests: rapid speaker switching finalizes each turn exactly once, distinct same-speaker sentences split, empty caption text creates nothing, meeting end finalizes the active segment.
- `npm test`: 12 files passed, 72 tests passed, 0 failed.
- `npm run typecheck`: exit 0.
- `npm run build`: exit 0.
- No lint script is configured; typecheck, tests, and build are the automated gates.
- Permissions review: manifest requests exactly `sidePanel`; host scope exactly `https://meet.google.com/*`; no `microphone`, `tabCapture`, or `desktopCapture`.
- Privacy review: source grep finds no `fetch`, `XMLHttpRequest`, analytics SDKs, audio capture, or transcript upload. `indexedDB` is used only by the local store. The only `microphone` string in source is user-facing copy stating no microphone permission is used.
- Error handling: missing speaker falls back to `Unknown speaker`; missing caption container and disappearing nodes are handled by discovery/sentinel paths; empty transcripts render empty states in UI and all three exporters; corrupt or missing IndexedDB reads fail safe to empty lists or null.
- Browser console review: real unpacked-extension console inspection requires a live Chrome run and remains a manual follow-up.
- Fixed a stale Phase 2 log line that predated the legitimate Phase 4 IndexedDB store.

## Phase 6 exact checks and results

- Clean install: `rm -rf node_modules dist && npm ci` from the lockfile, success.
- `npm test`: 12 files passed, 72 tests passed, 0 failed.
- `npm run typecheck`: exit 0. `npm run build`: exit 0, 50 modules.
- Manifest audit: V3, `assets/background.js`, `sidepanel.html`, `assets/content.js` all present; permission exactly `sidePanel`; host exactly `https://meet.google.com/*`; minimum Chrome 116.
- Build-output audit: Chrome Load Unpacked directory is `dist/` with all referenced assets verified present.
- Transcript invariants hold by test: observer event != record, active text updates in place, finalized segments persist once, repeats inside the window dedupe, genuine later repetition preserved, speaker change finalizes, timestamps from local browser time.
- Data audit: IndexedDB schema stable across `meetings`, `segments`, `settings`; history reads correctly; exports match stored transcripts; empty and corrupt states fail safe.
- Privacy audit: no capture, STT, upload, or analytics code or permissions.
- Documentation audit: README covers description, privacy, install/build, Load Unpacked, manual captions, limitations, architecture, and roadmap.
- Hygiene: `.gitignore` covers `node_modules/` and `dist/`; no `.env`; no secrets found by pattern scan; `tuhclip-agent-plan.zip` is the user-supplied plan archive and stays.
- Wrote `FINAL_CHECK.md`: PASS.

## Phase 7 exact checks and results

- `gh auth status`: logged in as Alief1150 with `repo` scope.
- `gh repo view alief1150/tuhclip`: did not exist; created private via `gh repo create alief1150/tuhclip --private --source=. --remote=origin --push`. No unrelated repository was touched.
- Final MVP commit `509fefa` pushed on `implementation/tuhclip-mvp` tracking `origin/implementation/tuhclip-mvp`.
- `gh repo view alief1150/tuhclip --web=false`: verified repository exists with the pushed branch and README rendering.
- Updated `FINAL_CHECK.md` with repository, remote URL, branch, commit hash, and `dist/` build folder.

## Transcript reconciliation fix (speaker turns)

- Root causes of cumulative duplication: (a) Meet recreates caption DOM per update, so region loss triggered `captionGone()` and finalized a segment per progressive version; (b) the 2s inactivity timeout finalized mid-utterance chunks; (c) every finalized chunk became a permanent UI/IndexedDB row with no aggregation layer. Same-speaker rows split for the same reason: no speaker-turn concept existed.
- Parser reads individual rows, never `region.textContent`; speaker prefix is stripped from row text. Added row-count/raw-text/parsed-caption debug logs plus a `button` exclusion in the structural fallback so field reports can isolate the layer.
- New `SpeakerTurnAggregator` (`src/transcript/speakerTurn.ts`): chunks merge into turns for the same speaker (extension/shrinkage updates in place, short-pause continuation joins with a space inside `SPEAKER_TURN_CONTINUATION_MS = 8000`); speaker change finalizes; recently finalized turns reopen when extended within `SPEAKER_TURN_EXTENSION_MS = 30000`; genuine later repetition still creates a new turn. No magic numbers scattered.
- Normalization now strips punctuation for comparison only (`\p{P}\p{S}`); display text is untouched and no wording is rewritten.
- Pipeline is now observation → chunk engine → turn aggregator → `TRANSCRIPT_TURN` upsert. Side panel and IndexedDB upsert by stable turn id (`upsertSegment`); exports render turns, so TXT/MD/JSON stay clean.
- Side panel is a stable 100vh shell: header, tabs, status/export toolbar, and footer are fixed while only the transcript ScrollArea scrolls. Turn items use lightweight separators, speaker semibold, muted timestamps, live turn updated in place.
- Checks: typecheck exit 0; production build exit 0 plus `verify-extension` PASS (standalone `assets/content.js`, manifest references resolve).
- Tests added: `src/transcript/speakerTurn.test.ts` covering spec tests A–G (7/7 passing in isolation). Full suite not re-run in this session per user request.

## Multitasking pack (0.1.0)

- Phase 01 Smart Follow Latest: `FollowTracker` keyed by meetingId, 80px near-bottom threshold, floating Latest button with unseen count; 6 tests.
- Phase 02 background independence: turns and meetings persist in the background service worker, so capture survives tab switches, History view, and panel reopen; panel adopts the live meeting on open and shows Transcribing in background.
- Phase 03 multi-session: `SessionManager` map with heartbeat registration, active-session selector in Live view, per-session transcript display, auto-select on Meet switch with manual override.
- Phase 04 reconnect: 10-minute resume window, reconnectCount, disconnected-to-ended sweep on session poll, replay dedup via seeded recent turn, unfinished captions finalized on pagehide.
- Phase 05 session UX: Open Meet tab activation with graceful missing-tab handling, selector rows with title and meet code.
- Full gate: 110/110 tests, typecheck exit 0, production build plus verify-extension PASS.
- Released 0.1.0 (package.json and manifest version synchronized, CHANGELOG.md created).

## v0.3.2 stability patch

- Fixed cumulative duplication: overlap-aware updates (contains-check keeps the longer text) in the chunk engine and turn aggregator; case-insensitive speaker comparison; speaker inheritance on temporary label loss; parser returns null speaker instead of early fallback.
- Added Captions Off detection: 5s grace in content, CAPTIONS_OFF message, per-session flag, side-panel warning with manual enable steps; resume keeps the same session and transcript.
- Background reliability: audited (no tab-visibility gating; persistence precedes active-tab relay); removed panel-side meeting close on foreign captions-inactive signals.
- Follow button made solid, elevated, and pinned above the viewport edge.
- Titles fall back to Meet code instead of generic labels.
- Regression tests: engine speaker/overlap/inherit cases, Case E 20-update paragraph, reconnect replay seed, resume window, upsert, per-meeting isolation, export duplication, captions-off manager/status/validator coverage.
- Gate: 120/120 tests, typecheck exit 0, build plus verify-extension PASS, standalone content.js confirmed.
- Released 0.3.2, tag v0.3.2, GitHub Release with ZIP and checksum published by Actions.

## Remaining work

- MANUAL QA REQUIRED in a live browser: progressive duplicate test, caption-off toggle, follow-latest control, background tab switch, two-Meet isolation, speaker alternation, history titles, per-meeting exports.
