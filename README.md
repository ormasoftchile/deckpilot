# Deckpilot

> Formerly Executable Talk. Marketplace/package identifiers still use `executable-talk` for backward compatibility.

Deckpilot is a **programmable deck system** for VS Code.

Write decks in Markdown, attach actions, and use them to:
- present live demos
- automate IDE workflows
- guide onboarding and setup
- record demos into video + narration artifacts

From one deck, you can present, execute, onboard, and produce content.

---

## Why Deckpilot?

Most slide tools show content.
Deckpilot decks can **drive the IDE**, run commands, validate setup, and record what happened — all from the same file.

---

## What's in the box

### 1. Presentation

- Reveal.js-powered full-screen webview; arrow keys + Space navigate slides and fragments
- Fragment animations — explicitly marked elements reveal step-by-step
- Five themes: `dark`, `light`, `minimal`, `contrast` — set in frontmatter
- Slide transitions: `slide` (default) or `fade`
- Non-linear navigation: slide picker (`Ctrl+G`), jump-by-number, go-back (`Alt+Left`), breadcrumb trail
- Presenter View — speaker notes + next-slide preview on a secondary panel
- Undo/redo IDE state during a demo (`Cmd+Z` / `Ctrl+Z`, up to 50 snapshots)
- Floating toolbar — toggle sidebar, panel, terminal, activity bar, Zen Mode

### 2. Execution

Trigger IDE actions directly from slide content:

