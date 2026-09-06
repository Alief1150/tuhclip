# 00 — MASTER: tuhclip Multitasking & Multi-Session Update

## Scope

Continue the existing `tuhclip` repository. Do not rebuild from scratch.

Implement only:

1. Smart Follow Latest
2. Background Transcription
3. Live / History Independence
4. Open Meet
5. Multi-Session Foundation
6. Reconnect Per Session

Do not implement yet:
- automatic Google Meet caption activation
- language selector
- custom STT
- audio/tab/microphone capture
- Whisper
- Google Speech-to-Text
- new SaaS backend

## Preserve

Do not break:
- Google Meet caption reader
- caption reconciliation
- duplicate prevention
- speaker-turn aggregation
- IndexedDB history
- TXT / Markdown / JSON export
- coss ui
- Chrome Manifest V3
- side panel
- background service worker

## Pre-flight

Before changing code:

```bash
git status
git branch --show-current
git remote -v
git log --oneline -5
```

Inspect:
- package.json
- manifest.json
- current app version
- CHANGELOG.md
- session model
- runtime message flow
- side-panel state
- IndexedDB schema

Never discard unrelated working-tree changes without reviewing them.

## Target architecture

```text
Meet A ─┐
        ├─> Content Scripts
Meet B ─┘
              ↓
      Background Session Manager
              ↓
      ┌───────┴───────┐
      ↓               ↓
  Session A       Session B
      ↓               ↓
  IndexedDB       IndexedDB
      └───────┬───────┘
              ↓
          Side Panel
```

Principles:
- active browser tab is not the active meeting session
- Live/History is presentation state only
- one meeting must never affect another
- every transcript message must be associated with the correct meeting identity
- background/session manager is the source of truth

## Versioning

Use Semantic Versioning:

`MAJOR.MINOR.PATCH`

This combined feature update should increment the current MINOR version.

Examples:
- 0.2.4 -> 0.3.0
- 0.7.2 -> 0.8.0

Do not hardcode a version before inspecting the repo.

Keep all version sources synchronized.

## GitHub workflow

After every stable implementation phase:

1. run relevant checks
2. commit with a clear message
3. push to the current GitHub branch

Final phase:
1. final tests
2. bump version
3. update CHANGELOG.md
4. final commit
5. push
6. report branch + version + commit hash

Never force push.
