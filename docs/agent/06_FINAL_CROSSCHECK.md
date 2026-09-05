# Phase 6 — Final Cross-Check

## Goal
Perform a release-style review from scratch before publishing the repository.

Do not treat previous successful runs as sufficient. Re-check the final working tree.

## 1. Clean install check
If practical:
- remove generated dependency/build artifacts as appropriate
- reinstall dependencies from lockfile
- rebuild from a clean state

Do not delete source assets or user-created branding.

## 2. Required commands
Run the repository's final equivalents of:

```text
install
lint
typecheck
test
build
```

Every required command must pass.

## 3. Manifest audit
Verify:
- Manifest V3
- correct service worker path
- correct content script path
- correct side panel path
- host restricted to `https://meet.google.com/*`
- minimal permissions
- no invalid file paths

## 4. Build-output audit
Identify the exact folder Chrome should load as unpacked.
Verify that folder contains the final manifest and all referenced assets.

## 5. Core transcript audit
Cross-check implementation against these invariants:

- MutationObserver event != transcript record.
- Active partial caption is updated in place.
- Finalized segment is persisted once.
- Same repeated DOM event cannot duplicate a record.
- Same sentence may still be stored again later if genuinely repeated outside dedupe window.
- speaker change finalizes previous segment.
- timestamps come from local browser time.

## 6. Data audit
Verify:
- IndexedDB schema is stable
- history reads stored meetings correctly
- export output matches stored transcript
- empty/corrupt states fail safely

## 7. Privacy audit
Search source for suspicious features/permissions.
There must be no:
- `tabCapture`
- microphone capture
- external STT calls
- transcript upload
- analytics SDK

## 8. Documentation audit
README must clearly contain:
- product description
- privacy model
- install/build instructions
- Chrome Load Unpacked steps
- captions must be turned on manually
- known limitations
- architecture overview
- roadmap

## 9. Repository hygiene
Before GitHub:
- verify `.gitignore`
- remove secrets
- remove temporary test files
- remove accidental large artifacts
- remove local environment files that should not be committed
- ensure no API keys/tokens exist

Run secret-oriented searches for patterns such as:
- `ghp_`
- `sk-`
- `AIza`
- `token=`
- `apiKey`

Do not print actual secrets in logs.

## 10. Final report
Append a `FINAL_CHECK.md` containing:
- final status
- commands executed
- test results
- build folder for Load Unpacked
- known limitations
- exact Git commit hash after release commit

Only proceed to Phase 7 if the final cross-check passes.