- `file.open` — open a file in the editor
- `editor.highlight` — highlight specific lines
- `terminal.run` — run a terminal command *(requires Workspace Trust)*
- `debug.start` — launch a debug config *(requires Workspace Trust)*
- `sequence` — chain multiple actions into one click
- `vscode.command` — run any VS Code command *(requires Workspace Trust)*
- `wait.condition` — block until a file exists or a port opens
- YAML action blocks (` ```action `) as a readable alternative to URL-encoded inline links
- Scene checkpoints — save/restore full IDE state (`Ctrl+S` / `Ctrl+R`); pre-authored scenes declared in frontmatter appear in the picker automatically

### 3. Recording & media

Deckpilot can auto-present your deck and coordinate with an external recorder to produce video and narration artifacts.

- First-class video items — place local clips between rendered slides with `:::video`
- Sidecar narration — ordered `slides[].cues[]` keep the talk track out of slide Markdown
- Inline voice cues — `<!-- voice: text -->` and `<!-- voice[N]: text -->` remain supported and take precedence over sidecar cues
- Manual recording — start/stop session; pause/resume timing, retake markers, narration markers
- **Auto-Pilot** — hands-free: drives slides, fragments, and actions at a pace computed from voice cue word count
- External recorder — configure ffmpeg (or any tool) to start/stop automatically via settings
- Exports — paired MP4/SRT files, `voiceover-script.md`, `voiceover-script.json`, and `recording-session.json`

### 4. Onboarding & validation

- `mode: onboarding` in frontmatter options — step counter replaces slide numbers; retry/reset on validation failure
- `validate.command` — verify a CLI tool is installed before proceeding
- `validate.fileExists` — confirm required files are present
- `validate.port` — check that a required service is reachable
- `wait.condition` — block until a condition is met
- Checkpoint markers — `<!-- checkpoint: name -->` captures IDE state; **Reset to Checkpoint** restores on failure
- Preflight validation — catches missing files, bad line ranges, PATH issues, and trust problems at load time

---

## Getting started

Create a `.deck.md` file. Slides are separated by `---`.

```markdown
---
title: My First Deck
author: You
---

# Hello, Deckpilot

This is slide one.

---

## Open a file

[Open main.ts](action:file.open?path=src/main.ts)

---

## Highlight some code

[Show the handler](action:editor.highlight?path=src/main.ts&lines=10-20)

---

## Run a command

[Install dependencies](action:terminal.run?command=npm%20install)
```

Open the file and run **Deckpilot: Start Presentation** from the command palette (`Cmd+Shift+P` / `Ctrl+Shift+P`).

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| `→` / `Space` | Next fragment or slide |
| `←` / `Backspace` | Previous fragment or slide |
| `Shift+→` / `Shift+←` | Skip fragments, jump slide |
| `Home` / `End` | First / last slide |
| `Ctrl+G` / `Cmd+G` | Slide picker |
| `Ctrl+S` / `Cmd+S` | Save scene |
| `Ctrl+R` / `Cmd+R` | Restore scene |
| `Alt+Left` | Go back (history) |
| Digits + `Enter` | Jump to slide number |
| `Cmd+Z` / `Ctrl+Z` | Undo IDE changes |
| `Escape` | Exit presentation |

---

## Example workflow: record a demo

1. Write a `.deck.md` deck and put ordered narration cues in its `.deck.yaml` sidecar
2. Configure an external recorder in VS Code settings (e.g. ffmpeg)
3. Run **Deckpilot: Auto-Record Deck** from the command palette
4. Deckpilot drives the presentation automatically, coordinating with the recorder
5. When done, Deckpilot exports:
   - MP4 video (captured by the external recorder)
  - Same-basename SRT narration slots
  - `voiceover-script.md` and `voiceover-script.json`
  - `recording-session.json` (full timing log)
6. Choose **Record Narration** when Auto-Record completes. Deckpilot launches
   srt-dubber with the matching MP4 and SRT in a VS Code terminal.

Deckpilot coordinates the configured recorder; it does not encode MP4 video
itself during capture. When a deck contains video items, Deckpilot composes a
final MP4 afterward by replacing the captured playback intervals with the
source clips. SRT timings use the remapped presentation segment boundaries,
while the text comes from the sidecar narration cues.

### Video items

Keep source media in a `clips/` directory beside the deck and add a dedicated
video item wherever it belongs in the presentation sequence:

For a ready-to-run Windows walkthrough, open
[`examples/video-workflow/video-workflow.code-workspace`](examples/video-workflow/video-workflow.code-workspace).

```markdown
<!-- slide -->

:::video
id: execution-demo
src: ./clips/execution.mp4
start: 5s
end: 42s
audio: duck
:::

<!-- slide -->
```

`id` and `src` are required. `start` and `end` optionally trim the source clip.
`audio` is `mute`, `preserve`, or `duck` (the default). Auto-Pilot waits for
playback to finish, records the exact interval, and replaces that screen-captured
interval with a normalized source clip using a hard cut. Source clips are local
files; remote URLs and transitions are not supported.

Narration for both slides and videos belongs in canonical sidecar `items[]`:

```yaml
items:
  - id: intro
    cues:
      - "Introduce the demo."
  - id: execution-demo
    cues:
      - "Watch the command execute."
      - at: 8.5s
        text: "Notice how the output updates."
  - id: summary
    cues:
      - "Summarize the result."

export:
  outputDir: ./recordings
```

Existing sidecar `slides[]` entries remain supported. New decks should use
`items[]` so slide and video narration share one model.

For video items, the first string cue starts at video entry. Additional cues
use `{ at, text }`, where `at` is relative to the trimmed clip start and accepts
seconds or milliseconds. Timed cues are remapped with the composed video.

Each recording is isolated under
`recordings/<deck>/<timestamp-session>/`. The folder contains the recoverable
`session-*.mp4` capture, composed `<deck>.mp4`, matching SRT, recording manifest,
and voice-over scripts. srt-dubber creates its project, takes, processed audio,
and final `output/<deck-name>-dubbed.mp4` inside the same session folder.

You can also run **Deckpilot: Record Narration for Latest Export** from the
Command Palette while the deck is open. Deckpilot searches its configured
recording output, `recordings/`, and the deck directory for the newest matching
MP4/SRT pair. It resolves `srt-dubber` from `PATH` by default; configure an
explicit executable when needed:

```json
{
  "deckPilot.dubbing.executable": "C:\\tools\\srt-dubber.exe"
}
```

The terminal remains visible because narration recording is interactive, but
you do not need to type or construct the command.

### Record only the VS Code window on Windows

Use Deckpilot's window-bound placeholders as `gdigrab` input options. Add this
to the workspace's `.vscode/settings.json`:

```json
{
  "deckPilot.recording.startCommand": "ffmpeg -hide_banner -loglevel error -y -f gdigrab -draw_mouse 0 -framerate 30 -offset_x {{windowX}} -offset_y {{windowY}} -video_size {{windowWidth}}x{{windowHeight}} -i desktop -vf \"crop=trunc(iw/2)*2:trunc(ih/2)*2\" -c:v libx264 -preset ultrafast -pix_fmt yuv420p \"{{outputPath}}\"",
  "deckPilot.recording.outputDir": "./recordings",
  "deckPilot.recording.outputExtension": "mp4"
}
```

`-offset_x`, `-offset_y`, and `-video_size` must appear before `-i desktop`;
otherwise `gdigrab` captures the entire virtual desktop. Start Auto-Record
from the VS Code window you want captured. The crop filter removes at most one
pixel from odd-sized windows because H.264 `yuv420p` requires even dimensions.

### Validate the recording workflow

The Windows end-to-end gate creates a temporary deck and sidecar, launches a
real Extension Development Host, plays and inserts a source clip, runs
Auto-Record, generates deterministic narration takes, invokes srt-dubber, and
verifies final pixels, retained clip audio, codecs, dimensions, and MP4 decode:

```powershell
npm run test:e2e:video-workflow
```

Prerequisites are VS Code, ffmpeg/ffprobe on `PATH`, and a Release build of the
sibling `../srt-dubber` repository. Override discovery with
`VSCODE_EXECUTABLE_PATH`, `FFMPEG_PATH`, `FFPROBE_PATH`, or `SRT_DUBBER_PATH`.
The Windows recorder resolves the foreground window when Auto-Record begins,
so keep the intended VS Code window focused at that moment.

---

## Authoring

### Sidecar files (`.deck.yaml`)

Keep metadata and presenter content out of the Markdown. The merge engine combines the two files at load time; inline values always win over sidecar values.

```yaml
# my-talk.deck.yaml
deck:
  title: My Talk
  theme: dark

slides:
  - id: intro          # matches <!-- id: intro --> in the .deck.md
    notes: "Remind the audience who you are."
    cues:
      - "Welcome everyone. Today we'll look at..." # slide entry
      - "First, notice how the demo is structured." # next fragment/action
    autoFragment: false   # suppress fragment animations (good for title slides)
    layout: center        # center | left | right | columns
    actions:
      - type: terminal.run
        cmd: npm start

```

Slide IDs are set with `<!-- id: slug -->` comments in the Markdown right after `---`.

Within `cues`, the first non-empty item narrates slide entry. Later items map
in order to fragment reveals or actions on that slide. Keep each item to one
spoken beat because each exported item becomes its own SRT recording slot.

All deck commands work when a `.deck.yaml` file is the active editor — they auto-resolve the paired `.deck.md`.

### Environment variables

Use `{{VAR}}` placeholders in your deck, resolved from a `.deck.env` sidecar file. Mark sensitive values with `secret: true` to mask them in the UI and terminal output.

### Dynamic content

Embed live file contents or command output directly in slides. Syntax uses empty Markdown links:

```markdown
[](render:file?path=src/main.ts&lines=1-30&format=typescript)
[](render:file?path=package.json&format=json)
```

```markdown
[](render:command?cmd=node%20--version)
[](render:command?cmd=git%20branch%20--show-current)
```

```markdown
[](render:diff?path=src/extension.ts&ref=HEAD~1)
```

- `render:file` — inline a file's contents; `path` is required, `lines` (`1-30`) and `format` are optional
- `render:command` — run a command and embed its output *(requires Workspace Trust)*; `cmd` is URL-encoded
- `render:diff` — show a git diff inline; `path` is required, `ref` defaults to `HEAD~1`

### Layout directives

Structure slide content with layout containers:

- `:::center` — center content vertically and horizontally
- `:::columns` / `:::left` / `:::right` — two-column grid
- `:::advanced` — collapsible disclosure for advanced content
- `:::optional` — callout block for optional steps

### Cross-platform terminal commands

Define per-OS commands in a YAML action block:

````markdown
```action
type: terminal.run
label: Open folder
command:
  macos: open .
  windows: explorer .
  linux: xdg-open .
```
````

### Other authoring features

- `basePath` frontmatter — resolve relative paths when the deck lives in a subdirectory
- IDE authoring assistance — syntax highlighting, autocomplete, hover docs, real-time diagnostics inside ` ```action ` blocks

---

## Action reference

### Core actions

```markdown
[Open file](action:file.open?path=src/main.ts)
[Highlight](action:editor.highlight?path=src/main.ts&lines=5-20)
[Run](action:terminal.run?command=npm%20test)
[Debug](action:debug.start?configName=Launch%20Program)
```

### Advanced actions

```markdown
[VS Code command](action:vscode.command?id=workbench.action.openSettings)
[Open docs](action:browser.open?url=https://example.com&title=Docs&column=2)
```

**`browser.open` parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `url` | yes | `https://` URL, or `http://localhost`/`http://127.0.0.1` |
| `title` | no | Panel tab title. Default: `"Browser"` |
| `column` | no | ViewColumn: `1`, `2`, `3`, or `-1` (beside). Default: `2` |

As a YAML block:

````markdown
```action
type: browser.open
label: Open local server
url: http://localhost:3000
title: Dev Server
column: 2
```
````

**`wait.condition` parameters:**

````markdown
```action
type: wait.condition
label: Wait for server
condition: port.open
port: 3000
host: localhost        # optional, default: localhost
message: Waiting for dev server…
timeoutMs: 60000       # optional, default: 120000
pollIntervalMs: 2000   # optional, default: 3000
```
````

````markdown
```action
type: wait.condition
label: Wait for output file
condition: file.exists
path: dist/bundle.js
```
````

`wait.condition` does not require Workspace Trust.

### YAML action blocks

Prefer blocks over inline links — they're readable and support all options:

````markdown
```action
type: terminal.run
label: Run tests
command: npm test
showCommand: true   # display resolved command below the button
```
````

Sequences:

````markdown
```action
type: sequence
label: Full demo
steps:
  - type: file.open
    path: src/main.ts
  - type: editor.highlight
    path: src/main.ts
    lines: 5-20
  - type: terminal.run
    command: npm test
```
````

Validation (onboarding decks):

````markdown
```action
type: validate.command
command: node --version
label: Check Node.js
```
````

---

## Workspace Trust

`terminal.run`, `debug.start`, `render:command`, and `vscode.command` require [Workspace Trust](https://code.visualstudio.com/docs/editor/workspace-trust). In untrusted workspaces those actions are blocked with a clear message. `file.open` and `editor.highlight` always work.

---

## Debug commands

| Command | Description |
|---------|-------------|
| `deckpilot.showResolvedDeckModel` | Opens the fully merged `Deck` model for the active `.deck.md` as a read-only JSON document — useful for inspecting how sidecar merges, env vars, and action blocks resolve. Run from the command palette. |

---

## Requirements

VS Code 1.95.0 or higher.

---

## Compatibility

The product and repository are branded **Deckpilot**. Marketplace and package identifiers continue to use `executable-talk` for backward compatibility — existing users receive updates normally without any action required.

---

## Release notes

See [CHANGELOG.md](CHANGELOG.md).

## License

MIT
