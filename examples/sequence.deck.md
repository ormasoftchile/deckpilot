---
title: "sequence"
basePath: ..
---

# `sequence` — Chain Actions

Run multiple actions in order with a single click:

```action
type: sequence
label: Open and highlight
steps:
  - type: file.open
    path: src/extension.ts
  - type: editor.highlight
    path: src/extension.ts
    lines: 1-20
```

---

# `sequence` — Full Demo Flow

```action
type: sequence
label: Run full setup
steps:
  - type: file.open
    path: package.json
  - type: editor.highlight
    path: package.json
    lines: 1-10
  - type: terminal.run
    command: npm run compile
```

Each step runs to completion before the next starts.
If any step fails, the sequence stops and reports which step failed.
