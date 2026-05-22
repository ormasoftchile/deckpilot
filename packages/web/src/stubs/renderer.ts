/**
 * Renderer stub for the web app — re-exports only value exports from renderer/index.ts
 * to avoid esbuild stripping type-only exports (interfaces) causing runtime ES module errors.
 *
 * Type-only exports (interfaces/types) are intentionally omitted here; they're only
 * needed at compile time and main.ts doesn't import them as values.
 */

export { parseRenderDirectives } from '../../../core/src/renderer/renderDirectiveParser';
export { renderFile } from '../../../extension/src/renderer/fileRenderer';
export { renderCommand, clearCommandCache, invalidateCommand } from '../../../extension/src/renderer/commandRenderer';
export { renderDiff, parseDiff } from '../../../extension/src/renderer/diffRenderer';
export { resolveDirective, createLoadingPlaceholder, formatAsCommandBlock } from '../../../extension/src/renderer/contentRenderer';
export { renderBlockElements, injectBlockElements, injectBlockElementsFromParsed } from '../../../core/src/renderer/blockElementRenderer';
