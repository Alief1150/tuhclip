# Phase 7 — Git Finalization and GitHub Publish

## Goal
Create a clean Git history, create a new GitHub repository under `alief1150`, push the finalized project, and verify the remote repository.

The machine is expected to already be authenticated with GitHub CLI (`gh`).

## Safety rule
Do not overwrite or force-push an unrelated remote repository.

## 1. Confirm authentication
Run:

```bash
gh auth status
```

If authentication is valid, continue.
If not, stop and report the exact issue.

## 2. Inspect Git state
Run:

```bash
git status
git remote -v
```

If Git is not initialized:

```bash
git init
```

## 3. Repository hygiene before commit
Re-run:
- tests
- typecheck
- build

Then inspect:

```bash
git status
```

Do not commit:
- `.env`
- secrets
- API tokens
- local caches
- dependency directories
- generated temporary logs

## 4. Commit final MVP
Create a clean final commit, for example:

```bash
git add .
git commit -m "feat: build tuhclip Google Meet transcript MVP"
```

If prior meaningful commits already exist, preserve them.

## 5. GitHub repository target
Preferred repository name:

```text
alief1150/tuhclip
```

Check whether it already exists:

```bash
gh repo view alief1150/tuhclip
```

### If it does not exist
Create a **private** repository by default for safety:

```bash
gh repo create alief1150/tuhclip --private --source=. --remote=origin --push
```

If the repository should be public, change `--private` to `--public` only when explicitly intended.

### If it already exists
Do not blindly overwrite it.
Inspect the remote and only use it if it clearly belongs to this project.

## 6. Push
If the remote exists and is correct:

```bash
git push -u origin HEAD
```

## 7. Verify GitHub
Run:

```bash
gh repo view alief1150/tuhclip --web=false
```

Verify:
- repository exists
- default branch is present
- latest commit is pushed

## 8. Record release state
Update `FINAL_CHECK.md` with:
- repository name
- remote URL
- branch
- final commit hash
- build folder to load in Chrome

Commit the documentation update if necessary and push again.

## Final response expected from the coding agent
Report only after successful publish:
- what was built
- test/build status
- exact Chrome Load Unpacked directory
- GitHub repository name
- final commit hash
- any known limitations

Do not claim the repo was pushed unless GitHub CLI verification succeeds.
