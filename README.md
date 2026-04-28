# Deckpilot

> Formerly Executable Talk. Marketplace/package identifiers still use `executable-talk` for backward compatibility.

Deckpilot turns `.deck.md` Markdown files into live, executable presentations inside VS Code. Write slides in Markdown, wire up action links to open files, highlight code, run terminal commands, or launch the debugger — then present without switching windows.

Built for live coding demos, hands-on teaching, and team onboarding.

---

## What's in the box

**Presentation**
- Reveal.js-powered full-screen webview; arrow keys + Space navigate slides and fragments
- Fragment animations — elements reveal step-by-step (no markup required; auto-fragmentation is on by default)
- Five themes: `dark`, `light`, `minimal`, `contrast` — set in frontmatter
- Slide transitions: `slide` (default) or `fade`
- Non-linear navigation: slide picker (`Ctrl+G`), jump-by-number, go-back (`Alt+Left`), breadcrumb trail
- Presenter View — speaker notes + next-slide preview on a secondary panel
- Undo/redo IDE state during a demo (`Cmd+Z` / `Ctrl+Z`, up to 50 snapshots)
- Floating toolbar — toggle sidebar, panel, terminal, activity bar, Zen Mode

**Actions**
- `file.open` — open a file in the editor
- `editor.highlight` — highlight specific lines
- `terminal.run` — run a terminal command *(requires Workspace Trust)*
- `debug.start` — launch a debug config *(requires Workspace Trust)*
- `sequence` — chain multiple actions into one click
- `vscode.command` — run any VS Code command *(requires Workspace Trust)*
- `wait.condition` — block until a file exists or a port opens (Auto-Pilot / onboarding)
- `validate.command / .fileExists / .port` — inline setup verification for onboarding decks
- YAML action blocks (` ```action `) as a readable alternative to URL-encoded inline links

**Authoring**
- Sidecar `.deck.yaml` — keep notes, cues, layout overrides, and actions separate from content
- Environment variables — `{{VAR}}` placeholders from a `.deck.env` sidecar; `secret: true` masks values in the UI and terminal output
- Dynamic content — `render:file`, `render:command`, `render:diff` embed live file contents or output
- Layout directives — `:::center`, `:::columns`, `:::left / :::right`, `:::advanced`, `:::optional`
- Cross-platform terminal commands — per-OS command map (`macos` / `windows` / `linux` / `default`) + path placeholders
- `basePath` frontmatter — resolve relative paths when the deck lives in a subdirectory
- Preflight validation — catches missing files, bad line ranges, PATH issues, trust problems
- IDE authoring assistance — syntax highlighting, autocomplete, hover docs, real-time diagnostics inside ` ```action ` blocks

**AI generation (`@deck`)**
- `/create` — generate a `.deck.md` + `.deck.yaml` from a plain-language description
- `/convert` — convert an existing Markdown file into a deck
- `/enrich` — add voice cues, fragments, and actions to an existing deck
- Freeform questions — ask anything deck-related in Copilot Chat

**Recording & narration**
- Voice-over cues — `<!-- voice: text -->` per slide, `<!-- voice[N]: text -->` per fragment
- Manual recording — start/stop session; pause/resume timing, retake markers, narration markers
- Auto-Pilot — hands-free: drives slides, fragments, and actions at a pace computed from cue word count
- Exports — `voiceover-script.md`, SRT captions, event JSON
- External recorder — configure ffmpeg (or any tool) to start/stop automatically via settings

**Onboarding mode**
- `mode: onboarding` in options — step counter replaces slide numbers; retry/reset on validation failure
- Checkpoint markers — `<!-- checkpoint: name -->` captures IDE state; **Reset to Checkpoint** restores on failure

**Scene checkpoints**
- Save/restore full IDE state as named scenes (`Ctrl+S` / `Ctrl+R`)
- Pre-authored scenes — declare named anchors in frontmatter; they appear in the picker automatically

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

## Sidecar files (`.deck.yaml`)

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

All four deck commands work when a `.deck.yaml` file is the active editor — they auto-resolve the paired `.deck.md`.

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

## Action reference (quick)

### Inline links

```markdown
[Open file](action:file.open?path=src/main.ts)
[Highlight](action:editor.highlight?path=src/main.ts&lines=5-20)
[Run](action:terminal.run?command=npm%20test)
[Debug](action:debug.start?configName=Launch%20Program)
[VS Code command](action:vscode.command?id=workbench.action.openSettings)
```

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

Cross-platform commands:

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

---

## Workspace Trust

`terminal.run`, `debug.start`, `render:command`, and `vscode.command` require [Workspace Trust](https://code.visualstudio.com/docs/editor/workspace-trust). In untrusted workspaces those actions are blocked with a clear message. `file.open` and `editor.highlight` always work.

---

## Requirements

VS Code 1.95.0 or higher.

---

## Release notes

See [CHANGELOG.md](CHANGELOG.md).

## License

MIT
