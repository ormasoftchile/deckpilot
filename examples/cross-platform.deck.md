---
title: "cross-platform commands"
basePath: ..
---

# Cross-Platform Commands

Use a map instead of a single string to run the right command per OS.
The current platform's key is selected at execution time.

```action
type: terminal.run
label: List directory
command:
  macos: ls -la
  windows: dir
  linux: ls -la
```

---

# Path Placeholders

Use built-in placeholders that resolve per platform:

| Placeholder | macOS/Linux | Windows |
|---|---|---|
| `${pathSep}` | `/` | `\` |
| `${home}` | `/Users/you` | `C:\Users\you` |
| `${shell}` | `/bin/zsh` | `cmd.exe` |
| `${pathDelimiter}` | `:` | `;` |

```action
type: terminal.run
command: echo "home is ${home}"
label: Show home directory
```

---

# `default` Fallback

Add a `default` key to handle unknown or unlisted platforms gracefully:

```action
type: terminal.run
label: Check package manager
command:
  macos: brew --version
  windows: winget --version
  linux: apt --version
  default: echo "No package manager configured"
```
