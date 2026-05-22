/**
 * Stub for renderDirectiveParser — re-exports real value functions plus dummy
 * constants for the interface names. Interfaces are stripped by esbuild but
 * ES module linking requires named exports to exist, so we provide empty values.
 * These interfaces are never used as runtime values so undefined is safe.
 */

export { parseRenderDirectives } from '../../../core/src/renderer/renderDirectiveParser';

// Dummy exports for TypeScript interfaces — never used as values at runtime
export const RenderDirective = undefined;
export const FileRenderDirective = undefined;
export const CommandRenderDirective = undefined;
export const DiffRenderDirective = undefined;
export const FileRenderParams = undefined;
export const CommandRenderParams = undefined;
export const DiffRenderParams = undefined;
export const RenderDirectiveBase = undefined;
export const RenderType = undefined;
