# tuhclip

Local Google Meet caption transcripts in the Chrome side panel.

`tuhclip` reads the live captions you already turned on in Google Meet,
reconciles the noisy progressive text into clean speaker turns, stores
everything locally in your browser, and shows the result in a Chrome
side panel with live follow mode, meeting history, and TXT, Markdown,
and JSON export.

It keeps capturing while you browse other tabs, supports several Meet
meetings at once with per-meeting sessions, and reconnects to the same
session when a Meet tab reloads within a few minutes.

## Privacy model

- All transcript data stays local in the browser (IndexedDB).
- No microphone recording, no tab or system audio capture.
- No speech-to-text services, no cloud upload, no analytics.
- Permissions are minimal: `sidePanel` plus `scripting` (used only to
  re-attach the caption reader when a Meet tab misses it), scoped to
  `https://meet.google.com/*`.
- You must turn Google Meet captions on manually. `tuhclip` never
  clicks Meet controls for you.

## Installation

The easiest install uses a published build:

1. Download `tuhclip-vX.Y.Z-chrome.zip` from
   [GitHub Releases](https://github.com/Alief1150/tuhclip/releases).
2. Extract the archive.
3. Open `chrome://extensions`, enable Developer mode.
4. Choose "Load unpacked" and select the extracted folder.
5. Open a Google Meet tab, turn captions on, then click the
   `tuhclip` toolbar button to open the side panel.

## Releases

Installable builds live on the Releases page. Each release attaches a
`tuhclip-vX.Y.Z-chrome.zip` archive plus a `.sha256` checksum. See
`release/README.md` for the maintainer release flow.

## Development / build from source

Requirements: Node.js 20 or later, npm.

```bash
npm install
npm test
npm run typecheck
npm run build
```

Then load the generated `dist/` directory as an unpacked extension
(same Chrome steps as above). `dist/` is never committed; release
archives are built by CI from source.

## Captions must be turned on manually

Google Meet only renders caption text after you enable captions in the
Meet UI. Until then `tuhclip` shows a waiting state and records
nothing.

## Known limitations

- Google Meet only (V1 scope).
- Requires captions enabled; silent meetings produce no transcript.
- Speaker names come from Meet caption markup and fall back to
  `Unknown speaker` when Meet does not expose a name.
- Meet DOM changes can require selector updates in
  `src/platforms/googleMeet/selectors.ts`.
- Live end-to-end verification needs a real Meet session and was not
  possible in headless environments.

## Architecture overview

```text
Google Meet DOM
      ↓
platforms/googleMeet  (MutationObserver, selectors, parser)
      ↓
transcript/           (normalization, reconciliation, dedupe)
      ↓
content script        (one engine per page, finalized segments only)
      ↓
background relay      (typed runtime messages, active-tab scoped)
      ↓
side panel            (live view, IndexedDB history, exports)
```

- `src/platforms/googleMeet/` isolates all Meet-specific DOM logic.
- `src/transcript/` is generic: progressive caption updates refine one
  active segment in place; only finalized segments persist.
- `src/storage/` is a small IndexedDB layer (`meetings`,
  `segments`, `settings`).
- `src/export/` renders TXT, Markdown, and JSON offline.
- `src/shared/messages.ts` validates every runtime message boundary.

## Roadmap

These are plans, not current features:

- AI summary and LLM integration (opt-in, local-first).
- Zoom and Microsoft Teams adapters behind the same engine.
- Login, cloud sync, subscription, and remote backend (all non-goals
  for V1, architected so the transcript engine does not need rewrites).

## License

tuhclip is open-source software licensed under the MIT License. See
[LICENSE](LICENSE).
