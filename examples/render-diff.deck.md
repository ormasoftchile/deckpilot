---
title: "render:diff"
basePath: ..
---

# `render:diff` — Show Git Diffs

Render a git diff inline. Perfect for code review presentations.

Compare `package.json` against the previous commit:

[](render:diff?path=package.json&ref=HEAD~1)

---

# `render:diff` — Specific Commit

Compare against any ref — commit hash, tag, or branch:

[](render:diff?path=src/extension.ts&ref=HEAD~3)
