---
title: "file.open"
basePath: ..
---

# `file.open` — Inline Link

Open a file using a Markdown action link:

[Open package.json](action:file.open?path=package.json)

[Open extension entry point](action:file.open?path=src/extension.ts)

---

# `file.open` — YAML Block

The YAML form is cleaner for complex params:

```action
type: file.open
path: src/conductor/conductor.ts
label: Open Conductor
```

```action
type: file.open
path: src/actions/registry.ts
label: Open Action Registry
```
