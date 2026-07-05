# Mermaid Extension Summary

## What was built

`deckpilot-mermaid` is a companion VS Code extension that adds native Mermaid rendering to Deckpilot. It plugs into Deckpilot's shared diagram renderer registry, renders Mermaid diagrams to SVG offline when possible, and falls back cleanly when another renderer or the webview path is a better fit.

## Key decisions

- **Renderer priority:** Mermaid registers at priority `10`, above Triton's Mermaid fallback priority `5`
- **Fallback pattern:** the registry walks candidate renderers in priority order and falls through when a renderer returns `ok: false`
- **Native JS rendering:** Mermaid uses Mermaid.js plus `jsdom` for server-side SVG generation, then falls back to webview rendering on timeout/runtime failures
- **Companion extension design:** Deckpilot exports the renderer API; `deckpilot-mermaid` and `deckpilot-triton` register independently

## Phases 0–5 overview

### Phase 0 — scaffolding

- Created the standalone `apps/deckpilot-mermaid` workspace
- Wired activation through Deckpilot's public diagram API

### Phase 1 — registry integration

- Added renderer registration and priority-based coexistence behavior
- Established the shared `IDiagramRenderer` contract

### Phase 2 — native renderer shell

- Added Mermaid renderer capabilities, theme mapping, and placeholder/fallback behavior

### Phase 3 — SVG rendering

- Implemented Mermaid.js + `jsdom` rendering, syntax validation, timeout handling, and wrapped SVG output

### Phase 4 — UX polish

- Added theme overrides, caption support through Deckpilot's diagram service, and preview/webview fallback behavior

### Phase 5 — final validation

- Added coexistence coverage with Triton
- Added edge-case renderer tests for timeout, unicode, repeated renders, and theme switching
- Refreshed docs and examples
- Reviewed release workflow coverage for packaging both VSIX artifacts

## Files changed or added

### Core / shared integration

- `packages/core/src/renderer/diagramRenderer.ts`
- `packages/extension/src/renderer/diagram/registry.ts`
- `test/unit/services/diagramService.test.ts`

### Triton companion

- `apps/deckpilot-triton/src/tritonAdapter.ts`
- `apps/deckpilot-triton/test/unit/tritonAdapter.test.ts`

### Mermaid companion

- `apps/deckpilot-mermaid/src/extension.ts`
- `apps/deckpilot-mermaid/src/mermaidRenderer.ts`
- `apps/deckpilot-mermaid/src/theme.ts`
- `apps/deckpilot-mermaid/test/unit/mermaidRenderer.test.ts`
- `apps/deckpilot-mermaid/test/unit/coexistence.test.ts`
- `apps/deckpilot-mermaid/README.md`

### Examples and docs

- `examples/mermaid-showcase.deck.md`
- `docs/MERMAID_EXTENSION_SUMMARY.md`

## Testing coverage

- Mermaid unit tests for success, syntax errors, theme overrides, timeout fallback, unicode content, repeated renders, and auto-theme switching
- Coexistence tests for Mermaid priority over Triton fallback, explicit `diagram:triton`, unsupported Mermaid-native types, graceful fallback, and dual-failure reporting
- Triton unit coverage updated for explicit `diagram:triton`
- Root diagram service coverage updated for escaped Unicode/emoji captions
- Release workflow reviewed for version bumping, packaging, and GitHub release uploads of:
  - `executable-talk-*.vsix`
  - `deckpilot-triton-*.vsix`
  - `deckpilot-mermaid-*.vsix`

## Release workflow validation notes

`.github/workflows/release.yml`:

- bumps the root extension version with `npm run version:<kind>`
- mirrors that version into `apps/deckpilot-triton/package.json` and `apps/deckpilot-mermaid/package.json`
- builds the root extension, Triton companion, and Mermaid companion
- packages and uploads all three VSIX artifacts to the GitHub release

## Manual smoke test

CLI validation can build and test the extensions, but it cannot visually confirm slideshow rendering in a VS Code Extension Development Host. Use `examples/mermaid-showcase.deck.md` for a quick post-build manual smoke test covering flowchart, state, sequence, Gantt, captions, and theme override behavior.

## Next steps

- Bundle a stronger offline fallback story for Mermaid-only environments
- Expose advanced Mermaid config passthrough where safe
- Validate export parity across recording/export paths
- Add optional visual regression coverage for rendered SVG output
# Release retry
