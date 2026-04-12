---
title: "vscode.command"
basePath: ..
---

# `vscode.command`

Execute any VS Code command from a slide.
Find command IDs in the Command Palette (`Cmd+Shift+P`) — hover any entry to copy its ID.

```action
type: vscode.command
id: workbench.action.toggleSidebarVisibility
label: Toggle Sidebar
```

```action
type: vscode.command
id: workbench.action.terminal.focus
label: Focus Terminal
```

---

# `vscode.command` — With Arguments

Pass arguments using the `args` param:

```action
type: vscode.command
id: workbench.extensions.search
args: "@category:themes"
label: Browse Themes
```

```action
type: vscode.command
id: workbench.action.openSettings
args: "editor.fontSize"
label: Open Font Size Setting
```
