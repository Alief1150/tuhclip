# OpenCode Kickoff Prompt

Use this prompt after placing the numbered markdown files in the `tuhclip` repository (for example under `docs/agent/`).

```text
You are the lead engineer for the current `tuhclip` repository.

Read `00_MASTER.md` first, then execute every numbered phase document in order through `07_GITHUB_RELEASE.md`.

Rules:
- Inspect the existing repository before editing.
- Do not only explain or plan: implement the project.
- Do not skip phases.
- At the end of every phase, run the required checks, fix errors, and update `DEVLOG.md`.
- The transcript reconciliation and anti-duplicate requirements are critical and must be tested.
- Do not implement audio capture, microphone capture, tabCapture, Whisper, Google Speech-to-Text, cloud upload, or analytics.
- All transcript storage remains local.
- User manually enables Google Meet captions.
- Keep Google Meet DOM parsing isolated from generic transcript logic.
- Before publishing, execute the full final cross-check in `06_FINAL_CROSSCHECK.md` from the final working tree.
- Only after the cross-check passes, execute `07_GITHUB_RELEASE.md`.
- GitHub CLI is expected to be authenticated for user `alief1150`.
- Never overwrite an unrelated GitHub repository.
- Do not claim completion until the build passes and GitHub push is verified.

Start now by reading `00_MASTER.md` and inspecting the repository.
```
