# Kickoff Prompt for OpenCode

Run this from a fresh OpenCode session at the `tuhclip` repository root:

```text
Read the task files inside docs/oc-multitasking in this exact order:

1. 00_MASTER.md
2. 01_SMART_FOLLOW_LATEST.md
3. 02_BACKGROUND_AND_VIEW_INDEPENDENCE.md
4. 03_MULTI_SESSION_FOUNDATION.md
5. 04_RECONNECT_PER_SESSION.md
6. 05_OPEN_MEET_AND_SESSION_UX.md
7. 06_TESTING_VERSION_RELEASE.md

Execute them sequentially.

Rules:
- Continue the existing tuhclip repository. Do not rebuild from scratch.
- Inspect git status, branch, remote, current version, and current architecture before changes.
- Preserve the current caption parser, reconciliation, deduplication, speaker-turn logic, IndexedDB history, exports, coss ui, and Manifest V3 behavior unless a change is genuinely necessary.
- Do not implement automatic caption activation, language selection, custom STT, or audio capture in this phase.
- After each stable phase, run relevant checks, commit, and push to the current GitHub branch so GitHub continuously reflects development progress.
- Never force push or discard unrelated user changes.
- Use Semantic Versioning.
- The final combined update must increment the current MINOR version, update CHANGELOG.md, pass the full quality gate, commit, push, and report version + branch + commit hash.
- If a phase introduces or exposes a bug, fix it before proceeding.
- Do not claim completion until the multi-session/browser workflow has been cross-checked.
```
