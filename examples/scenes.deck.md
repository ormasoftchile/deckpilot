---
title: "scenes + navigation"
basePath: ..
scenes:
  - name: start
    slide: 1
  - name: demo
    slide: 3
---

# Scenes & Navigation

Scenes let you jump to named checkpoints without navigating slide by slide.

**Keyboard shortcuts:**
- `Ctrl+G` / `Cmd+G` — open the slide picker
- `Alt+Left` — go back to the previous slide
- Type a slide number + `Enter` — jump directly

---

# Breadcrumb Trail

The breadcrumb bar at the bottom shows your navigation history.
Each entry shows the slide number and how you arrived:

| Symbol | Meaning |
|---|---|
| `→` | Sequential (arrow keys) |
| `⤳` | Jump (number or picker) |
| `←` | Go back |
| `📌` | Scene restore |

Click any breadcrumb to jump back to that slide.

---

# Named Scenes in Frontmatter

```yaml
scenes:
  - name: start
    slide: 1
  - name: demo
    slide: 3
```

Define scenes in deck frontmatter — each `name` becomes an entry in the scene picker.

This deck has two scenes: **start** (slide 1) and **demo** (this slide).

Open the scene picker (`Ctrl+R` / `Cmd+R`) and select **start** to jump back.
