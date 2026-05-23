# Action Reference

Actions are executable steps embedded in slides. Two syntactic forms:

**Inline link** — single action, fits in prose:
```markdown
[Open entry point](action:file.open?path=src/index.ts)
```

**Fenced block** — multi-param or sequence:
````markdown
```action
type: terminal.run
command: npm test
label: Run tests
showCommand: true
```
````

## Common options (all action types)

| Field | Purpose |
|-------|---------|
| `label` | Button text shown to the audience. Defaults to a sensible string per type. |
| `showCommand` | If `true`, the action shows what it will do *before* the click (e.g. terminal commands appear pre-execution). Useful for transparency. |
| `requiresTrust` | Read-only metadata. See per-action notes below. |

## file.open

Opens a file in the editor.

| Field | Required | Notes |
|-------|----------|-------|
| `path` | yes | Workspace-relative or relative to `basePath`. |
| `line` | no | Line number (1-based) to reveal/cursor. |

Trust: **not required.**

```action
type: file.open
path: src/conductor/conductor.ts
line: 42
label: Open the Conductor
```

## editor.highlight

Applies a temporary visual highlight to lines.

| Field | Required | Notes |
|-------|----------|-------|
| `path` | yes | File to highlight. |
| `lines` | yes | Range string: `"10-30"`, or list like `"5, 10-15, 20"`. |

Trust: **not required.**

```action
type: editor.highlight
path: src/conductor/conductor.ts
lines: 1-30
label: The dispatcher
```

## terminal.run

Runs a shell command in an integrated terminal.

| Field | Required | Notes |
|-------|----------|-------|
| `command` | yes | The shell command. |
| `cwd` | no | Working directory (relative to workspace). |
| `name` | no | Terminal name. Re-uses an existing terminal with the same name. |
| `showCommand` | no | If `true`, the command is displayed before being run. |

Trust: **required.** Will be blocked in untrusted workspaces.

```action
type: terminal.run
command: npm test
label: Run tests
showCommand: true
```

## debug.start

Launches a named VS Code debug configuration (from `.vscode/launch.json`).

| Field | Required | Notes |
|-------|----------|-------|
| `name` | yes | Exact name of the launch configuration. |

Trust: **required.**

```action
type: debug.start
name: Launch Extension
label: Start debugging
```

## vscode.command

Invokes any VS Code command by ID. Powerful escape hatch.

| Field | Required | Notes |
|-------|----------|-------|
| `command` | yes | Command ID, e.g. `workbench.action.toggleSidebarVisibility`. |
| `args` | no | Array of arguments passed to the command. |

Trust: **required** for commands that can execute code or alter the workspace.

```action
type: vscode.command
command: workbench.action.splitEditor
label: Split editor
```

## sequence

Chains multiple actions in order. Each step is a regular action object (no `label` needed on steps).

| Field | Required | Notes |
|-------|----------|-------|
| `steps` | yes | Array of action objects. |
| `label` | no | Label shown for the whole sequence. |
| `showCommand` | no | If `true`, all step previews are shown together. |

```action
type: sequence
label: Walk the dispatcher
showCommand: true
steps:
  - type: file.open
    path: src/conductor/conductor.ts
  - type: editor.highlight
    path: src/conductor/conductor.ts
    lines: 1-30
  - type: terminal.run
    command: npm test
```

## Validation actions (advanced)

Run inside `sequence.steps` before user-facing actions to fail fast if the environment isn't ready.

- `validate.command` — check a binary exists (`command: docker`).
- `validate.fileExists` — check a path exists (`path: package.json`).
- `validate.port` — check a port state (`port: 3000`, `state: free|in-use`).

## Wait conditions

`wait.condition` — pause a sequence until a condition holds (e.g. a port opens after `npm start`).

## Browser actions

- `browser.open` — open a URL in an embedded browser panel.
- `browser.navigate` — navigate an already-open browser panel.

See parser tests for current parameter shapes if you need these.

## When to use what

| Need | Use |
|------|-----|
| Show a file | `file.open` |
| Draw attention to lines | `editor.highlight` (often after `file.open`) |
| Run a command | `terminal.run` |
| Start a debug session | `debug.start` |
| Multi-step demo | `sequence` |
| Toggle a VS Code panel/setting | `vscode.command` |
| Live file/diff/command output **inside the slide** (not a button) | `render:*` directives (see `format.md`) |
