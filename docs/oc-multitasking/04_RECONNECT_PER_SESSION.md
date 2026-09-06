# 04 — Reconnect Per Session

## Goal

Reconnect behavior must be independent for every meeting.

Example:

```text
Meet A = active
Meet B = active
```

If A disconnects:

```text
A = disconnected
B = active
```

Never globally disconnect all meetings.

## Resume window

Use a configurable constant such as:

```ts
SESSION_RESUME_WINDOW_MS = 10 * 60 * 1000
```

If the user returns to the same `meetCode` inside the window:
- reuse meetingId
- reuse original startedAt
- increment reconnectCount
- restore active state
- do not create a duplicate history entry

## Temporary disconnect cases

Handle:
- refresh
- accidental leave
- tab close + reopen
- temporary connection loss
- Meet internal navigation/reload

Do not mark a session ended immediately from page unload alone.

## Per-session heartbeat

Each Meet content script should send session-aware heartbeat data:

```ts
{
  type: "MEET_HEARTBEAT",
  meetingId,
  meetCode,
  timestamp
}
```

Background tracks heartbeat independently.

Missing heartbeat A must not affect B.

## Reconnect deduplication

On resume:
- restore enough recent transcript/dedupe state
- suppress captions replayed immediately after reconnect

Example:

Before reconnect:

`Alief: jadi tugas dikumpulkan besok`

After reconnect Meet re-renders the same caption.

Expected:
- one transcript occurrence

## Unfinished active caption

If disconnect happens while a caption is active:
- finalize/persist safely
- do not silently lose the last segment

## End semantics

A session is considered ended when:
- an explicit end path is known, or
- resume window expires without reconnect

History must remain intact.

## Tests

1. A disconnect -> B stays active
2. A reconnect within window -> same meetingId
3. A reconnect after window -> new session
4. Caption replay after reconnect -> no duplicate
5. Refresh -> same session
6. Content script re-init -> no duplicate observer/session

## Git checkpoint

```bash
git add -A
git commit -m "feat: add independent per-session reconnect handling"
git push
```
