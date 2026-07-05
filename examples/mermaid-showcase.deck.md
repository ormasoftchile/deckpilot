---
title: "Mermaid Showcase"
theme: dark
---

# Native Mermaid in Deckpilot

```diagram:mermaid caption="Basic flowchart"
flowchart TD
  Author[Author edits .deck.md] --> Deckpilot
  Deckpilot --> Mermaid
  Mermaid --> SVG[Rendered SVG slide]
```

---

# State transitions

```diagram:mermaid caption="Preview state machine"
stateDiagram-v2
  [*] --> Idle
  Idle --> Rendering: executeAction
  Rendering --> Ready: slideChanged
  Ready --> [*]
```

---

# Theme override

```diagram:mermaid theme=dark caption="Night-mode sequence"
sequenceDiagram
  participant Webview
  participant Conductor
  participant Renderer
  Webview->>Conductor: navigate
  Conductor->>Renderer: render diagrams
  Renderer-->>Webview: slideChanged
```

---

# Gantt with caption

```diagram:mermaid caption="Release readiness"
gantt
  title deckpilot-mermaid Phase 5
  dateFormat  YYYY-MM-DD
  section Validation
  Coexistence tests :done, a1, 2026-07-01, 2d
  Docs refresh      :done, a2, 2026-07-03, 1d
  Release review    :active, a3, 2026-07-05, 1d
```
