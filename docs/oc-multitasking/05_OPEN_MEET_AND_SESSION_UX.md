# 05 — Open Meet + Multi-Session UX

## Goal

Add compact UX for returning to the correct Meet tab and selecting an active session.

## Open Meet

Each active session stores:
- tabId
- windowId

Provide a compact action:

`Open Meet ↗`

When clicked:
1. activate the corresponding Meet tab
2. focus its Chrome window if necessary

Use appropriate Chrome APIs, e.g.:
- chrome.tabs.update
- chrome.windows.update

Do not create a new tab.

If the target tab no longer exists:
- handle gracefully
- update session state
- do not throw an uncaught error

## Multi-session selector

If active count == 1:
- avoid a large selector

If active count > 1:
- show compact selector

Example:

```text
● 2 meetings active ▾
```

Dropdown:

```text
● Kelas Jaringan
  aaa-bbbb-ccc

● Weekly Team Meeting
  ddd-eeee-fff
```

Selecting a meeting:
- only changes displayed session
- does not stop capture in other sessions
- does not reassign transcript ownership

## Status labels

Use compact states such as:
- ● Transcribing
- ● Transcribing in background
- ○ Reconnecting
- ○ Waiting for captions
- 2 meetings active

Avoid oversized cards.

## Smart Follow integration

Session switching must work with Smart Follow Latest:
- each meeting keeps correct new-count/follow state
- switching sessions does not cause a wrong unread count
- Latest button always belongs to the displayed session

## UI stack

Use existing coss ui primitives and tuhclip visual identity:
- warm cream/off-white
- near-black text
- muted green accent
- compact sidepanel
- centralized design tokens

## Tests

1. Open Meet A -> tab A active
2. Open Meet B -> tab B active
3. Missing target tab -> graceful state
4. Session selector appears only when needed
5. Switching session does not stop capture
6. Follow/latest state does not leak

## Git checkpoint

```bash
git add -A
git commit -m "feat: add meeting selector and open-meet navigation"
git push
```
