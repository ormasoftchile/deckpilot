# Deckpilot

_Formerly Executable Talk. Marketplace listing and command IDs still use the `executable-talk` identifier for backward compatibility._

Deckpilot turns `.deck.md` Markdown files into live, executable presentations inside VS Code. Write your slides once, then click action links to open files, run commands, start debuggers, and restore IDE state — all without leaving the presentation. Built for live coding demos, team onboarding, and hands-on teaching.

## Features

**Core presentation**
- **Slide navigation** — Full-screen presentation view; arrow keys advance slides and fragments
- **Fragment animations** — Reveal content step-by-step with fade, slide-up, slide-left, zoom, or highlight effects
- **Slide transitions** — Horizontal slide-in or crossfade between slides (`slide` / `fade`)
- **Themes** — Four built-in themes: `dark`, `light`, `minimal`, `contrast`
- **Non-linear navigation** — Slide picker (`Ctrl+G`), jump by number, go back (`Alt+Left`)
- **Navigation history** — Breadcrumb trail shows recent slide visits; click to jump back
- **Floating toolbar** — Bottom-right workspace toggles (sidebar, panel, terminal, activity bar, Zen Mode)
- **Zen Mode** — Opt-in distraction-free mode via `zenMode: true`
- **Presenter View** — Speaker notes and next-slide preview on a secondary panel
- **Undo/redo** — Walk back IDE changes mid-demo with `Cmd+Z` / `Ctrl+Z`

**Actions**
- **`file.open`** — Opens a file in the editor; no trust required
- **`editor.highlight`** — Highlights specific lines in an open file; no trust required
- **`terminal.run`** — Runs a command in the integrated terminal (requires Workspace Trust)
- **`debug.start`** — Launches a debug configuration (requires Workspace Trust)
- **`sequence`** — Chains multiple actions into a single click
- **`vscode.command`** — Executes any VS Code command ID (requires Workspace Trust)
- **`wait.condition`** — Blocks until a file exists or a port is open; designed for Auto-Pilot and onboarding flows
- **Validation actions** — `validate.command`, `validate.fileExists`, `validate.port` confirm setup steps
- **YAML action blocks** — Human-readable fenced ` ```action ` blocks as an alternative to URL-encoded inline links

**Authoring**
- **`.deck.md` format** — Slides separated by `---`; YAML frontmatter for title, author, options, env, scenes, basePath
- **Sidecar files** — Split content and metadata across `.deck.md` + `.deck.yaml`; all four deck commands work from an active `.deck.yaml`
- **Sidecar layout overrides** — Per-slide `layout` field (`center`, `left`, `right`, `columns`) in the sidecar `slides:` list
- **Environment variables** — `{{VAR}}` placeholders resolved from a `.deck.env` sidecar; validation rules enforce correct values
- **Secret masking** — Variables marked `secret: true` stay hidden from the audience; terminal output is scrubbed too
- **Guided setup badge** — Shows env resolution status (🟢/🟡/🔴); opens `.deck.env` for editing when variables are missing
- **Dynamic content** — `render:file`, `render:command`, `render:diff` embed live file contents, command output, and git diffs
- **Layout directives** — `:::center`, `:::columns`, `:::advanced` (collapsible), `:::optional` (badge)
- **Fragment syntax** — `<!-- .fragment -->` and `<!-- .fragment animation -->` on any block element
- **Speaker notes** — Per-slide `---\nnotes: text\n---` fence; renders only in Presenter View, never in the audience slide
- **Cross-platform commands** — Per-OS command map (`macos`/`windows`/`linux`/`default`) and path placeholders (`${home}`, `${pathSep}`, …)
- **basePath** — Resolve relative paths from the deck file's directory for decks in subdirectories
- **Preflight validation** — `Deckpilot: Validate Deck` catches missing files, bad line ranges, unavailable commands, and trust issues
- **Authoring assistance** — Syntax highlighting, autocomplete, hover docs, and real-time diagnostics inside ` ```action ` blocks

