---
title: "terminal.run"
basePath: ..
---

# `terminal.run` — Inline Link

Run a command using an inline action link:

[Check Node version](action:terminal.run?command=node%20--version)

[Show git status](action:terminal.run?command=git%20status%20--short)

---

# `terminal.run` — YAML Block

```action
type: terminal.run
command: npm run test:unit
label: Run unit tests
```

---

# `terminal.run` — Cross-Platform

One block, the right command on every OS:

```action
type: terminal.run
command:
  macos: ls -la
  windows: dir
  linux: ls -la
label: List directory
```

```action
type: terminal.run
command:
  macos: open .
  windows: explorer .
  linux: xdg-open .
label: Open file browser
```
