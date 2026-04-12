---
title: "Executable Talk — Web Showcase"
basePath: ..
scenes:
  - name: intro
    slide: 1
  - name: layouts
    slide: 3
  - name: live-content
    slide: 5
  - name: polish
    slide: 7
---

:::center
# Executable Talk

### Markdown presentations with live code — in your browser

Navigate with **→** / **←** &nbsp;·&nbsp; Jump with `Ctrl+G` &nbsp;·&nbsp; Scenes with `Ctrl+R`
:::

---

# Fragments — Step-Through Reveal

Every block-level element reveals one at a time as you press **→**.

Use this to control pacing — walk through each point before moving on.

- Author presentations as plain Markdown
- Add action blocks for live demos
- Ship the `.deck.md` file alongside your repo

:::group
> The `.deck.md` file is the single source of truth — slides, actions, and speaker notes in one place.
:::

---

# Layouts — Two Columns

:::columns
:::left
### Write Markdown

```yaml
title: My Presentation
scenes:
  - name: intro
    slide: 1
  - name: demo
    slide: 4
```
:::
:::right
### Get a Presentation

Named scenes, fragment animations, layout directives, speaker notes — all from a single text file you can version-control.
:::
:::

---

# Layouts — Advanced & Optional

Collapse extra detail behind a toggle:

:::advanced
### Supported Layout Directives

`:::center` — center all content vertically and horizontally

`:::columns` / `:::left` / `:::right` — two-column split

`:::advanced` — collapsible deep-dive block (this one!)

`:::optional` — optional step, grayed until expanded
:::

You only see what matters — click to go deeper:

:::optional
**Optional reading:** The layout directives are parsed as custom `markdown-it` container plugins before the slide HTML is injected into the webview.
:::

---

# `render:file` — Live Code in Slides

Embed file contents directly — always current, no copy-paste:

[](render:file?path=src/extension.ts&lines=1-15&format=typescript)

---

# `render:file` — Configuration Files

[](render:file?path=tsconfig.json&format=json)

---
notes: |
  This slide demonstrates speaker notes — only you see this text.
  The audience sees the slide content below.
---

# Speaker Notes & Voice Cues

<!-- voice: Describe how speaker notes and voice cues work in the presenter view. -->

Notes appear in your presenter panel — invisible to the audience.

- Per-slide notes in the `---` separator block using `notes: |`
- `<!-- voice: ... -->` cues for narration sync with recordings

<!-- voice[1]: Voice cues align to specific fragments using the [N] index syntax. -->

- Fragment-aligned cues with `<!-- voice[1]: ... -->`

---

# Scenes — Named Checkpoints

Jump to any section without paging slide by slide:

| Scene | Slide | Purpose |
|---|---|---|
| `intro` | 1 | Title & overview |
| `layouts` | 3 | Layout features |
| `live-content` | 5 | render:file embeds |
| `polish` | 7 | Notes & scenes |

Open the scene picker with `Ctrl+R` and select any entry to jump directly.
