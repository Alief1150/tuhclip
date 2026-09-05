# tuhclip — Master Execution Plan

## Objective
Build a production-ready MVP Chrome extension named `tuhclip` for Google Meet that reads **existing Google Meet live captions** from the DOM, turns them into a clean structured transcript, stores everything locally, and exposes the result in a Chrome Side Panel.

This plan is designed for an autonomous coding agent such as OpenCode. Execute the files in numerical order and do not skip final verification.

## Product constraints
- Brand name is always `tuhclip` (lowercase).
- Google Meet only for V1.
- Chrome Manifest V3.
- No microphone recording.
- No tab/system audio capture.
- No Whisper.
- No Google Speech-to-Text API.
- No external transcript upload.
- No analytics.
- All transcript data stays local in the browser.
- User must manually turn Google Meet captions on.

## Preferred stack
- TypeScript
- React
- Vite
- Chrome Side Panel API
- Content Script
- Background Service Worker
- IndexedDB
- Vitest or equivalent lightweight test runner

## Repository rule
Work inside the current `tuhclip` project directory. Inspect existing files and assets before changing anything. Reuse existing logo/branding assets when present.

## Execution order
1. `01_INITIAL_SETUP.md`
2. `02_GOOGLE_MEET_CAPTURE.md`
3. `03_TRANSCRIPT_ENGINE.md`
4. `04_STORAGE_UI_EXPORT.md`
5. `05_TESTING_AND_HARDENING.md`
6. `06_FINAL_CROSSCHECK.md`
7. `07_GITHUB_RELEASE.md`

## Non-goals for V1
Do not implement yet:
- AI summary / LLM integration
- Zoom support
- Microsoft Teams support
- login / accounts
- cloud sync
- subscription / billing
- remote backend

Architect the code so these can be added later without rewriting the transcript engine.

## Core success criteria
The project is complete only when all are true:
- Manifest V3 is valid.
- Extension builds successfully.
- TypeScript has no errors.
- Side panel opens from the extension action.
- Content script runs on `https://meet.google.com/*`.
- Caption state is detected.
- Speaker and text parsing are isolated in a Google Meet adapter.
- Progressive captions do not create duplicates.
- Repeated MutationObserver events do not create duplicates.
- Timestamps are generated locally.
- Finalized transcript segments persist to IndexedDB.
- Meeting history works.
- TXT, Markdown, and JSON exports work.
- Final verification has been completed.
- Git repository is clean.
- Code has been pushed to a new GitHub repository under `alief1150`.

## Agent operating rules
- Do not stop after planning or scaffolding.
- Do not leave TODOs for core functionality.
- Run checks after each major phase.
- Fix errors before continuing.
- Keep permissions minimal.
- Prefer maintainable code over clever code.
- Avoid random Google Meet CSS class names as the only DOM selector.
- Keep Google Meet-specific parsing separate from generic transcript logic.
- Record important implementation decisions in `DEVLOG.md`.

## Status tracking
Create and maintain `DEVLOG.md` in the repository root with:
- current phase
- completed work
- tests run
- issues found
- fixes applied
- remaining work

At the end of each phase, update `DEVLOG.md` before moving on.
