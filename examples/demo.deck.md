---
title: Demo Presentation
author: Test User
basePath: ..
options:
  zenMode: false
---

<!-- voice: Welcome to Executable Talk — a VS Code extension that turns Markdown presentations into interactive demos with live code execution. -->

# Welcome to Executable Talk! 🎉

Press **→** or **Space** to navigate forward.

---
notes: This slide demonstrates file opening. Click the link below.
---

<!-- voice: Executable Talk lets you open files directly from your slides. -->

# Opening Files

Click the action link to open a file:

<!-- voice[1]: Let's open package.json to see the project configuration. -->
[Open package.json](action:file.open?path=package.json) <!-- .fragment -->

<!-- voice[2]: And here's the README with the project documentation. -->
[Open README](action:file.open?path=README.md) <!-- .fragment -->

---

<!-- voice: You can highlight specific lines in a file. Great for drawing attention to key code. -->

# Code Highlighting

Highlight specific lines in a file:

<!-- voice[1]: Highlight a range of lines — lines one through ten. -->
[Highlight lines 1-10](action:editor.highlight?path=package.json&lines=1-10) <!-- .fragment -->

<!-- voice[2]: Or highlight a single line — line twenty. -->
[Highlight line 20](action:editor.highlight?path=package.json&lines=20) <!-- .fragment -->

---
notes: Terminal commands require Workspace Trust!
---

<!-- voice: Terminal commands run directly from your slides. They require Workspace Trust. -->

# Terminal Commands

Run a command in the terminal:

<!-- voice[1]: Check the installed npm version. -->
[Show npm version](action:terminal.run?command=npm%20--version) <!-- .fragment -->

<!-- voice[2]: List the files in the project directory. -->
<div class="fragment"> <!-- .fragment -->

```action
type: terminal.run
label: List files
command:
  win32: dir
  darwin: ls -la
  linux: ls -la
```

</div>

---

<!-- voice: Sequences let you chain multiple actions together — open a file and highlight specific lines in one click. -->

# Sequences

Execute multiple actions in order:

[Open and Highlight](action:sequence?actions=file.open%3Fpath%3Dpackage.json,editor.highlight%3Fpath%3Dpackage.json%26lines%3D1-5)

---

<!-- voice: You can embed live file content directly in your slides. This always shows the current version of the file. -->

# Dynamic Content Rendering

Embed file content directly in slides:

[](render:file?path=package.json&lines=1-10)

---

<!-- voice: Command output rendering executes a command and embeds the result right in the slide. Useful for showing versions or directory listings. -->

# Command Output Rendering

Execute a command and embed its output:

[](render:command?cmd=npm%20--version)

[](render:command?cmd=node%20-e%20%22console.log(require(%27fs%27).readdirSync(%27src%27).join(%27%5Cn%27))%22)

---

<!-- voice: Diff rendering shows git changes inline. You can compare any file against a previous commit. -->

# Diff Rendering

View git diffs directly in your slides:

[](render:diff?path=src/renderer/contentRenderer.ts&before=HEAD~3)

---

<!-- voice: Any VS Code command can be triggered from a slide. -->

# VS Code Commands

Execute any VS Code command:

<!-- voice[1]: Open the VS Code settings panel. -->
[Open Settings](action:vscode.command?id=workbench.action.openSettings) <!-- .fragment -->

<!-- voice[2]: Toggle the sidebar visibility. -->
[Toggle Sidebar](action:vscode.command?id=workbench.action.toggleSidebarVisibility) <!-- .fragment -->

<!-- voice[3]: Search for markdown extensions in the marketplace. -->
[Search Extensions](action:vscode.command?id=workbench.extensions.search&args=%22markdown%22) <!-- .fragment -->

---
notes: |
  NEW in v0.2.0 — YAML action blocks!
  Instead of URL-encoded inline links, you can write human-readable YAML.
  Both syntaxes work side by side.
---

<!-- voice: New in version 0.2 — YAML action blocks. Instead of URL-encoded links, you can write actions as readable YAML. Both formats work side by side. -->

# 🆕 YAML Action Blocks

Write actions as readable YAML — no more URL encoding!

**Old way (still works):**

```
[Open File](action:file.open?path=package.json)
```

**New way — human-readable YAML:**

```action
type: file.open
path: package.json
label: Open package.json
```

---

<!-- voice: YAML blocks make complex actions much easier to read. Here we highlight lines in the extension entry point. -->

# YAML Action Blocks — Highlighting

YAML blocks make complex actions much easier to read:

```action
type: editor.highlight
path: src/extension.ts
lines: 1-15
label: Show Extension Entry Point
```

---
notes: |
  This slide shows a sequence in YAML.
  Compare how much cleaner this is than the URL-encoded version!
---

<!-- voice: Sequences are dramatically cleaner in YAML. This one opens a file, highlights key lines, and runs a terminal command — all in a single block. -->

# YAML Sequences

Sequences are dramatically cleaner in YAML:

