/**
 * Renderer stub for the web app — re-exports only value exports from renderer/index.ts
 * to avoid esbuild stripping type-only exports (interfaces) causing runtime ES module errors.
 *
 * Type-only exports (interfaces/types) are intentionally omitted here; they're only
 * needed at compile time and main.ts doesn't import them as values.
 */

export { parseRenderDirectives } from '../../src/renderer/renderDirectiveParser';
export { renderFile } from '../../src/renderer/fileRenderer';
export { renderCommand, clearCommandCache, invalidateCommand } from '../../src/renderer/commandRenderer';
export { renderDiff, parseDiff } from '../../src/renderer/diffRenderer';
export { resolveDirective, createLoadingPlaceholder, formatAsCommandBlock } from '../../src/renderer/contentRenderer';
export { renderBlockElements, injectBlockElements, injectBlockElementsFromParsed } from '../../src/renderer/blockElementRenderer';
