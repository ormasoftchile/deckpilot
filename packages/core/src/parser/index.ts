/**
 * Parser module - orchestrates deck parsing pipeline
 */

export { parseDeck, isValidDeckFile, readDeckContentImport, type ParseResult } from './deckParser';
export { parseSlides, renderMarkdown, getLastParseWarnings, getLastValidationDiagnostics } from './slideParser';
export { parseActionLinks, parseActionUri } from './actionLinkParser';
export { parseActionBlocks, type ActionBlockParseResult, type ActionBlockParseError } from './actionBlockParser';
export { resolveSidecarPath, sidecarExists, loadSidecar } from './sidecarLoader';
export { mergeSidecarIntoSlides, mergeSidecarDeckMetadata } from './mergeEngine';
export type { SidecarFile, SidecarSlide, SidecarAction, SidecarDeck, SidecarRecording, SidecarExport } from '../models/sidecar';
export { validateSlideIds, SlideDiagnosticSeverity, type SlideDiagnosticResult } from './deckValidator';
