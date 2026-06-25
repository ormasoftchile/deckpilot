# De Unamuno — Conductor diagram wiring

## What changed

- Added `DiagramRendererRegistry` ownership to `Conductor`, initialized it in the constructor, and exposed it through `getDiagramRegistry()`.
- Wired slide navigation to kick off async diagram resolution from `goToSlide()` after the slide HTML is sent to the webview.
- Implemented `resolveSlideAsyncDiagrams()` in `conductor.ts` to render diagram blocks through registered adapters and send `renderBlockUpdate` messages for success and error states.
- Added local `escapeHtml()` helper in `conductor.ts` because the file did not already define or import one.
- Changed `activate()` in `extension.ts` to return `DeckpilotDiagramAPI`, allowing companion extensions to register `IDiagramRenderer` instances at runtime.
- Created `packages/extension/src/renderer/diagram/registry.ts` with the diagram renderer registry implementation.

## Notes / issues found

- `resolvedBasePath()` already existed in `Conductor`, so it was reused as the diagram `workspaceRoot`/base path source.
- Validation target requested by the task was `npm run compile`; no extra TypeScript issues were introduced after the wiring changes.
