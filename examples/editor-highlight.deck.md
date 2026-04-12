---
title: "editor.highlight"
basePath: ..
---

# `editor.highlight` — Line Range

Highlight a span of lines in a file:

```action
type: editor.highlight
path: src/extension.ts
lines: 1-20
label: Show imports
```

---

# `editor.highlight` — Single Line

Highlight exactly one line:

```action
type: editor.highlight
path: package.json
lines: 3
label: Show version field
```

---

# `editor.highlight` — Multiple Regions

Step through different parts of the same file:

```action
type: editor.highlight
path: src/conductor/conductor.ts
lines: 1-30
label: Class definition
```

```action
type: editor.highlight
path: src/conductor/conductor.ts
lines: 50-80
label: Constructor
```
