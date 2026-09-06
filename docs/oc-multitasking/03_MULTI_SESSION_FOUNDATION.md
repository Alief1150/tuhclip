# 03 — Multi-Session Foundation

## Goal

Support multiple simultaneous Google Meet tabs without transcript collision.

## Critical rule

Do not use one browser-wide singleton such as:

```ts
currentMeeting
currentMeetingId
currentTranscript
```

Background must store a collection such as:

```ts
Map<meetingId, MeetingSession>
```

or an equivalent architecture.

## MeetingSession minimum

```ts
interface MeetingSession {
  meetingId: string
  meetCode: string
  meetUrl: string
  tabId: number
  windowId: number
  title: string
  startedAt: number
  lastSeenAt: number
  disconnectedAt?: number
  reconnectCount: number
  status: "active" | "disconnected" | "ended"
}
```

## Message identity

Every meeting-related message must carry enough identity.

At minimum:
- meetingId
- meetCode
- tabId where relevant

Never route transcript data based on whichever tab is currently active.

## Isolation example

Meet A:

```text
meetCode = aaa-bbbb-ccc
tabId = 101
meetingId = meeting-A
```

Meet B:

```text
meetCode = ddd-eeee-fff
tabId = 202
meetingId = meeting-B
```

Input:

```text
A -> "hello A"
B -> "hello B"
```

Expected:

```text
meeting-A = hello A only
meeting-B = hello B only
```

Zero cross-session contamination.

## IndexedDB

Ensure records can be reliably queried by `meetingId`.

If an index/schema adjustment is needed:
- migrate safely
- do not destructively reset user data
- document the migration

## Session selector

If only one meeting is active:
- keep UI simple

If 2+ are active:
- show a compact selector such as:

`● 2 meetings active ▾`

Selecting a session changes only which transcript is displayed.

Other sessions must continue capturing.

## Active-tab UX

Preferred:
- Meet A -> Meet B: side panel may auto-select B
- Meet -> non-Meet site: keep the last selected meeting
- manual selection must always be available

Avoid unpredictable automatic switching.

## Tests

1. A + B active simultaneously
2. A transcript only in A
3. B transcript only in B
4. Selecting A/B does not stop the other
5. IndexedDB filtering by meetingId is correct
6. Export A contains no B data
7. Export B contains no A data

## Git checkpoint

```bash
git add -A
git commit -m "feat: add multi-session meeting architecture"
git push
```
