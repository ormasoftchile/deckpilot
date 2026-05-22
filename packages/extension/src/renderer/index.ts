/**
 * Renderer module exports (extension side — vscode-coupled renderers).
 * Pure renderer pieces live in @deckpilot/core/renderer.
 */

export {
  parseRenderDirectives,
} from '@deckpilot/core/renderer/renderDirectiveParser';

export type {
  RenderDirective,
  RenderType,
  FileRenderDirective,
  CommandRenderDirective,
  DiffRenderDirective,
  FileRenderParams,
  CommandRenderParams,
  DiffRenderParams,
} from '@deckpilot/core/renderer/renderDirectiveParser';

export {
  renderFile,
} from './fileRenderer';

export type {
  FileRenderResult,
} from './fileRenderer';

export {
  renderCommand,
  clearCommandCache,
  invalidateCommand,
} from './commandRenderer';

export type {
  CommandRenderResult,
  StreamCallback,
} from './commandRenderer';

export {
  renderDiff,
  parseDiff,
} from './diffRenderer';

export type {
  DiffRenderResult,
  DiffHunk,
  DiffLine,
} from './diffRenderer';

export {
  resolveDirective,
  createLoadingPlaceholder,
  formatAsCommandBlock,
} from './contentRenderer';

export type {
  RenderedBlock,
  LoadingPlaceholder,
} from './contentRenderer';

export {
  renderBlockElements,
  injectBlockElements,
  injectBlockElementsFromParsed,
} from '@deckpilot/core/renderer/blockElementRenderer';
