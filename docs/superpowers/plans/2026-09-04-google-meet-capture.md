# Google Meet Caption Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Observe Google Meet caption state and emit typed caption observations without persisting data or controlling Meet.

**Architecture:** Pure selectors and parser isolate Meet DOM interpretation. One lifecycle controller switches from broad discovery to narrow caption-region observation, retains a root sentinel for replacement, and re-resolves on SPA navigation. Existing runtime messaging exposes state to background and side panel.

**Tech Stack:** TypeScript, DOM APIs, Chrome MV3 messaging, Vitest, React, Vite

**Spec:** `docs/agent/02_GOOGLE_MEET_CAPTURE.md`

## Global Constraints

- Keep all Meet DOM parsing under `src/platforms/googleMeet/`.
- Never click caption controls, capture audio, persist observations, or add permissions.
- Never use generated classes as the sole selector strategy.
- Use `Unknown speaker` only when no reliable speaker text exists.
- Do not commit or publish.

---

### Task 1: Selector And Parser Contract

**Files:**
- Create: `src/platforms/googleMeet/types.ts`
- Create: `src/platforms/googleMeet/selectors.ts`
- Create: `src/platforms/googleMeet/captionParser.ts`
- Test: `src/platforms/googleMeet/selectors.test.ts`
- Test: `src/platforms/googleMeet/captionParser.test.ts`

**Interfaces:**
- Produces: `CaptionObservation`, `findCaptionRegion(root)`, `findCaptionBlocks(region)`, `parseCaptionBlock(block, observedAt)`.

- [ ] Write tests using semantic, ARIA, stable data, and structural fixture elements; include generated-class-only rejection and unknown speaker fallback.
- [ ] Run `npm test -- src/platforms/googleMeet/selectors.test.ts src/platforms/googleMeet/captionParser.test.ts`; expect missing-module failure.
- [ ] Implement centralized selector candidates and normalized parsing without changing caption language.
- [ ] Re-run focused tests; expect pass.

### Task 2: Observer Lifecycle

**Files:**
- Create: `src/platforms/googleMeet/captionObserver.ts`
- Test: `src/platforms/googleMeet/captionObserver.test.ts`

**Interfaces:**
- Consumes: selector and parser functions from Task 1.
- Produces: `createCaptionObserver(options)` returning `{ start(): void; stop(): void; refresh(): void }`.

- [ ] Write injected-observer tests proving broad discovery, narrow observation, region loss/recreation, SPA refresh, no duplicate observer/timer, state transitions, and cleanup.
- [ ] Run focused test; expect missing-module failure.
- [ ] Implement one root sentinel, one replaceable region observer, one scheduled resolve, history/popstate refresh hooks, typed callbacks, and debug logs.
- [ ] Re-run focused tests; expect pass.

### Task 3: Typed Runtime Integration

**Files:**
- Modify: `src/shared/messages.ts`
- Modify: `src/shared/messages.test.ts`
- Modify: `src/content/index.ts`
- Modify: `src/background/sessionStatus.ts`
- Modify: `src/background/sessionStatus.test.ts`
- Modify: `src/sidepanel/viewState.ts`
- Modify: `src/sidepanel/viewState.test.ts`
- Modify: `src/sidepanel/App.tsx`

**Interfaces:**
- Produces: typed `MEET_DETECTED`, `CAPTIONS_WAITING`, `CAPTIONS_ACTIVE`, `CAPTIONS_INACTIVE`, and `CAPTION_OBSERVATION` messages.

- [ ] Add failing validator, state-resolution, and side-panel mapping tests.
- [ ] Run focused tests; expect assertion failures.
- [ ] Wire observer callbacks to content-script state and typed runtime sends; map inactive state to idle UI without storing observations.
- [ ] Re-run focused tests; expect pass.

### Task 4: Rejected Poll Cleanup

**Files:**
- Modify: `src/sidepanel/poll.ts`
- Modify: `src/sidepanel/poll.test.ts`

**Interfaces:**
- Preserves: `createSequentialPoll(task, delay)`.

- [ ] Add a test proving retry works after `task` rejects and no unhandled rejection escapes.
- [ ] Run focused test; expect failure.
- [ ] Move running-state cleanup and scheduling into `finally`; contain task rejection.
- [ ] Re-run focused test; expect pass.

### Task 5: Verification And Development Log

**Files:**
- Modify: `DEVLOG.md`

- [ ] Run `npm test`, `npm run typecheck`, and `npm run build`.
- [ ] Audit `dist/manifest.json` for exact host, permissions, forbidden capture permissions, and referenced output files.
- [ ] Record exact command results, TDD RED/GREEN evidence, implementation scope, concerns, and manual Meet verification availability in `DEVLOG.md`.
