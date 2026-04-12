---
title: "onboarding mode"
basePath: ..
options:
  mode: onboarding
  showProgress: true
---

# Onboarding Mode

Set `mode: onboarding` in frontmatter to enable step-by-step guidance with validation and checkpoints.

The progress bar at the bottom tracks steps, not slide numbers.

---

# `validate.command` — Check Tools
<!-- checkpoint: tools-ok -->

Validate that a CLI tool is installed before proceeding:

```action
type: validate.command
command: node --version
label: Check Node.js
```

```action
type: validate.command
command: git --version
label: Check Git
```

If validation fails a **Retry** button appears — the user stays on this step until it passes.

---

# `validate.fileExists` — Check Files
<!-- checkpoint: files-ok -->

Confirm required files are present:

```action
type: validate.fileExists
path: package.json
label: package.json exists
```

```action
type: validate.fileExists
path: tsconfig.json
label: tsconfig.json exists
```

---

# `validate.port` — Check Services
<!-- checkpoint: services-ok -->

Check that a required service is reachable:

```action
type: validate.port
port: 3000
label: Dev server is running on :3000
```

Start it first if needed:

```action
type: terminal.run
command: npm run dev
label: Start dev server
```
