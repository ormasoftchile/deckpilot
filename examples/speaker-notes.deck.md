---
title: "speaker notes + voice"
basePath: ..
---

# Speaker Notes

Add per-slide notes in the slide separator or with the `notes` frontmatter key.
Notes appear in the presenter view, not the main display.

---
notes: |
  This is the speaker note for this slide.
  It can be multi-line. Only you see this — not the audience.
---

# Slide With Notes

The audience sees this slide content.

You see the notes in your presenter panel.

---

# `<!-- voice -->` — Narration Cues

Voice cues annotate when specific content should be mentioned.
Used by the recording system to sync transcript to slide state.

<!-- voice: Introduce the slide topic here. This plays when the slide first appears. -->

Content appears here.

<!-- voice[1]: Mention this when the first fragment appears. -->
- First fragment

<!-- voice[2]: Now explain the second point. -->
- Second fragment

---

# Combined: Notes + Voice

---
notes: Remind the audience to look at the terminal on the right.
---

<!-- voice: Open the extension entry point and walk through the activation function. -->

# Activation Walkthrough

<!-- voice[1]: The imports at the top pull in the Conductor and all the providers. -->

```action
type: editor.highlight
path: src/extension.ts
lines: 1-15
label: Show imports
```

<!-- voice[2]: The activate function registers all commands and providers. -->

```action
type: editor.highlight
path: src/extension.ts
lines: 20-50
label: Show activate()
```
