---
title: "Executable Talk — Feature Showcase"
basePath: ..
scenes:
  - name: intro
    slide: 1
  - name: layouts
    slide: 3
  - name: live-content
    slide: 5
  - name: actions
    slide: 7
  - name: polish
    slide: 9
---

:::center
# Executable Talk

### Live-code presentations inside VS Code

Navigate with **→** / **←** &nbsp;·&nbsp; Jump with `Cmd+G` &nbsp;·&nbsp; Scenes with `Cmd+R`
:::

---

# Fragments — Step-Through Reveal

Every block-level element reveals one at a time as you press **→**.

Use this to control pacing — walk the audience through each point before moving on.

- Open a file in the editor
- Highlight the relevant lines
- Run a command in the terminal

:::group
> All three goals, one presentation file.
> No switching apps. No alt-tabbing.
:::

---

# Layouts — Two Columns

:::columns
:::left
### You write this

```yaml
type: terminal.run
command: npm test
label: Run tests
```
:::
:::right
### Audience sees this

A labelled button — one click runs `npm test` in a real terminal inside VS Code.
:::
:::

---

# Layouts — Advanced & Optional

Collapse extra detail so it doesn't overwhelm the audience:

The **advanced** block is collapsed by default — click to expand:

:::advanced
### Under the Hood

Each action goes through the Action Registry → Conductor → VS Code API.
Trust-gated actions are blocked in untrusted workspaces.
:::

Mark steps as optional without breaking the flow:

:::optional
```action
type: terminal.run
command: npm run lint
label: Also run lint (optional)
```
:::

---

# `render:file` — Live Code in Slides

Embed file contents directly — always current, no copy-paste drift:

[](render:file?path=src/extension.ts&lines=1-15&format=typescript)

---

# `render:diff` — Git Diff Inline

Show exactly what changed — perfect for code review or step-by-step refactor walkthroughs:

[](render:diff?path=src/env/envResolver.ts&ref=HEAD~1)

---

# Actions — Open & Highlight

```action
type: sequence
label: Walk through the Conductor
showCommand: true
steps:
  - type: file.open
    path: src/conductor/conductor.ts
  - type: editor.highlight
    path: src/conductor/conductor.ts
    lines: 1-30
```

Use `showCommand: true` to preview what will happen **before** the button is clicked.

---

# Actions — Run Terminal Commands

```action
type: terminal.run
command: npm run compile
label: Compile the extension
showCommand: true
```

```action
type: sequence
label: Full build + test
showCommand: true
steps:
  - type: terminal.run
    command: npm run compile
  - type: terminal.run
    command: npm run test:unit
```

---
notes: |
  This slide shows how speaker notes work.
  Only you see this — the audience sees the slide content.
  Add notes per-slide using the --- separator block.
---

# Speaker Notes & Voice Cues

<!-- voice: Introduce how executable talk handles speaker context. -->

Notes appear in your presenter panel — invisible to the audience.

<!-- voice[1]: Voice cues sync the transcript to the fragment that just appeared. -->

- Write notes in the slide separator using `notes: |`
- Add `<!-- voice: ... -->` cues for narration sync

<!-- voice[2]: The recording system uses these to align SRT captions to slide state. -->

- Voice cues align to specific fragments when you add `[N]`

---

# Scenes — Named Checkpoints

Jump straight to any section without paging through every slide:

| Scene | Slide | Purpose |
|---|---|---|
| `intro` | 1 | Title & overview |
| `layouts` | 3 | Layout features |
| `live-content` | 5 | render:file / diff |
| `actions` | 7 | Action buttons |
| `polish` | 9 | Notes & scenes |

Open the scene picker with `Cmd+R` and select any entry to jump directly.
