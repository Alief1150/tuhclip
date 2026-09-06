# 06 — Final Testing, Versioning, Changelog, GitHub Release

## Automated quality gate

Run the project-equivalent commands for:
- typecheck
- unit/integration tests
- production build
- extension build verification

Fix all failures caused by this update.

## Real-browser cross-check

Test this sequence:

1. Open Meet A
2. Start transcription
3. Open Meet B
4. Start transcription
5. Speak in A
6. Speak in B
7. Verify transcript isolation
8. Switch to a non-Meet website
9. Verify both sessions still capture
10. Open History
11. Verify capture continues
12. Return to Live
13. Switch A/B via session selector
14. Test Open Meet A
15. Test Open Meet B
16. Scroll A upward
17. Generate new transcript
18. Verify `↓ X new`
19. Click Latest
20. Disconnect A
21. Verify B stays active
22. Reconnect A
23. Verify same meetingId
24. Verify no reconnect duplicate
25. Export A and B
26. Verify exports do not cross-contaminate

## Version bump

Inspect current version first.

This feature pack adds user-facing capabilities, so increment MINOR.

Example:

```text
0.2.4 -> 0.3.0
```

Do not reset or hardcode the version.

Keep synchronized:
- package.json
- manifest.json
- any other version source used by the project

## CHANGELOG.md

Add a release entry like:

```md
## [NEXT_VERSION] - 2026-09-06

### Added
- Smart Follow Latest transcript scrolling
- Background transcription across tab changes
- Multi-session Google Meet support
- Active meeting selector
- Open Meet action
- Independent per-session reconnect handling

### Changed
- Live/History views no longer control capture lifecycle
- Meeting sessions are isolated by meeting identity

### Fixed
- Any relevant bugs discovered during implementation
```

Adjust to match actual implementation.

## Final Git procedure

Review:

```bash
git status
git diff
git diff --stat
```

Then:

```bash
git add -A
git commit -m "chore: release tuhclip v<VERSION>"
git push
```

Never force push.

Verify:

```bash
git status
git branch --show-current
git rev-parse HEAD
git log --oneline -5
```

## Final report

Report:

```text
tuhclip version:
branch:
commit:
GitHub push:

Features:
- Smart Follow Latest
- Background transcription
- Live/History independence
- Open Meet
- Multi-session foundation
- Per-session reconnect

Typecheck:
Tests:
Build:
Extension verification:

Known limitations:
```

Stop after this release report.

Do not begin Auto Caption Controller or Language Selector in this task.
