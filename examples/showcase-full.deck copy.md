---
title: "Deckpilot — Feature Showcase (Sidecar Edition)"
---

<!-- id: intro -->

:::center
# Deckpilot

### Live-code presentations inside VS Code

Navigate with **→** / **←** &nbsp;·&nbsp; Jump with `Cmd+G` &nbsp;·&nbsp; Scenes with `Cmd+R`
:::

---

<!-- id: fragments -->

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

<!-- id: layouts-columns -->

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

<!-- id: layouts-advanced -->

# Layouts — Advanced & Optional

Collapse extra detail so it doesn't overwhelm the audience:

The **advanced** block is collapsed by default — click to expand:

:::advanced
### Under the Hood

Each action goes through the Action Registry → Conductor → VS Code API.
Trust-gated actions are blocked in untrusted workspaces.
:::

Mark steps as optional without breaking the flow — the lint action appears as a sidecar button.

---

<!-- id: render-file -->

# `render:file` — Live Code in Slides

Embed file contents directly — always current, no copy-paste drift:

[](render:file?path=src/extension.ts&lines=1-15&format=typescript)

---

<!-- id: render-diff -->

# `render:diff` — Git Diff Inline

Show exactly what changed — perfect for code review or step-by-step refactor walkthroughs:

[](render:diff?path=src/env/envResolver.ts&ref=HEAD~1)

---

<!-- id: actions-open -->

# Actions — Open & Highlight

Use `showCommand: true` to preview what will happen **before** the button is clicked.

The sequence action in the sidecar opens the file and highlights the first 30 lines in one click.

---

<!-- id: actions-terminal -->

# Actions — Run Terminal Commands

Both actions live in the sidecar — no inline `action` blocks needed in the Markdown.

The first button compiles the extension. The second runs a full build + test sequence.

---

<!-- id: speaker-notes -->

# Speaker Notes & Voice Cues

Notes appear in your presenter panel — invisible to the audience.

- Write notes per-slide in the sidecar using the `notes` key
- Add cues to the sidecar `cues[]` array for narration sync

- Voice cues align to specific fragments when you use `<!-- voice[N]: -->` inline

---

<!-- id: scenes -->

# Scenes — Named Checkpoints

Jump straight to any section without paging through every slide:

| Scene | Slide ID | Purpose |
|---|---|---|
| `intro` | `intro` | Title & overview |
| `layouts` | `layouts-columns` | Layout features |
| `live-content` | `render-file` | render:file / diff |
| `actions` | `actions-open` | Action buttons |
| `polish` | `speaker-notes` | Notes & scenes |

Open the scene picker with `Cmd+R` and select any entry to jump directly.
