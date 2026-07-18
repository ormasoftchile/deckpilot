---
title: Deckpilot Viewer — Sample Deck
author: Deckpilot
theme: dark
diagrams:
  theme: executive
---

# Deckpilot Viewer

A read-only browser viewer for `.deck.md` presentations.

- Renders public decks from any HTTPS URL
- No install, no execution, no auth
- Works on Azure Static Web Apps, GitHub Pages, any static host

---

## How it works

1. You paste a public deck URL
2. The viewer fetches the markdown
3. It auto-discovers a sibling `.deck.yaml` sidecar (if any)
4. Slides render with **Reveal.js** + sanitized HTML

Use **arrow keys** to navigate. Press **N** to toggle speaker notes.

---

## Code blocks render normally

```ts
import { parseDeck } from '@deckpilot/core/parser';

const result = await parseDeck(content, filePath);
console.log(result.deck?.slides.length);
```

```sh
deck render ./demo.deck.md
```

---

## Triton diagrams render in the browser

The slide heading and this intro should appear before the themed progressive diagram.

```diagram:triton {theme:minimal caption:"Theme + progressive reveal + source order test"}
list
  title Viewer progressive diagram pipeline
  style tree
  reveal sequence
  effect slide
  Parse Deckpilot markdown
  Render Triton SVG
  Sanitize and inject into Reveal.js
```

---

## Mermaid diagrams use Triton too

```diagram:mermaid {theme:minimal}
flowchart LR
  A[Deck fence] --> B[Triton compiler]
  B --> C[Sanitized SVG]
  C --> D[Reveal slide]
```

---

## Action links are display-only

This is the key safety property of the public viewer:

[Open the readme](action:file.open?path=README.md)

[Run the dev server](action:terminal.run?command=npm%20run%20dev)

[Start debugging](action:debug.start?configName=Launch)

These actions render visually, show metadata on hover, but **never execute**.
Open the deck in Deckpilot for VS Code to run them.

<!-- voice: Walk through each disabled button. They are visual placeholders only. -->

---

## Fragments work

Deckpilot reveals each block-level element on its own step, in document order.

First, this paragraph appears.

Then this one.

Finally this one — use the arrow keys to step through.

A bullet list normally reveals in one step, but `<!-- .fragment-each -->`
makes each item step on its own:

- One <!-- .fragment-each -->
- Two
- Three

---

## Sidecar metadata

If a `.deck.yaml` file lives next to the `.deck.md`, the viewer merges it
automatically — voice cues, durations, action overrides, scene anchors.

```yaml
slides:
  - id: intro
    duration: "2m"
    cues:
      - "Welcome the audience"
      - "Mention the agenda"
```

---

## Deep links

The current slide number is reflected in the URL hash:

`https://viewer.example.com/?url=https://.../demo.deck.md#slide=3`

Refresh the page — you'll land on slide 3 again. Share the URL and your
audience will too.

---

## That's it

Open in [Deckpilot for VS Code](https://github.com/ormasoftchile/deckpilot)
to run the actions, record screencasts, and author your own decks.
