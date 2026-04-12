---
title: "fragments"
basePath: ..
---

# Fragments — What Auto-Fragments

Every block-level element reveals on its own step automatically.
Press **→** to advance:

Paragraph one steps in first.

Paragraph two steps in second.

- List item A
- List item B
- List item C

> Blockquotes step in too.

---

# Fragments — What Does NOT Fragment

Fenced code blocks (```` ``` ````) are **always visible** — they appear immediately
and are never held back as a fragment step.

Use this intentionally: show the code up front, then step through the explanation:

Here is the method signature.

This paragraph reveals after the code above — which was already visible.

```action
type: editor.highlight
path: src/extension.ts
lines: 1-10
label: Highlight the imports
```

---

# Fragments — `:::group`

Use `:::group` to reveal multiple items together as a single step:

:::group
- Item A
- Item B reveals at the same time as A
:::

- Item C is its own step
- Item D is its own step

---

# Fragments — `fragment: false`

Set `fragment: false` on an action button to keep it always visible —
useful for a reference action the audience might need at any point:

```action
type: file.open
path: package.json
label: Always visible
fragment: false
```

```action
type: file.open
path: README.md
label: This one steps in
```