**AI generation**
- **`@deck /create`** — Generate a deck from a plain-language description
- **`@deck /convert`** — Convert existing Markdown into a `.deck.md`
- **`@deck /enrich`** — Add voice cues, fragments, and actions to an existing deck
- **Freeform `@deck`** — Ask any deck-related question in Copilot Chat

**Scene checkpoints**
- **Save/restore scenes** — Capture and recall full IDE state at any point (`Ctrl+S` / `Ctrl+R`)
- **Pre-authored scenes** — Define named scene anchors in frontmatter; they appear in the scene picker automatically

**Recording**
- **Voice-over cues** — `<!-- voice: text -->` (slide-level) and `<!-- voice[N]: text -->` (fragment-level) for narration scripts
- **Manual recording** — Start/stop session; pause/resume timing, retake markers, and narration markers during the recording
- **Auto-Pilot recording** — Hands-free: the extension drives slides, fragments, and actions at a pace calculated from voice cue word count
- **SRT caption export** — Subtitle file auto-named to match your video file
- **External recorder** — Configure ffmpeg (or any tool) to start and stop automatically via settings

**Onboarding**
- **Onboarding Mode** — `mode: onboarding` activates step tracking, retry/reset buttons, and inline validation results
- **Checkpoint markers** — `<!-- checkpoint: name -->` auto-saves IDE state; **Reset to Checkpoint** restores it on failure

## Getting Started

Create a file with the `.deck.md` extension. Slides are separated by `---`. Action links execute IDE commands on click.

```markdown
---
title: My First Presentation
author: Your Name
---

# Welcome to Deckpilot

This is your first slide!

---

## Opening a File

[Open Main File](action:file.open?path=src/main.ts)

---

## Highlighting Code

[Highlight the function](action:editor.highlight?path=src/main.ts&lines=5-10)

---
notes: Remember to explain the architecture diagram!
---

## Running Commands

[Install Dependencies](action:terminal.run?command=npm%20install)

---

## Debugging

[Launch Debugger](action:debug.start?config=Launch%20Program)
```

Open the file in VS Code and run **Deckpilot: Start Presentation** from the command palette (`Cmd+Shift+P` / `Ctrl+Shift+P`).

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `→` or `Space` | Next fragment or next slide |
| `←` or `Backspace` | Previous fragment or previous slide |
| `Shift+→` | Skip fragments, go to next slide |
| `Shift+←` | Skip fragments, go to previous slide |
| `Home` | First slide |
| `End` | Last slide |
| `Cmd+Z` / `Ctrl+Z` | Undo IDE changes |
| `Cmd+Shift+Z` / `Ctrl+Y` | Redo IDE changes |
| `Ctrl+G` / `Cmd+G` | Open slide picker (jump to any slide) |
| `Ctrl+S` / `Cmd+S` | Save current state as a named scene |
| `Ctrl+R` / `Cmd+R` | Restore a saved scene |
| `Alt+Left` | Go back to previously viewed slide |
| Digit keys + `Enter` | Jump to slide by number |
| `Escape` | Exit presentation |

> **Note**: `Ctrl+G`, `Ctrl+S`, and `Ctrl+R` are scoped to the presentation Webview — they don't affect VS Code's native shortcuts outside the presentation.

### Floating Toolbar

Hover over the presentation to reveal the bottom-right toolbar:

| Icon | Action |
|------|--------|
| ◧ | Toggle Sidebar |
| ◫ | Toggle Panel |
| ⌨ | Toggle Terminal |
| ☰ | Toggle Activity Bar |
| ⛶ | Toggle Zen Mode |

### Commands

