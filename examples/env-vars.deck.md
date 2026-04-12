---
title: "env vars + showCommand"
basePath: ..
---

# `{{VAR}}` — Environment Variable Interpolation

Define variables in a `.env` file at the deck's `basePath`.
Use `{{VAR}}` anywhere in slide content or action params.

If `MY_APP=production` is set:

> Deploying to **{{MY_APP}}**

The resolved value appears in the slide for the audience to see.

---

# `{{VAR}}` in Action Params

Variables in action params are resolved at execution time:

```action
type: terminal.run
command: echo "Deploying to {{DEPLOY_ENV}}"
label: Show deploy target
```

Secrets stay masked — non-secret vars get their value substituted.

---

# `showCommand: true`

Render a code preview next to the button so the audience sees what will run **before** clicking:

```action
type: terminal.run
command: npm run build -- --env {{DEPLOY_ENV}}
label: Build for deployment
showCommand: true
```

```action
type: file.open
path: src/extension.ts
label: Open extension
showCommand: true
```
