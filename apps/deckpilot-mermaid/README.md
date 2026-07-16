# deckpilot-mermaid

Native Mermaid diagram support for [Deckpilot](https://marketplace.visualstudio.com/items?itemName=focus-space.executable-talk).

## What it does

`deckpilot-mermaid` is a companion VS Code extension for Deckpilot. It registers a native Mermaid renderer (priority `10`) that renders Mermaid diagrams server-side as SVG using Mermaid.js. When `deckpilot-triton` is also installed, its higher-priority renderer (priority `20`) handles standard `diagram:mermaid` fences so they share Triton's theme presets; this engine then covers the mermaid-native types Triton declines, and remains the primary renderer when Triton is not installed.

When Mermaid cannot handle a diagram natively, Deckpilot can still fall back to other registered renderers or the webview fallback flow.

## Requirements

- Deckpilot (`focus-space.executable-talk`) installed
- VS Code 1.95+

## Install

### From the VS Code Extensions view

1. Install **Deckpilot**
2. Install **Mermaid Diagrams for Deckpilot** (`deckpilot-mermaid`)
3. Reload VS Code if prompted

### From source

```sh
npm ci
npm --workspace deckpilot-mermaid run build
cd apps/deckpilot-mermaid
npx vsce package --no-dependencies
```

Install the generated `.vsix` from VS Code with **Extensions: Install from VSIX...**

## Usage

Open a `.deck.md` file and add Mermaid diagram fences.

### Basic flowchart

````markdown
```diagram:mermaid
flowchart TD
  A[Deckpilot] --> B[Mermaid]
  B --> C[SVG in slides]
```
````

### State diagram

````markdown
```diagram:mermaid caption="Preview state machine"
stateDiagram-v2
  [*] --> Idle
  Idle --> Rendering: executeAction
  Rendering --> Ready: slideChanged
  Ready --> [*]
```
````

### Gantt with caption

````markdown
```diagram:mermaid caption="Release checklist"
gantt
  title Release readiness
  dateFormat  YYYY-MM-DD
  section Validation
  Tests complete    :done, a1, 2026-07-01, 2d
  Docs updated      :done, a2, 2026-07-03, 1d
  Release review    :active, a3, 2026-07-05, 1d
```
````

### Theme override

````markdown
```diagram:mermaid theme=dark caption="Night mode architecture"
flowchart LR
  Webview --> Conductor --> Renderer
```
````

`theme=auto` follows the active Deckpilot preview theme. Explicit `theme=` values override that detection.

## Supported Mermaid diagram types

Major Mermaid-native diagram families supported by this extension include:

- Flowcharts
- Sequence diagrams
- State diagrams
- Class diagrams
- Entity relationship diagrams
- User journey diagrams
- Gantt charts
- Pie charts
- Git graphs
- Mind maps
- Timeline diagrams
- Sankey diagrams
- Requirement diagrams
- Quadrant charts

If Mermaid.js adds support for a new type and the bundled runtime can parse it, Deckpilot can render it without extra configuration.

## Coexistence and fallback behavior

- `deckpilot-mermaid` registers priority `10`
- `deckpilot-triton`'s main renderer registers priority `20`; its built-in Mermaid fallback registers priority `5`
- When Triton is installed, `diagram:mermaid` renders through Triton so it shares Triton's theme presets
- Mermaid-native types Triton declines (`block-beta`, `kanban`, `packet-beta`, `xychart-beta`) fall back to the `deckpilot-mermaid` engine (`10`)
- When Triton is not installed, `deckpilot-mermaid` is the primary renderer for `diagram:mermaid`
- Explicit `diagram:triton` fences always stay on Triton
- If native offline rendering times out or fails unexpectedly, the webview fallback can still render Mermaid.js in the presentation

## Known limitations

- Offline native rendering still depends on Mermaid.js and `jsdom`; if that path fails, Deckpilot falls back to webview rendering
- If Triton is installed, some unsupported Mermaid-native diagrams may be claimed by Triton instead of showing a native Mermaid error
- Export parity between every Mermaid feature and every Deckpilot presentation workflow is still evolving

## Troubleshooting

### Diagram does not render

- Confirm the fence starts with `diagram:mermaid`
- Validate Mermaid syntax in the source block
- Check whether another renderer extension is installed and intentionally taking the fallback path
- Open **Developer: Toggle Developer Tools** and inspect console warnings from `deckpilot-mermaid`

### Diagram uses the wrong theme

- Try `theme=dark`, `theme=light`, or `theme=contrast` explicitly on the fence
- If using `theme=auto`, verify the active Deckpilot preview theme
- Reload the preview after switching VS Code or Deckpilot theme if you were already viewing the slide

## Development

```sh
npm --workspace deckpilot-mermaid run build
npm --workspace deckpilot-mermaid run test
```

For a ready-made sample deck, open [`examples/mermaid-showcase.deck.md`](../../examples/mermaid-showcase.deck.md).
