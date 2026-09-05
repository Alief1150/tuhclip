# Phase 2 — Google Meet Caption Capture

## Goal
Reliably observe Google Meet live captions and extract speaker + current caption text without coupling the rest of the app to Meet's DOM.

## Core architecture

```text
Google Meet DOM
      ↓
Google Meet adapter
      ↓
caption event
      ↓
generic transcript engine
```

All Google Meet-specific DOM logic must remain inside `src/platforms/googleMeet/`.

## Requirements

### 1. Detect Meet page state
Detect:
- user is on a Meet page
- captions are not visible yet
- captions appear
- captions disappear
- Meet SPA navigation changes

Do not force-enable captions by clicking Google Meet UI elements.

### 2. MutationObserver
Use `MutationObserver`, but avoid scanning the entire document on every mutation.

Preferred behavior:
1. Find the likely caption region.
2. Observe the narrowest useful subtree.
3. Re-resolve the region when Meet recreates nodes.
4. Clean up old observers and timers.

### 3. Selector strategy
Do not depend only on unstable generated CSS classes.

Prefer combinations of:
- semantic DOM relationships
- aria attributes
- role attributes
- accessibility properties
- stable data attributes when available
- structural heuristics

Fallback selectors are allowed, but keep them centralized in `selectors.ts`.

### 4. Parser output
Normalize all Meet DOM parsing into one event shape such as:

```ts
interface CaptionObservation {
  speaker: string | null;
  text: string;
  observedAt: number;
  sourceId?: string;
}
```

`sourceId` may represent a DOM block identity if useful for reconciliation.

### 5. Caption state
Emit clear state changes:
- `MEET_DETECTED`
- `CAPTIONS_WAITING`
- `CAPTIONS_ACTIVE`
- `CAPTIONS_INACTIVE`

The side panel must be able to reflect these states in real time.

### 6. Language handling
`tuhclip` is language-agnostic.

Do not implement language selection in V1. Store exactly the text Google Meet provides.

### 7. Speaker fallback
If speaker name is temporarily unavailable:
- do not crash
- use a safe fallback such as `Unknown speaker`
- replace/resolve it later only if reliable context exists

Do not invent participant names.

## Manual debug instrumentation
In development, log:
- caption region found/lost
- speaker parsed
- caption text parsed
- caption status changes
- observer reattachment

## Verification before Phase 3
At minimum, manually verify on a Meet page that the adapter can emit changing caption observations while captions are enabled.

Do not persist every mutation yet. Phase 3 handles reconciliation and deduplication.

Run build + typecheck, fix all errors, and update `DEVLOG.md`.
