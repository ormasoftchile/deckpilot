# Video Workflow Example

This example walks through the complete local workflow on Windows:

1. Deckpilot creates or updates a persistent cue project from the deck files.
2. You record only pending narration takes before presentation capture.
3. Deckpilot measures the processed takes and uses those durations to render the
  opening slide, play `clips/execution-demo.mp4`, and render the closing slide.
4. Auto-Record replaces the captured playback interval with the source clip.
5. Deckpilot writes the real capture timestamps back to the SRT, resyncs the
  recorded takes, and assembles the final narrated video.

## Prerequisites

- ffmpeg and ffprobe on `PATH`
- Deckpilot built from this repository
- srt-dubber built at `../srt-dubber/build/Release/srt-dubber.exe` relative to
  the two sibling repositories

Build srt-dubber once if needed:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ..\..\..\srt-dubber\scripts\build-windows.ps1
```

## Run the example

1. Open `video-workflow.code-workspace` in the Extension Development Host. When
   developing Deckpilot, open this repository and press `F5`, then open the
   example workspace in the new window.
2. Open `video-workflow.deck.md`.
3. Run **Deckpilot: Record or Update Narration**. No presentation needs to be running.
4. In srt-dubber, record pending cues and review or redo takes as needed, then quit.
5. Keep the deck editor active and run **Deckpilot: Auto-Record Deck**. Deckpilot
  opens presentation mode automatically before capture.

The recorder preserves the VS Code window's aspect ratio and trims at most one
pixel from each dimension for video codec compatibility.

The example disables treating arbitrary Markdown as a deck, so accidentally
running Auto-Record from this README cannot create an empty narration session.

Everything for the run is kept under:

```text
recordings/video-workflow/narration/
  narration.srt
  narration-project.json
  takes/                    reusable raw takes
  processed/                reusable processed takes
recordings/video-workflow/<timestamp-session>/
  session-*.mp4          raw recoverable screen capture
  video-workflow.mp4     slides with the original source clip inserted
  video-workflow.srt     final narration text and capture timestamps
  video-workflow-project.json
  recording-session.json
  voiceover-script.md
  voiceover-script.json
  output/video-workflow-dubbed.mp4  final narrated video
```

After changing the deck, run **Record or Update Narration** again. Unchanged cue
text keeps its take; only added or edited cues become pending.

The video item uses `audio: duck`, so its tone is retained quietly underneath
narration. Change it to `mute` or `preserve` to compare the other policies.
