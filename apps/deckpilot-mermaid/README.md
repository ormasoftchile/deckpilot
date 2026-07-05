# deckpilot-mermaid

Native Mermaid diagram support for [Deckpilot](https://marketplace.visualstudio.com/items?itemName=focus-space.executable-talk).

## Requirements

- Deckpilot (`focus-space.executable-talk`) installed
- VS Code 1.95+

## What it does

This companion extension registers a native Mermaid renderer with Deckpilot. In Phase 2 the renderer is scaffolded and returns a placeholder while Phase 3 implements full Mermaid SVG rendering.

## Usage

Install both **Deckpilot** and **Mermaid Diagrams for Deckpilot**, then open a deck with Mermaid diagram fences such as:

````markdown
```diagram:mermaid
flowchart TD
  A[Deckpilot] --> B[Mermaid]
```
````

Deckpilot activates first, exposes its diagram renderer API, and `deckpilot-mermaid` registers the Mermaid renderer with priority 10 so it can coexist with lower-priority Mermaid fallbacks.
