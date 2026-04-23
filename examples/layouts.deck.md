---
title: "layouts"
basePath: ..
---

# `<!-- center -->` Layout

<!-- center -->
## This content is centered

Use for title slides or emphasis moments.
<!-- /center -->

---

# `<!-- columns -->` Layout

<!-- columns -->
<!-- left -->
- Point one
- Point two
- Point three
<!-- /left -->
<!-- right -->
- `npm install`
- `npm run build`
- `npm test`
<!-- /right -->
<!-- /columns -->

---

# `<!-- advanced -->` — Progressive Disclosure

The advanced block is collapsed by default. Click to expand:

Here is the main explanation that everyone sees.

<!-- advanced -->
### Under the Hood

This is the deep-dive content — architecture details, edge cases, or implementation notes that only some audience members need.
<!-- /advanced -->

---

# `<!-- optional -->` — Optional Steps

Mark a step as optional so it doesn't block progress:

Follow the main path here.

<!-- optional -->
If you want to explore further, try this extra step:

```action
type: terminal.run
command: npm run lint
label: Also run linting
```
<!-- /optional -->