```action
type: sequence
label: Full Demo Flow
steps:
  - type: file.open
    path: ../src/extension.ts
  - type: editor.highlight
    path: ../src/extension.ts
    lines: 8-20
  - type: terminal.run
    command: echo "Hello from the sequence!"
```

---

<!-- voice: Terminal and VS Code commands in YAML are just as clean. -->

# YAML Terminal & VS Code Commands

<!-- voice[1]: Run an echo command from YAML. -->
<div class="fragment"> <!-- .fragment -->

```action
type: terminal.run
command: echo "YAML blocks are great!"
label: Run Echo Command
```

</div>

<!-- voice[2]: Toggle the sidebar with a single YAML block. -->
<div class="fragment"> <!-- .fragment -->

```action
type: vscode.command
id: workbench.action.toggleSidebarVisibility
label: Toggle Sidebar
```

</div>

---
notes: |
  NEW — Preflight Validation!
  Run Cmd+Shift+P → "Executable Talk: Validate Deck" to catch errors before presenting.
  This slide has intentional errors for you to find with the validator.
---

<!-- voice: Preflight validation catches errors before you present. The validator checks for: -->

# 🔍 Preflight Validation

Run **Validate Deck** (`Cmd+Shift+P`) to catch errors before presenting!

The validator checks for: <!-- .fragment -->

<!-- voice[2]: Missing files in your action links. -->
- ✅ Missing files <!-- .fragment -->
<!-- voice[3]: Out-of-range line numbers in highlight actions. -->
- ✅ Out-of-range line numbers <!-- .fragment -->
<!-- voice[4]: Missing debug configurations. -->
- ✅ Missing debug configurations <!-- .fragment -->
<!-- voice[5]: Unavailable terminal commands on your platform. -->
- ✅ Unavailable terminal commands <!-- .fragment -->
<!-- voice[6]: Trust issues when running in an untrusted workspace. -->
- ✅ Trust issues in untrusted workspaces <!-- .fragment -->

---

<!-- voice: These action blocks have intentional errors. The validator will catch them. -->

# Validation — Intentional Errors

These action blocks have problems the validator will catch:

<!-- voice[1]: This file doesn't exist — the validator flags it. -->
<div class="fragment"> <!-- .fragment -->

```action
type: file.open
path: this/file/does/not/exist.ts
label: Missing File (validator catches this!)
```

</div>

<!-- voice[2]: These line numbers are way out of range. -->
<div class="fragment"> <!-- .fragment -->

```action
type: editor.highlight
path: package.json
lines: 9999-10000
label: Out of Range (validator catches this!)
```

</div>

---
notes: |
  NEW — Error Toasts!
  When actions fail during a live presentation, you get non-blocking toast notifications.
  Try clicking the intentional-error actions on the previous slide to see them!
---

<!-- voice: When actions fail during a presentation, you see a toast notification. -->

# 🔔 Error Notifications

When an action fails during presentation, you'll see a **toast notification**:

<!-- voice[1]: File open errors show which file couldn't be found. -->
- 📄 **file.open** — shows which file couldn't be found <!-- .fragment -->
<!-- voice[2]: Highlight errors show which lines are out of range. -->
- 🔍 **editor.highlight** — shows which lines are out of range <!-- .fragment -->
<!-- voice[3]: Terminal errors show the failing command. -->
- ▶ **terminal.run** — shows the failing command <!-- .fragment -->
<!-- voice[4]: Sequence errors show a step-by-step breakdown. -->
- 🔗 **sequence** — shows step-by-step breakdown (✅ ❌ ⏭) <!-- .fragment -->

<!-- voice[5]: Toasts auto-dismiss after eight seconds. Hover to pause the timer. -->
Toasts auto-dismiss after 8s. Hover to pause the timer. <!-- .fragment -->

---
notes: |
  NEW — Authoring Assistance!
  Try editing this deck file to see autocomplete, hover docs, and diagnostics in action.
  Type "type:" inside an action block to see suggestions.
---

<!-- voice: When editing deck files you get full IDE support. -->

# ✍️ Authoring Assistance

When editing `.deck.md` files, you get full IDE support:

<!-- voice[1]: Autocomplete suggests action types and parameters as you type. -->
- **Autocomplete** — type suggestions after `type:`, parameter suggestions per action type <!-- .fragment -->
<!-- voice[2]: Hover docs show descriptions and parameter tables. -->
- **Hover Docs** — hover on `file.open` or `path` for descriptions and param tables <!-- .fragment -->
<!-- voice[3]: Real-time diagnostics show red squiggles for errors. -->
- **Real-time Diagnostics** — red squiggles for unknown types, missing params, invalid YAML <!-- .fragment -->

<!-- voice[4]: Try it yourself — open this file and edit an action block. -->
*Try it! Open this file and edit an action block.* <!-- .fragment -->

---

<!-- voice: That's the end of the demo. Press Escape to exit, or Ctrl+Z to undo any IDE changes made during the presentation. -->

# The End

Press **Escape** to exit.

Press **Cmd+Z** to undo IDE changes.
