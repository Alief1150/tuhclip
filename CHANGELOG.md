# Changelog

## [0.3.3] - 2026-09-07

### Fixed
- Suppressed unchanged caption-row re-emission in the Meet observer
- Tracked caption rows by explicit sourceId with DOM-identity fallback
- Merged rolling caption windows by word overlap without repetition

## [0.3.2] - 2026-09-07

### Fixed
- Prevented cumulative Google Meet caption updates from duplicating transcript text
- Added Captions Off detection with a grace period and side-panel warning
- Removed side-panel meeting close tied to another tab losing captions
- Made the transcript latest indicator always visible above the viewport edge
- Preserved speaker labels across flicker, casing changes, and temporary label loss
- Made speaker comparison case-insensitive in the transcript engine and turn aggregator

### Changed
- Improved meeting and history titles with Meet-code fallback

## [0.3.1] - 2026-09-06

### Added
- GitHub Actions CI validation on push and pull request
- Automated tagged GitHub Releases with an installable Chrome extension archive
- SHA-256 checksum for the release archive
- MIT License
- Open-source release documentation in release/README.md

### Changed
- Documented release and installation workflow in README.md

## [0.1.0] - 2026-09-06

### Added
- Smart Follow Latest transcript scrolling with per-meeting unread counts
- Background transcription across tab changes with Transcribing in background status
- Multi-session Google Meet support with per-meeting transcript isolation
- Active meeting selector and Open Meet tab navigation
- Independent per-session reconnect handling with a 10-minute resume window
- Heartbeat-driven session liveness tracking in the background

### Changed
- Live and History views no longer control the capture lifecycle
- Meeting sessions are isolated by meeting identity in background, storage, and UI
- Meeting resume window is 10 minutes; expired sessions start a new history entry

### Fixed
- Test-only DOM helper now supports closest() for button-ancestor filtering
- Side panel adopts the live meeting on open instead of waiting for a new one
