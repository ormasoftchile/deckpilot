/**
 * @deckpilot/preview — the deck-rendering surface.
 *
 * CSS is NOT re-exported here (it's a side-effect import). `<DeckPreview>`
 * self-imports its own `./styles.css`; consumers who need the sheet without the
 * component can import it via the `@deckpilot/preview/styles.css` subpath.
 */

export { DeckPreview } from './DeckPreview';
export type { DeckPreviewHandle, DeckPreviewProps } from './DeckPreview';

export { buildSlides } from './buildSlides';
export type { RenderedSlide } from './buildSlides';

export { renderSlideDiagrams, renderDiagramSourceToSvg } from './diagramRenderer';
export { sanitizeSlideHtml, unfragmentLeadingBlock } from './sanitize';
export { rewriteActionLinks } from './actionRenderer';
export { initializeTritonRevealFragments } from './tritonRevealRuntime';
export { readSlideFromHash, writeSlideToHash, onHashChange } from './hashRouter';
