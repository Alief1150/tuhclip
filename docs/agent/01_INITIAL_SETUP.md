# Phase 1 — Initial Setup

## Goal
Prepare the repository, architecture, build tooling, manifest, and side panel shell before implementing Google Meet parsing.

## Tasks

### 1. Inspect repository
Before editing:
- list existing files
- inspect existing `package.json`, if present
- inspect current logo/branding assets
- inspect existing source code
- avoid deleting useful existing work

### 2. Initialize project if necessary
Use:
- TypeScript
- React
- Vite

Add only required dependencies.

### 3. Create clean source structure
Recommended structure:

```text
src/
  background/
    serviceWorker.ts

  content/
    index.ts

  platforms/
    googleMeet/
      captionObserver.ts
      captionParser.ts
      selectors.ts
      types.ts

  transcript/
    transcriptEngine.ts
    reconciliation.ts
    deduplication.ts
    normalization.ts
    types.ts

  storage/
    db.ts
    meetings.ts
    segments.ts
    settings.ts

  sidepanel/
    App.tsx
    main.tsx
    components/
    pages/
    hooks/

  export/
    markdown.ts
    text.ts
    json.ts

  shared/
    messages.ts
    constants.ts
    utils.ts
    logger.ts
```

Improve the structure if needed, but preserve separation of concerns.

### 4. Manifest V3
Support only:

```text
https://meet.google.com/*
```

Required behavior:
- content script runs on Google Meet
- background service worker is registered
- side panel is configured
- clicking extension action opens the side panel

Request only necessary permissions.

Do **not** request:
- microphone
- tabCapture
- desktopCapture

### 5. Side panel shell
Create a polished but minimal initial UI with these states:
- not on Google Meet
- Google Meet detected
- captions off / waiting
- transcribing
- idle / meeting ended

Use the `tuhclip` brand assets already present when possible.

### 6. Shared typed messaging
Define typed runtime messages for communication between:
- content script
- background service worker
- side panel

Do not use untyped ad-hoc message objects scattered throughout the codebase.

### 7. Local debug logger
Implement development logging namespaces such as:

```text
[tuhclip][caption]
[tuhclip][transcript]
[tuhclip][storage]
[tuhclip][ui]
```

Debug logging must be easy to disable in production.

## Verification before Phase 2
Run:
- dependency install
- build
- typecheck

Confirm:
- no TypeScript errors
- generated extension output exists
- manifest is valid
- side panel bundle is generated

Update `DEVLOG.md` before moving to Phase 2.