| Command | Description |
|---------|-------------|
| `Deckpilot: Start Presentation` | Open the current `.deck.md` file as a presentation |
| `Deckpilot: Stop Presentation` | Close the presentation and restore IDE state |
| `Deckpilot: Reset Presentation` | Reset to the first slide and clear all changes |
| `Deckpilot: Next Slide` | Navigate to the next slide |
| `Deckpilot: Previous Slide` | Navigate to the previous slide |
| `Deckpilot: Go to Slide` | Open the slide picker to jump to any slide |
| `Deckpilot: Save Scene` | Save current IDE state as a named scene |
| `Deckpilot: Restore Scene` | Open the scene picker to restore a saved scene |
| `Deckpilot: Open Presenter View` | Show speaker notes and next slide preview |
| `Deckpilot: Validate Deck` | Run preflight checks on the current `.deck.md` file |
| `Deckpilot: Extract Metadata to Sidecar` | Extract deck frontmatter into a `.deck.yaml` sidecar file |
| `Deckpilot: Show Resolved Deck Model` | Display the merged deck model (deck + sidecar combined) |
| `Deckpilot: Start Recording Session` | Begin recording timeline events during presentation |
| `Deckpilot: Stop Recording Session` | Stop recording and export session artifacts |
| `Deckpilot: Pause Recording Timing` | Pause narration timing (excluded from pacing) |
| `Deckpilot: Resume Recording Timing` | Resume narration timing |
| `Deckpilot: Toggle Recording Pause` | Toggle pause/resume (`Ctrl+Shift+Space`) |
| `Deckpilot: Mark Retake Point` | Flag current position for re-recording (`Ctrl+Shift+R`) |
| `Deckpilot: Insert Narration Marker` | Add a narration cue (`Ctrl+Shift+M`) |
| `Deckpilot: Auto-Record Deck` | Hands-free: drive presentation + record at calculated pace |
| `Deckpilot: Cancel Auto-Record` | Stop a running auto-pilot session |

## Action Reference

### `file.open`

```markdown
[Open File](action:file.open?path=path/to/file.ts)
```

| Parameter | Description | Required |
|-----------|-------------|----------|
| `path` | Relative path to the file | Yes |

### `editor.highlight`

```markdown
[Highlight Code](action:editor.highlight?path=path/to/file.ts&lines=5-10)
```

| Parameter | Description | Required |
|-----------|-------------|----------|
| `path` | Relative path to the file | Yes |
| `lines` | Line range (e.g., `5-10` or `5`) | Yes |

### `terminal.run`

Runs a command in the integrated terminal. **Requires Workspace Trust.**

```markdown
[Run Command](action:terminal.run?command=npm%20test)
```

| Parameter | Description | Required |
|-----------|-------------|----------|
| `command` | URL-encoded command. Supports `{{VAR}}` env placeholders and platform maps. | Yes |

### `debug.start`

Starts a debug session. **Requires Workspace Trust.**

```markdown
[Start Debugging](action:debug.start?configName=Launch%20Program)
```

| Parameter | Description | Required |
|-----------|-------------|----------|
| `configName` | Name of the launch configuration | Yes |

### `sequence`

