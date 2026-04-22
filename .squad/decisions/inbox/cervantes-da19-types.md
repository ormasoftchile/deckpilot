# DA-19 — Recording Settings in Sidecar Types

**Author:** Cervantes  
**Date:** 2025-07-23  
**Status:** ✅ Done — 788 tests passing, committed `c6e2042`

## New Fields Added

### SidecarRecording

| Field | Type | Notes |
|---|---|---|
| `outputDir?` | `string` | Where to write the recorded video file |
| `format?` | `string` | Container format — `'mp4'`, `'webm'`, etc. |
| `codec?` | `string` | Video codec — `'h264'`, `'vp9'`, etc. |
| `framerate?` | `number` | Frames per second |
| `windowScope?` | `'focused' \| 'screen'` | What to capture |

### SidecarExport

| Field | Type | Notes |
|---|---|---|
| `outputDir?` | `string` | Where to write export artifacts |
| `srtFormat?` | `'srt' \| 'vtt'` | Subtitle format — constrained union |
| `voiceScript?` | `boolean` | Whether to export the voice script |

## Naming Decisions

- `windowScope` preferred over `captureScope` or `recordScope` — mirrors the project lexicon where "window" consistently refers to the VS Code window capture target (see `windowX/Y/Width/Height` template variables, `getWindowBounds()`).
- `srtFormat` preferred over `subtitleFormat` — `subtitles` field already exists on the same interface; `srtFormat` is more specific and avoids ambiguity. `'vtt'` included because WebVTT is the browser-native format and likely export target.
- `format` and `codec` kept as plain `string` (not constrained union) — ffmpeg accepts dozens of values; a closed union would be premature and require constant maintenance. Consumers validate at runtime.
- `framerate` as `number` (not `string`) — numeric math is needed for ffmpeg command interpolation (`{{framerate}}`).

## What Was Not Added

- `audioCodec`, `audioBitrate`, `videoBitrate` — deferred. DA-19 scope is structural fields only; bitrate tuning belongs to a later DA.
- `startDelay` — deferred; runtime concern, not a type decision.
