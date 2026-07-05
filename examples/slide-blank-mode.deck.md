---
title: "Blank-Line Mode Demo"
---

# Blank-Line Mode (Default)

Runs of 2+ empty lines separate slides by default — no frontmatter flag needed.

A single blank line is still just a paragraph break within a slide.


# Second Slide

Two (or more) blank lines above started this slide. No visible markers needed.

Single blanks between paragraphs stay in the same slide, like this one.


# Code Is Safe

Blank lines inside fenced code do NOT split — this is a single slide:

```python
def foo():

    return 42
```


# Markers Still Work

You can still add an explicit `<!-- slide -->` marker when you want an
unambiguous break (e.g. two slides with no blank gap between them).

<!-- slide -->

# Final Slide

Reached via an explicit marker. Opt out of blank splitting entirely with
`slideBreak: marker` in the deck frontmatter.
