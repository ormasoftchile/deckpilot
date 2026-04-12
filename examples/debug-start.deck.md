---
title: "debug.start"
basePath: ..
---

# `debug.start`

Launch a debug session defined in `.vscode/launch.json`.
Requires **Workspace Trust**.

```action
type: debug.start
configName: Extension
label: Start debugger
```

The `configName` value must exactly match the `"name"` field in your `launch.json` configuration.

---

# `debug.start` — Typical Setup

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
configName: Extension
label: Launch Extension Host
```