Executes multiple actions in order. Prefer the YAML block syntax for sequences — see [Action Block Syntax](#action-block-syntax-yaml).

```markdown
[Demo Flow](action:sequence?actions=file.open%3Ffile%3Dsrc/main.ts,editor.highlight%3Ffile%3Dsrc/main.ts%26lines%3D1-5)
```

### `vscode.command`

Executes any VS Code command. **Requires Workspace Trust.**

```markdown
[Open Settings](action:vscode.command?id=workbench.action.openSettings)
```

| Parameter | Description | Required |
|-----------|-------------|----------|
| `id` | VS Code command ID | Yes |
| `args` | URL-encoded JSON arguments | No |

### `wait.condition`

Blocks until a condition is satisfied, then continues. Designed for Auto-Pilot and onboarding flows where an installer or service takes variable time.

````markdown
```action
type: wait.condition
condition: file.exists
path: C:\Program Files\Contoso\contoso.exe
message: Waiting for installation to complete...
timeoutMs: 300000
pollIntervalMs: 2000
label: Wait for installer
```
````

| Parameter | Description | Required |
|-----------|-------------|----------|
| `condition` | `file.exists` or `port.open` | Yes |
| `path` | File path to check (`file.exists` only) | Required for `file.exists` |
| `port` | Port to check (`port.open` only) | Required for `port.open` |
| `host` | Host to check | No (default: `localhost`) |
| `message` | Progress message while waiting | No |
| `timeoutMs` | Maximum wait duration in ms | No (default: `120000`) |
| `pollIntervalMs` | Poll interval in ms | No (default: `3000`) |

### `validate.command`

Runs a command and checks its exit code. **Requires Workspace Trust.**

````markdown
```action
type: validate.command
command: node --version
expectOutput: "v"
label: Validate Node.js
```
````

| Parameter | Description | Required |
|-----------|-------------|----------|
| `command` | Command to execute (string or platform map) | Yes |
| `expectOutput` | Substring that must appear in stdout | No |
| `timeout` | Timeout in milliseconds | No (default: 30000) |

### `validate.fileExists`

````markdown
```action
type: validate.fileExists
path: package.json
label: Check package.json
```
````

| Parameter | Description | Required |
|-----------|-------------|----------|
| `path` | Relative or absolute file path | Yes |
| `expectMissing` | Set `true` to check file does NOT exist | No (default: false) |

### `validate.port`

````markdown
```action
type: validate.port
port: 3000
label: Check dev server
```
````

| Parameter | Description | Required |
|-----------|-------------|----------|
| `port` | Port number (1–65535) | Yes |
| `host` | Hostname to check | No (default: localhost) |
| `timeout` | Connection timeout in ms | No (default: 5000) |

## Action Block Syntax (YAML)

Inline action links are URL-encoded and hard to read. YAML action blocks are the preferred authoring format:

````markdown
```action
type: file.open
path: src/main.ts
label: Open Main
```
````

Action blocks support all action types and these meta-fields:

| Meta-field | Description |
|------------|-------------|
| `label` | Button text (defaults to action type if omitted) |
| `fragment` | Set `false` to exclude the button from fragment stepping |
| `showCommand` | Set `true` to display the resolved command below the button |

`showCommand: true` is useful for teaching demos — the audience sees the actual command (with `{{VAR}}` placeholders resolved to display values) beneath the button.

The `sequence` action type uses a `steps` list:

````markdown
```action
type: sequence
label: Full Demo
steps:
  - type: file.open
    path: src/main.ts
  - type: editor.highlight
    path: src/main.ts
    lines: 5-10
  - type: terminal.run
    command: npm test
```
````

## Dynamic Content Rendering

Embed live content in slides using render directives — invisible links replaced with actual content when the slide loads.

### `render:file`

```markdown
[](render:file?path=src/main.ts&lines=1-20)
```

| Parameter | Description | Required |
|-----------|-------------|----------|
| `path` | Relative path to the file | Yes |
| `lines` | Line range (e.g., `1-20` or `5`) | No |
| `lang` | Language for syntax highlighting | No (auto-detected) |
| `format` | Output format: `code`, `quote`, or `raw` | No (default: `code`) |

### `render:command`

Executes a command and embeds its output. **Requires Workspace Trust.**

```markdown
[](render:command?cmd=npm%20--version)
```

| Parameter | Description | Required |
|-----------|-------------|----------|
| `cmd` | URL-encoded command to execute | Yes |
| `cwd` | Working directory for the command | No |
| `timeout` | Timeout in milliseconds | No (default: 30000) |
| `format` | Output format: `code`, `json`, or `raw` | No (default: `code`) |
| `cached` | Cache output between renders | No (default: `true`) |

### `render:diff`

```markdown
[](render:diff?path=src/main.ts&before=HEAD~1)
```

| Parameter | Description | Required |
|-----------|-------------|----------|
| `path` | File to show git diff for | Yes* |
| `before` | Git ref to compare against | No (default: `HEAD`) |
| `after` | Git ref to compare to | No (default: working tree) |
| `left` | Left file for file-to-file diff | Yes* |
| `right` | Right file for file-to-file diff | Yes* |
| `mode` | Display mode: `unified` or `split` | No (default: `unified`) |
| `context` | Number of context lines | No (default: 3) |

*Either `path` OR both `left` and `right` are required.

## Fragment Animations

Add `<!-- .fragment -->` after any element to reveal it on the next arrow key press:

```markdown
## Key Features

- First point appears <!-- .fragment -->
- Then the second <!-- .fragment -->
- And finally the third! <!-- .fragment -->
```

Specify an animation style after `.fragment`:

| Animation | Effect |
|-----------|--------|
| `fade` | Fade in (default) |
| `slide-up` | Slide up from below |
| `slide-left` | Slide in from the right |
| `zoom` | Zoom in from smaller |
| `highlight` | Visible but dimmed, then highlighted |

Fragments work on list items, paragraphs, headings, and block elements. Compatible with [Reveal.js fragment syntax](https://revealjs.com/fragments/).

## Layout Directives

Markdown-compatible layout helpers that degrade gracefully in plain Markdown viewers.

```markdown
:::center
**Big idea goes here**
:::
```

```markdown
:::columns

:::left
Text and explanations
:::

:::right
Code samples and diagrams
:::

:::
```

```markdown
:::advanced
Collapsible content for advanced users (renders as `<details>`)
:::

:::optional
Non-blocking optional content with a visual badge
:::
```

## Speaker Notes

Insert a YAML-only fence between slide separators to attach notes to the next slide:

```markdown
---
notes: Remember to explain the architecture here!
---

## Architecture Deep Dive

Slide content here...
```

Notes render **only in Presenter View** — they never appear in the audience-facing slide. Open Presenter View with `Deckpilot: Open Presenter View`.

## Presentation Options

```yaml
---
title: My Presentation
author: Your Name
options:
  toolbar: true                    # Show toolbar (default: true)
  zenMode: true                    # Enter Zen Mode on start (default: false)
  showSlideNumbers: true           # Show slide numbers (default: true)
  showProgress: false              # Show progress bar (default: false)
  fontSize: medium                 # Font size: small, medium, large
  theme: dark                      # Theme: dark, light, minimal, contrast
  transition: slide                # slide (default) or fade
---
```

Set `toolbar: false` to hide the floating toolbar, or supply a list to show only specific buttons (`sidebar`, `panel`, `terminal`, `activityBar`, `zenMode`).

### Themes

| Theme | Description |
|-------|-------------|
| `dark` | Default. High-contrast dark background optimized for projectors |
| `light` | Clean white background for well-lit rooms |
| `minimal` | Muted, distraction-free aesthetic for code-heavy decks |
| `contrast` | WCAG AAA high-contrast (black/white/yellow) for accessibility |

## Environment Variables

Parameterize decks with `{{VAR}}` placeholders so the same `.deck.md` works across different machines and users. Declare variables in frontmatter and supply values in a `.deck.env` sidecar:

```yaml
---
title: "Team Onboarding"
env:
  - name: REPO_PATH
    description: "Path to the cloned repository"
    required: true
    validate: directory

  - name: GH_TOKEN
    description: "GitHub personal access token"
    secret: true

  - name: BRANCH
    description: "Feature branch to work on"
    default: "main"
---
```

| Property | Default | Description |
|----------|---------|-------------|
| `name` | — | Variable name (letters, digits, underscores) |
| `description` | `""` | Shown in hover tooltips and guided setup |
| `required` | `false` | Error if not set |
| `secret` | `false` | Value masked in the presentation UI; terminal output scrubbed |
| `validate` | — | `directory`, `file`, `command`, `url`, `port`, or `regex:pattern` |
| `default` | — | Fallback when not set in `.deck.env` |

Create `onboarding.deck.env` (same base name, gitignored) with your values:

```bash
REPO_PATH=/home/alice/projects/my-repo
GH_TOKEN=ghp_abc123def456ghi789
BRANCH=feature/onboarding
```

> **⚠️** Add `*.deck.env` to `.gitignore`. Commit `*.deck.env.example` as a template for others.

Use `{{VAR}}` in any action:

````markdown
```action
type: terminal.run
command: cd {{REPO_PATH}} && npm install
label: Install Dependencies
```
````

`{{VAR}}` env placeholders and `${home}` platform placeholders can coexist in the same command.

### Guided Setup

An **env status badge** (🟢/🟡/🔴) appears in the presentation corner. Click it (or **Set Up Now** in the toast) to open `.deck.env` for editing. The presentation refreshes as you save. Validation runs during `Deckpilot: Validate Deck` and issues appear in the Problems panel.

## Sidecar Files (`.deck.yaml`)

Split content and metadata across two files:

```
my-talk/
  ├── onboarding.deck.md          ← Slides and Markdown
  ├── onboarding.deck.yaml        ← Metadata, options, slide overrides
  └── onboarding.deck.env         ← Environment variables
```

The sidecar carries any frontmatter field and can override slide-level layout. All four deck commands (**Start Presentation**, **Validate Deck**, **Extract Metadata to Sidecar**, **Show Resolved Deck Model**) work when a `.deck.yaml` file is the active editor — they auto-resolve the paired `.deck.md`.

### Slide-Level Layout

Control visual alignment per slide in the sidecar `slides:` list:

```yaml
slides:
  - index: 1
    layout: center        # Center content vertically and horizontally
  - index: 3
    layout: right         # Right-align text content
  - index: 5
    layout: left          # Left-align text content
  - index: 7
    layout: columns       # Two-column layout
```

## basePath

When a deck file is in a subdirectory but references files at the repository root, add `basePath` to the frontmatter:

```yaml
---
title: My Demo
basePath: ..
---
```

Paths in all actions and render directives resolve relative to the basePath directory.

## Cross-Platform Commands

Write terminal commands that adapt to the presenter's OS automatically:

````markdown
```action
type: terminal.run
command:
  macos: open .
  windows: explorer .
  linux: xdg-open .
  default: xdg-open .
label: Open File Browser
```
````

Use platform-aware path placeholders in any terminal command:

| Placeholder | macOS/Linux | Windows |
|-------------|-------------|---------|
| `${pathSep}` | `/` | `\` |
| `${home}` | `/Users/you` | `C:\Users\you` |
| `${shell}` | `/bin/zsh` | `cmd.exe` |
| `${pathDelimiter}` | `:` | `;` |

`Deckpilot: Validate Deck` warns if a platform command map omits the current OS and has no `default` fallback.

## Scene Checkpoints

Press `Ctrl+S` / `Cmd+S` to save the current IDE state (open files, cursor positions, terminals, active slide) as a named scene. Press `Ctrl+R` / `Cmd+R` to restore a scene from the picker.

### Pre-Authored Scenes

Define scene anchors in your deck's YAML frontmatter:

```yaml
---
title: My Presentation
scenes:
  - name: intro
    slide: 1
  - name: live-demo
    slide: 8
  - name: wrap-up
    slide: 15
---
```

Pre-authored scenes appear in the scene picker automatically. They navigate to the anchored slide without capturing full IDE state.

### Scene Limits

- Up to **20** runtime-saved scenes per session
- Pre-authored scenes don't count against this limit
- Overwriting an existing scene (same name) doesn't count against the limit

## Recording Mode

Record a live presentation session and export a time-calibrated voice-over script with captions.

### Voice-Over Cues

Add narration annotations — invisible during presentation, used in exported scripts:

```markdown
<!-- voice: Welcome to the demo. I'll show you live code execution. -->

# Welcome

<!-- voice[1]: Let's open the main file first. -->
[Open main.ts](action:file.open?path=src/main.ts) <!-- .fragment -->

<!-- voice[2]: Now highlight the key function. -->
[Show function](action:editor.highlight?path=src/main.ts&lines=5-10) <!-- .fragment -->
```

Slide-level cues use `<!-- voice: text -->`. Fragment-level cues use `<!-- voice[N]: text -->` where N is the 1-based fragment index.

### Manual Recording

1. Start a presentation
2. Run `Start Recording Session`
3. Present at your natural pace — **talk as you go** to set the timing
4. Use shortcuts during recording:
   - `Ctrl+Shift+Space` — toggle pause/resume (for interruptions)
   - `Ctrl+Shift+R` — mark retake point
   - `Ctrl+Shift+M` — insert narration marker
5. Run `Stop Recording Session`

Exported artifacts:
- `recording-session.json` — full event stream with timestamps
- `voiceover-script.md` — human-editable narration script
- `voiceover-script.json` — machine-readable script
- `{session-id}.srt` — SRT captions (auto-named to match video)

### Auto-Pilot Recording

Run `Auto-Record Deck` and the extension drives the entire presentation hands-free: navigates slides, reveals fragments, and triggers actions at a pace calculated from voice cue word count (150 WPM default). Files open in a side panel; terminal output shows then closes automatically.

### External Screen Recorder

Configure ffmpeg (or any recorder) to start/stop automatically:

```jsonc
// .vscode/settings.json
{
  "executableTalk.recording.startCommand": "ffmpeg -f gdigrab -i desktop -vf \"pad=ceil(iw/2)*2:ceil(ih/2)*2\" -pix_fmt yuv420p -preset ultrafast -y {{outputPath}}",
  "executableTalk.recording.outputDir": "./recordings",
  "executableTalk.recording.outputExtension": "mp4"
}
```

Template variables: `{{outputPath}}`, `{{sessionId}}`

## @deck Chat Participant

Generate and convert decks using Copilot Chat:

| Command | Example |
|---------|---------|
| `@deck /create` | `@deck /create installation guide for Docker Desktop on Windows` |
| `@deck /convert` | `@deck /convert #file:README.md` |
| `@deck /enrich` | `@deck /enrich #file:demo.deck.md add voice cues` |
| `@deck` (freeform) | `@deck how do I add a terminal command to a slide?` |

## Onboarding Mode

Add `mode: onboarding` to the options and your deck becomes a guided step-by-step experience:

```yaml
---
title: Team Onboarding
options:
  mode: onboarding
---
```

Slides become **steps** with a progress counter. No slide transitions. **Retry Step** and **Reset to Checkpoint** buttons appear on failure. Validation results display inline after `validate.*` actions.

Add checkpoint markers at key milestones — the IDE state saves automatically when navigated to:

```markdown
# Install Dependencies
<!-- checkpoint: deps-installed -->
```

Use `validate.*` actions to confirm each step:

````markdown
```action
type: validate.command
command: node --version
label: Verify Node.js is installed
```
````

✅ success marks the step complete; ❌ failure shows an inline error with a **Retry** option.

See `examples/onboarding.deck.md` for a complete example.

## Preflight Validation

Run **Deckpilot: Validate Deck** before presenting to catch missing files, out-of-range line highlights, unavailable debug configs, PATH-missing commands, and trust issues. Results appear as inline diagnostics (squiggly underlines), in the Deckpilot Validation output channel, and as a summary notification with a link to the Problems panel.

## Authoring Assistance

Inside ` ```action ` blocks, VS Code gives you:
- **Syntax highlighting** — YAML coloring inside Markdown
- **Autocomplete** — type suggestions after `type:`, parameter suggestions scoped to the selected action
- **Hover docs** — descriptions and parameter tables on hover
- **Diagnostics** — errors for unknown types, missing required params; warnings for unknown keys

## Workspace Trust

`terminal.run`, `debug.start`, `render:command`, and `vscode.command` require [Workspace Trust](https://code.visualstudio.com/docs/editor/workspace-trust). In untrusted workspaces those actions show as blocked. `file.open` and `editor.highlight` always work.

## Requirements

- VS Code 1.85.0 or higher
- Workspace Trust enabled for `terminal.run` and `debug.start` actions

## Release Notes

See [CHANGELOG.md](CHANGELOG.md) for version history.

## License

MIT

---

Made with ❤️ for live coding presentations
