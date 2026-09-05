# Phase 5 — Testing and Hardening

## Goal
Stress-test the MVP, fix edge cases, and reduce fragility before final release checks.

## Functional checks
Verify all of the following:

### Google Meet lifecycle
- open Meet page
- captions initially off
- captions turned on manually
- transcript starts
- captions turned off
- current active segment finalizes safely
- captions turned on again
- transcription resumes
- user navigates within Meet SPA
- observer reattaches without duplicate listeners

### Speaker changes
Test rapid speaker switching.
Confirm previous active segment finalizes once.

### Progressive caption updates
Ensure text evolution replaces active text instead of appending records.

### Duplicate resistance
Simulate repeated identical DOM observations.
No duplicate finalized segments should be created.

### Side panel lifecycle
- open late after transcription already started
- close during meeting
- reopen during meeting
- reopen after meeting

Expected: persisted transcript remains intact.

### Meeting end
Ensure active segment is finalized when possible and meeting metadata is closed cleanly.

## Performance checks
- MutationObserver should not trigger expensive full-page scans continuously.
- No duplicate observers.
- No runaway intervals/timeouts.
- Clean up event listeners.
- Keep recent dedupe cache bounded.

## Permissions review
Confirm there are no unnecessary permissions.
Specifically verify absence of:
- microphone
- tabCapture
- desktopCapture

## Privacy review
Confirm:
- no analytics
- no external API calls
- no cloud upload
- no audio capture

## Error handling
No uncaught exceptions for:
- missing speaker
- missing caption container
- disappearing nodes
- observer restart
- empty transcript
- corrupt/empty IndexedDB result

## Browser console review
During a realistic test session:
- inspect content-script console
- inspect service-worker console
- inspect side-panel console

Fix errors and significant warnings.

## Build quality
Run all available:
- tests
- typecheck
- lint
- production build

No known core-feature failures may remain.

Update `DEVLOG.md` with every significant bug found and its fix.
