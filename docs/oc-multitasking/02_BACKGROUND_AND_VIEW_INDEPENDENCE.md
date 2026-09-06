# 02 — Background Transcription + Live/History Independence

## Goal

Transcription must continue when the user:
- switches Chrome tabs
- browses other websites
- opens History in the side panel
- closes/reopens the side panel

## Background transcription

Capture must not depend on the active browser tab.

Example:

```text
Tab 1 = Google Meet
Tab 2 = Google Docs
Tab 3 = ChatGPT
```

If the user switches to Tab 2, this pipeline must continue:

```text
Google Meet Content Script
→ Background Session Manager
→ IndexedDB
```

Do not stop capture because:
- active tab changed
- side panel is showing another page
- browser focus changed

## Live / History independence

React UI must not control capture lifecycle.

Correct:

```text
Caption Capture
→ Background Session Manager
→ IndexedDB
→ Side Panel
```

Incorrect:

```text
Live selected -> start capture
History selected -> stop capture
```

Scenario:
1. meeting active
2. user opens History
3. current meeting gets new captions
4. data keeps persisting
5. user returns to Live
6. latest transcript appears immediately

## Side panel reopen

If side panel opens after a meeting already started:
- load active sessions from background
- subscribe to session updates
- load transcript from storage
- do not create a new meeting session merely because UI opened

## Status

If user is browsing a non-Meet tab while a meeting is active, show something like:

`● Transcribing in background`

Do not show a misleading “Not on Google Meet” state when an active session exists.

## Tests

1. Switch away from Meet -> capture remains active
2. Live -> History -> transcript still persists
3. History -> Live -> latest transcript appears
4. Close/reopen side panel -> same session
5. UI reopen does not create duplicate session

## Git checkpoint

```bash
git add -A
git commit -m "feat: keep transcription independent from active tab and sidepanel view"
git push
```
