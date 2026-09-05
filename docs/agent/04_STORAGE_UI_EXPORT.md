# Phase 4 — Storage, Side Panel, History, and Export

## Goal
Persist finalized transcript data locally and provide a usable `tuhclip` side panel with live transcript, history, and export.

## IndexedDB
Create a clean IndexedDB abstraction.

Recommended stores:
- `meetings`
- `segments`
- `settings`

Do not write every character mutation to IndexedDB.
Keep active captions in memory and persist finalized segments.

## Meeting session model
When transcription actually begins, create a session such as:

```ts
interface MeetingSession {
  id: string;
  title: string;
  meetUrl: string;
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  createdAt: number;
}
```

Try to derive a useful title from Google Meet when possible.
Fallback:

```text
Google Meet - YYYY-MM-DD HH:mm
```

## Side panel UI
Keep it compact, modern, and fast.

Suggested layout:

```text
tuhclip
● Listening
Google Meet

Live Transcript

19:32  Alief Athallah
Saya ingin bertanya mengenai jaringan.

19:33  Mahdi
Silakan.
```

### UI states
Support:
1. not on Google Meet
2. Google Meet detected
3. waiting for captions
4. transcribing
5. meeting ended / idle
6. empty transcript
7. saved transcript
8. viewing history

### Active caption rendering
The current in-progress caption may appear live, but UI updates must replace the same active item rather than append duplicates.

## Meeting history
Show:
- title
- date
- start time
- duration
- segment count

Allow opening a previous transcript.

## Export
Implement:
- TXT
- Markdown
- JSON

### Markdown format example

```md
# Meeting Title

Date: 4 September 2026
Started: 19:30

## Transcript

**[00:01:21] Alief Athallah**  
Saya ingin bertanya mengenai jaringan.

**[00:01:30] Mahdi**  
Silakan.
```

### JSON
Preserve structured meeting metadata + transcript segment fields.

## Persistence resilience
Verify transcript survives:
- side panel close/reopen
- normal Meet page interaction
- extension UI reload

## Verification before Phase 5
Run:
- tests
- typecheck
- build

Manually verify side panel, history, and all exports.
Update `DEVLOG.md`.
