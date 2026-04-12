---
title: "render:file"
basePath: ..
---

# `render:file` — Embed File Content

Embed live file contents directly in the slide.
Content is read at presentation time — always current.

[](render:file?path=package.json&lines=1-10&format=json)

---

# `render:file` — TypeScript

[](render:file?path=src/models/slide.ts&lines=1-30&format=typescript)

---

# `render:file` — No Line Range

Omit `lines` to embed the whole file (use with care on large files):

[](render:file?path=.eslintrc.json&format=json)
