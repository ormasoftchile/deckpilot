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

- Voice-over cues — `<!-- voice: text -->` per slide, `<!-- voice[N]: text -->` per fragment
- Manual recording — start/stop session; pause/resume timing, retake markers, narration markers
- **Auto-Pilot** — hands-free: drives slides, fragments, and actions at a pace computed from voice cue word count
- External recorder — configure ffmpeg (or any tool) to start/stop automatically via settings
- Exports — `voiceover-script.md`, SRT captions, event JSON, MP4 video (via external recorder)

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

1. Write a `.deck.md` deck with slides, actions, and voice cues
2. Configure an external recorder in VS Code settings (e.g. ffmpeg)
3. Run **Deckpilot: Auto-Record Deck** from the command palette
4. Deckpilot drives the presentation automatically, coordinating with the recorder
5. When done, export:
   - MP4 video (captured by the external recorder)
   - SRT captions
   - `voiceover-script.md`
   - Event JSON (full timing log)

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
      - "Welcome everyone. Today we'll look at..."
    autoFragment: false   # suppress fragment animations (good for title slides)
    layout: center        # center | left | right | columns
    actions:
      - type: terminal.run
        cmd: npm start

recording:
  autoStart: false

export:
  subtitles: true
  srtFormat: srt
```

Slide IDs are set with `<!-- id: slug -->` comments in the Markdown right after `---`.

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

## `@deck` chat participant

Generate or improve decks without leaving Copilot Chat.

```
@deck /create a five-slide intro to Kubernetes for platform engineers
@deck /convert #file:SETUP.md into a deck with terminal actions
@deck /enrich #file:demo.deck.md — add voice cues and fragments
@deck how do I make a two-column layout?
```

By default `/create` and `/convert` produce a sidecar file alongside the Markdown. Say `without sidecar` in the prompt to get a single-file deck. Say `zen mode` to enable Zen Mode in the frontmatter.

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
