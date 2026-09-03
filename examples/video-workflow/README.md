# Video Workflow Example

This example walks through the complete local workflow on Windows:

1. Deckpilot creates a provisional cue scaffold and opens srt-dubber.
2. You record and review every narration take before presentation capture.
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
3. Run **Deckpilot: Start Presentation**.
4. Keep that VS Code window focused and run **Deckpilot: Auto-Record Deck**.
5. In srt-dubber, record each cue and review or redo takes as needed.
6. Quit srt-dubber after every cue has a take. Deckpilot then performs capture,
   retiming, resync, and final assembly automatically.

After narration is prepared, the presentation enters Zen Mode and the recorder
crops the VS Code window to a centered 16:9 frame.

The example disables treating arbitrary Markdown as a deck, so accidentally
running Auto-Record from this README cannot create an empty narration session.

Everything for the run is kept under:

```text
recordings/video-workflow/<timestamp-session>/
  session-*.mp4          raw recoverable screen capture
  video-workflow.mp4     slides with the original source clip inserted
  narration.srt          final narration text and capture timestamps
  narration-project.json
  recording-session.json
  voiceover-script.md
  voiceover-script.json
  takes/
  processed/
  output/narration-dubbed.mp4  final narrated video
```

The video item uses `audio: duck`, so its tone is retained quietly underneath
narration. Change it to `mute` or `preserve` to compare the other policies.
