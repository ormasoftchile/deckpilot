---
title: "Slide Markers Demo"
---

# Marker Mode

This deck uses the new canonical `<!-- slide -->` delimiter instead of `---`.

The comment is invisible when this file is viewed in any plain Markdown viewer.

<!-- slide 2 - features -->

# Second Slide

Markers accept an optional label for readability (e.g. `<!-- slide 2 - features -->`).
The label is decorative and ignored by the parser.

- Bullet one
- Bullet two

<!-- slide 3 - code safety -->

# Code Is Safe

Delimiters inside fenced code blocks are ignored — this whole block is one slide:

```md
<!-- slide -->
---
```

<!-- slide -->

# Backward Compatible

Old `---` separators still work, but now emit a deprecation warning:

---

# Final Slide

Reached via a legacy `---` separator above.
