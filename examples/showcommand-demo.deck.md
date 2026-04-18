---
title: "showCommand Demo"
author: Deckpilot
description: Shows how showCommand:true renders a command preview next to an action button so the audience can see what will run before it runs.
basePath: ..
---

# `showCommand` Feature

When an action block sets `showCommand: true`, a **code snippet** appears next to the button showing the audience exactly what command will execute.

No more "trust me, it won't destroy anything" moments.

---

# Basic Example — Terminal Command

The snippet below the button shows the exact command:

```action
type: terminal.run
label: Run Tests
command: npm test
showCommand: true
```

Compare with a button that has no preview:

```action
type: terminal.run
label: Run Tests (no preview)
command: npm test
```

---

# File Open Preview

For `file.open`, the snippet shows the file path:

```action
type: file.open
label: Open Conductor
path: src/conductor/conductor.ts
showCommand: true
```

```action
type: file.open
label: Open Parser
path: src/parser/deckParser.ts
showCommand: true
```

---

# Editor Highlight Preview

For `editor.highlight`, the snippet shows `path:lines`:

```action
type: editor.highlight
label: Show Action Registry
path: src/actions/registry.ts
lines: 1-30
showCommand: true
```

```action
type: editor.highlight
label: Show Extension Entry
path: src/extension.ts
lines: 1-20
showCommand: true
```

---

# Multi-Step Demo Flow

Walk an audience through a build-deploy cycle — they can read what each step does before it runs:

```action
type: terminal.run
label: Install dependencies
command: npm install
showCommand: true
```

```action
type: terminal.run
label: Compile TypeScript
command: npm run compile
showCommand: true
```

```action
type: terminal.run
label: Run tests
command: npm test
showCommand: true
```

---

# How It Works

Add `showCommand: true` to any action block:

```yaml
type: terminal.run
label: Deploy
command: npm run deploy -- --env staging
showCommand: true
```

*(wrap the above in a ` ```action ` fence)*

The preview renders as a `<pre>` element right below the button — no interaction needed, always visible.

Pairs naturally with **`{{VAR}}` interpolation** so the audience sees resolved values, not raw variable names.
