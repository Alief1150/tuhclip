# Changelog

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
