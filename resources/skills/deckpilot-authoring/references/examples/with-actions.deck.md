---
title: "Live Demo: Refactoring the Conductor"
basePath: ..
scenes:
  - name: intro
    slide: 1
  - name: demo
    slide: 3
  - name: outro
    slide: 6
---

# Refactoring the Conductor

A live walkthrough.

# What We'll Touch

- The dispatcher (`conductor.ts`)
- The state stack
- The action registry

[Open the entry point](action:file.open?path=src/conductor/conductor.ts)

# The Dispatcher

```action
type: sequence
label: Walk through the dispatcher
showCommand: true
steps:
  - type: file.open
    path: src/conductor/conductor.ts
  - type: editor.highlight
    path: src/conductor/conductor.ts
    lines: 1-30
```

Notice how each message has a dedicated handler — no `switch` smell.

# The Test Suite

Confidence comes from tests. One command, all green:

```action
type: terminal.run
command: npm test
label: Run the suite
showCommand: true
```

<!-- advanced -->
### What this actually runs

The `npm test` script invokes Mocha against `test/**/*.test.ts` with the VS Code test electron host.
<!-- /advanced -->

# Before / After

<!-- columns -->
<!-- left -->
### Before

[](render:file?path=src/conductor/conductor.ts&lines=1-20&format=typescript)
<!-- /left -->
<!-- right -->
### After

Cleaner dispatch, no manual routing.
<!-- /right -->
<!-- /columns -->

# Thanks

Repo: github.com/you/project
