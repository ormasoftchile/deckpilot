---
title: "debug.start"
basePath: ..
---

# `debug.start`

Launch a debug session defined in `.vscode/launch.json`.
Requires **Workspace Trust**.

```action
type: debug.start
config: Extension
label: Start debugger
```

The `config` value must exactly match the `"name"` field in your `launch.json` configuration.

---

# `debug.start` — Typical Setup

Example `launch.json` entry this pairs with:

```json
{
  "name": "Extension",
  "type": "extensionHost",
  "request": "launch",
  "args": ["--extensionDevelopmentPath=${workspaceFolder}"]
}
```

```action
type: debug.start
config: Extension
label: Launch Extension Host
```
