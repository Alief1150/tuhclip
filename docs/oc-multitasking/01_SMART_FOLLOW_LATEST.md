# 01 — Smart Follow Latest

## Goal

Make transcript scrolling behave like a modern chat app.

## Follow behavior

If the user is already near the bottom of the Live transcript:

`new transcript -> automatically follow latest`

Use a near-bottom threshold around 60–100 px.

Maintain state conceptually like:

```ts
isFollowingLatest
newTranscriptCount
```

If the user intentionally scrolls upward:
- set follow mode to false
- do not force-scroll when new transcript arrives
- increment the new transcript count

Show a compact floating control such as:

`↓ 3 new`

or:

`↓ Latest · 3 new`

When clicked:
- smooth scroll to bottom
- reset newTranscriptCount
- enable follow mode

If user manually returns near bottom:
- resume follow mode
- clear stale new count

## Progressive active captions

An active speaker turn that grows:

```text
halo
halo semua
halo semua selamat datang
```

must update ONE visible transcript item.

Do not append a new row for every MutationObserver update.

If follow mode is active, keep the newest active caption visible.

## Per-session behavior

Follow state and unread/new count must not leak between Meeting A and Meeting B.

Preferred:
- track follow/latest UI state keyed by `meetingId`

## UI

Use the existing coss ui + tuhclip theme.

The floating latest button must:
- be compact
- remain inside the transcript viewport
- not stretch page height
- not cover important transcript content

## Tests

1. At bottom + new transcript -> follows latest
2. Scroll up + new transcript -> viewport unchanged, count increases
3. Click latest -> bottom, count 0, follow enabled
4. Progressive caption -> one item only
5. Switch session -> follow/count state does not leak

## Git checkpoint

```bash
git add -A
git commit -m "feat: add smart follow latest transcript behavior"
git push
```
