# Release builds

GitHub Releases are the official downloadable tuhclip builds.

The `dist/` directory is intentionally not committed. Source code is the
source of truth. Installable Chrome extension archives are published as
release assets.

## Version and tag convention

Versions use Semantic Versioning (`MAJOR.MINOR.PATCH`):

- PATCH for bug fixes and stability work
- MINOR for backward-compatible new features
- MAJOR for breaking changes

A release is published by pushing a tag named `vX.Y.Z`, for example
`v0.1.1`. The tag must match `package.json` and the built
`dist/manifest.json`, otherwise the release workflow fails instead of
publishing a mismatched build.

## Maintainer release flow

```text
implementation
→ tests
→ version bump (package.json + manifest version source)
→ CHANGELOG
→ commit
→ push
→ tag vX.Y.Z
→ push tag
→ GitHub Actions validates, packages, and publishes the GitHub Release
```

Concretely, for version 0.1.1 from the implementation branch:

```bash
npm run typecheck
npm test
npm run build
git add -A
git commit -m "chore: release tuhclip v0.1.1"
git push origin implementation/tuhclip-mvp
git tag v0.1.1
git push origin v0.1.1
```

Then verify the Actions run, the Release page, and the attached
`tuhclip-v0.1.1-chrome.zip` asset.

## Installing a release

1. Download `tuhclip-vX.Y.Z-chrome.zip` from the release page
2. Extract the archive
3. Open `chrome://extensions`
4. Enable Developer mode
5. Click `Load unpacked`
6. Select the extracted tuhclip folder
7. Open Google Meet, turn captions (CC) on manually, and use tuhclip

The archive optionally ships with a `.sha256` checksum file. Verify it
with:

```bash
sha256sum -c tuhclip-vX.Y.Z-chrome.zip.sha256
```
