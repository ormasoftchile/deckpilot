/**
 * Renderer module exports (pure, no VS Code dependencies)
 */

export {
  parseRenderDirectives,
} from './renderDirectiveParser';

export type {
  RenderDirective,
  RenderType,
  FileRenderDirective,
  CommandRenderDirective,
  DiffRenderDirective,
  FileRenderParams,
  CommandRenderParams,
  DiffRenderParams,
} from './renderDirectiveParser';

export {
  renderBlockElements,
  injectBlockElements,
  injectBlockElementsFromParsed,
} from './blockElementRenderer';

export type {
  IDiagramRenderer,
  DeckpilotDiagramAPI,
} from './diagramRenderer';

export {
  injectDiagramPlaceholders,
} from './diagramPlaceholderRenderer';
