# tuhclip — Mandatory OpenCode Skills Policy

This file is mandatory for every OpenCode session working on the `tuhclip` repository.

OpenCode must read and follow this file before starting implementation, refactoring, documentation, release, or GitHub work.

## Required Skills

The following skills are mandatory:

1. `antislop`
2. `superpower`
3. `antislop-copywriting`

Do not proceed with tuhclip work until the required skills have been loaded and applied.

---

## 1. `antislop`

Use `antislop` for all implementation work.

This applies to:

- TypeScript
- React
- Chrome Manifest V3
- content scripts
- background service worker
- session management
- IndexedDB
- transcript reconciliation
- speaker-turn logic
- reconnect logic
- multi-session support
- coss ui integration
- tests
- build configuration
- refactoring
- debugging

Requirements:

- Prefer simple, maintainable, production-oriented code.
- Avoid unnecessary abstractions.
- Avoid speculative architecture.
- Avoid duplicated logic.
- Avoid placeholder implementations for core features.
- Avoid large rewrites unless the current architecture genuinely requires one.
- Preserve existing working behavior unless a change is necessary.
- Inspect the repository before implementing.
- Reuse existing utilities, types, patterns, and components when appropriate.
- Keep Google Meet-specific DOM logic isolated from generic transcript/session logic.
- Keep UI state separate from capture/session lifecycle.
- Keep per-meeting state isolated in multi-session workflows.
- Do not introduce dependencies unless they provide clear value.
- Do not generate verbose or artificial comments that merely restate the code.
- Do not leave dead code, unused imports, obsolete components, or abandoned implementations after a refactor.
- Run tests, typecheck, and build after meaningful changes.

The goal is code that feels intentionally engineered rather than AI-generated.

---

## 2. `superpower`

Use `superpower` as the primary development workflow and problem-solving discipline.

For every non-trivial task:

1. Inspect the current repository state.
2. Understand the existing implementation before modifying it.
3. Identify the actual root cause instead of guessing.
4. Plan the smallest coherent implementation.
5. Implement incrementally.
6. Validate the changed behavior.
7. Run relevant tests.
8. Run typecheck.
9. Run production build.
10. Cross-check browser/extension behavior when applicable.
11. Review the diff before committing.
12. Commit and push only after the phase is stable.

When debugging:

- Trace the complete data flow.
- Do not repeatedly patch symptoms.
- Distinguish parser, transcript engine, session manager, storage, messaging, and UI failures.
- Use logs and reproducible tests to identify the failing layer.
- Preserve known-good behavior while fixing the failing layer.

For Chrome Extension work, reason through the complete path when relevant:

```text
Google Meet DOM
→ Content Script
→ Caption Parser
→ Transcript / Speaker-Turn Engine
→ Runtime Messaging
→ Background Session Manager
→ IndexedDB
→ Side Panel
```

For multi-session work, verify session isolation explicitly:

```text
Meet A → Session A → Transcript A
Meet B → Session B → Transcript B
```

There must be no cross-session contamination.

Do not declare a task complete merely because code compiles.

Completion requires behavior verification appropriate to the task.

---

## 3. `antislop-copywriting`

Use `antislop-copywriting` for all user-facing and repository-facing writing.

It is mandatory for:

- `README.md`
- `CHANGELOG.md`
- GitHub repository description
- release notes
- GitHub commit messages
- PR titles/descriptions if used
- documentation
- setup instructions
- feature descriptions
- UI copy when substantial new wording is introduced

Writing requirements:

- Clear
- concise
- specific
- natural
- professional
- technically accurate

Avoid:

- generic AI marketing language
- excessive hype
- empty adjectives
- repetitive summaries
- fake enthusiasm
- unnecessary emoji
- vague phrases such as “powerful”, “seamless”, “revolutionary”, or “next-generation” unless objectively justified
- inflated README sections
- commit messages that do not describe the actual change

### README

README copy must explain the product plainly.

Prefer statements such as:

> tuhclip is a Chrome extension that saves Google Meet live captions as structured local transcripts.

Avoid copy such as:

> tuhclip is a revolutionary AI-powered productivity solution that transforms your meeting experience.

README must clearly distinguish current features from roadmap features.

Do not claim:
- audio recording if it does not exist
- custom speech-to-text if it does not exist
- cloud AI if it does not exist
- automatic caption control before it is implemented
- language selection before it is implemented

### Git commit messages

Commit messages must be concise and reflect the actual diff.

Preferred examples:

```text
feat: add multi-session meeting tracking
feat: add smart follow-latest scrolling
fix: prevent duplicate caption replay after reconnect
fix: keep transcript capture active while viewing history
refactor: isolate per-meeting session state
test: cover multi-session transcript isolation
docs: update multitasking workflow
chore: release tuhclip v0.3.0
```

Avoid vague messages such as:

```text
update stuff
fix things
improve project
major improvements
final changes
```

Use Conventional Commit-style prefixes where appropriate.

---

# Mandatory Workflow

At the start of every OpenCode session:

1. Read this file.
2. Load/use:
   - `antislop`
   - `superpower`
   - `antislop-copywriting`
3. Read the task-specific Markdown files.
4. Inspect git state.
5. Inspect the existing implementation.
6. Continue from the current repository state.

Do not restart tuhclip from scratch.

---

# GitHub and Versioning

For meaningful completed development phases:

1. Run relevant tests.
2. Run typecheck.
3. Run production build.
4. Review `git diff`.
5. Commit using `antislop-copywriting`.
6. Push to the current GitHub branch.
7. Report the commit hash.

Use Semantic Versioning:

```text
MAJOR.MINOR.PATCH
```

Use:
- PATCH for bug fixes and stability work
- MINOR for backward-compatible new features
- MAJOR for breaking/stable-major changes

When a release/version update is required:

- synchronize version sources
- update `CHANGELOG.md`
- use `antislop-copywriting` for release copy
- commit
- push
- report version + branch + commit hash

Never force-push unless explicitly instructed by the repository owner.

---

# Final Rule

These skills are not optional preferences.

For tuhclip work:

```text
implementation / debugging / refactoring
→ antislop + superpower

README / changelog / commits / GitHub copy
→ antislop-copywriting
```

If a required skill cannot be loaded or is unavailable, stop and report that limitation before continuing the task.
