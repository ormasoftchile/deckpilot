---
title: "fragments"
basePath: ..
---

# Fragments — Lists

Each bullet reveals on its own step (press **→** to advance):

- First point
- Second point
- Third point

---

# Fragments — Mixed Content

Paragraphs, code blocks, and action buttons each step in separately:

This is the setup step.

```bash
npm install
```

```action
type: terminal.run
command: npm install
label: Run it
```

---

# Fragments — :::group

Use `:::group` to make multiple items appear together as one step:

:::group
- Item A reveals with
- Item B at the same time
:::

- Item C is its own step
- Item D is its own step

---

# Fragments — `fragment: false`

Disable fragmentation on a specific action button so it's always visible:

```action
type: file.open
path: package.json
label: Always visible (no fragment)
fragment: false
```

```action
type: file.open
path: README.md
label: This one steps in
```
