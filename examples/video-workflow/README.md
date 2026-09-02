# Video Workflow Example

This example walks through the complete local workflow on Windows:

1. Deckpilot renders the opening slide.
2. It plays `clips/execution-demo.mp4` as a first-class deck item.
3. It renders the closing slide.
4. Auto-Record replaces the captured playback interval with the source clip.
5. Deckpilot opens srt-dubber with the composed MP4 and generated SRT.

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
5. When Auto-Record finishes, choose **Record Narration**.
6. In srt-dubber, record each SRT slot, review the takes, then assemble.

The presentation enters Zen Mode before recording, and the recorder crops the
VS Code window to a centered 16:9 frame.

The example disables treating arbitrary Markdown as a deck, so accidentally
running Auto-Record from this README cannot create an empty narration session.

Everything for the run is kept under:

```text
recordings/video-workflow/<timestamp-session>/
  session-*.mp4          raw recoverable screen capture
  video-workflow.mp4     slides with the original source clip inserted
  video-workflow.srt     narration slots from the sidecar
  recording-session.json
  voiceover-script.md
  voiceover-script.json
  takes/
  processed/
  output/video-workflow-dubbed.mp4  final narrated video
```

The video item uses `audio: duck`, so its tone is retained quietly underneath
narration. Change it to `mute` or `preserve` to compare the other policies.
