# deckpilot-triton

Triton diagram renderer for [Deckpilot](https://marketplace.visualstudio.com/items?itemName=focus-space.executable-talk).

Adds support for rendering `diagram:mermaid` fences in `.deck.md` presentations using the [Triton](../../triton) compiler.

## Usage

Install both **deckpilot** and **deckpilot-triton**. Then use diagram fences in your `.deck.md`:

````markdown
```diagram:mermaid {theme: dark, caption: "System overview"}
flowchart TD
  A[User] --> B[API]
  B --> C[Database]
```
````

## Fence syntax

### Diagram fence

````markdown
```diagram:mermaid
row
  cell
    title: My Poster
```
````

Use `diagram:mermaid` for all Triton diagrams, including `flowchart`, `sequence`, `poster`, `architecture`, `topology`, `ds`, `timeline`, `gantt`, and other Triton-supported types.

Valid `theme` values:

- `default`, `executive`, `midnight`, `blueprint`, `editorial` — Triton contract themes or Deckpilot aliases, mapped to Triton presets
- `dark` — mapped to `midnight`
- `light` — mapped to `default`

## Development

This extension lives inside the deckpilot monorepo at `apps/deckpilot-triton/`. Both extensions are loaded simultaneously in the VS Code Extension Development Host using the dual launch config.

### Prerequisites

- Triton built at `../triton/packages/core/dist/` — run `pnpm build` in the triton project
- Node 20+

### Vendor Triton for local development

```sh
npm run vendor-triton
```

This builds a self-contained Triton Mermaid bundle into `dist/vendor/triton/`
where the adapter loads it at runtime via dynamic `import()`.

### Run

Press **F5** from the monorepo root using the **"Run Extension + Triton"** launch configuration, or run both bundles manually:

```sh
# from monorepo root
npm run bundle                              # build deckpilot
cd apps/deckpilot-triton && npm run build  # build deckpilot-triton + vendor Triton
```

### Test

```sh
cd apps/deckpilot-triton && npm test
```

## Architecture

deckpilot-triton is a **companion VS Code extension**. It activates after deckpilot (via `extensionDependencies`) and registers a `TritonDiagramRenderer` with deckpilot's `DiagramRendererRegistry` through the public `registerDiagramRenderer` API.

```
deckpilot (activates first)
  └── exports DeckpilotDiagramAPI { registerDiagramRenderer }

deckpilot-triton (activates second)
  └── calls api.registerDiagramRenderer(new TritonDiagramRenderer(...))
```

To add a different diagram renderer (Graphviz, D2, PlantUML), follow the same pattern: implement `IDiagramRenderer` from `@deckpilot/core/renderer/diagramRenderer` and register it the same way.
