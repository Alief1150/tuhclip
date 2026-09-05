# tuhclip Agent Plan

Structured implementation plan for building the `tuhclip` Chrome extension with an autonomous coding agent.

## Files

- `00_MASTER.md` — scope, constraints, execution order, success criteria
- `01_INITIAL_SETUP.md` — repository setup, Manifest V3, side panel shell
- `02_GOOGLE_MEET_CAPTURE.md` — Google Meet DOM adapter and caption observer
- `03_TRANSCRIPT_ENGINE.md` — progressive caption reconciliation and deduplication
- `04_STORAGE_UI_EXPORT.md` — IndexedDB, UI, history, exports
- `05_TESTING_AND_HARDENING.md` — functional, edge-case, performance, privacy testing
- `06_FINAL_CROSSCHECK.md` — release-style clean verification and security checks
- `07_GITHUB_RELEASE.md` — Git finalization, `gh` repo creation, push, verification
- `KICKOFF_PROMPT.md` — short prompt to give OpenCode after these files are copied into the project

## Suggested location inside project

```text
tuhclip/
  docs/
    agent/
      00_MASTER.md
      01_INITIAL_SETUP.md
      02_GOOGLE_MEET_CAPTURE.md
      03_TRANSCRIPT_ENGINE.md
      04_STORAGE_UI_EXPORT.md
      05_TESTING_AND_HARDENING.md
      06_FINAL_CROSSCHECK.md
      07_GITHUB_RELEASE.md
      KICKOFF_PROMPT.md
```

Then tell OpenCode to read `docs/agent/KICKOFF_PROMPT.md` and execute the plan.

## GitHub visibility
The release plan defaults new repositories to **private** for safety. Change the single `gh repo create` flag to `--public` if the intended repository should be public.
