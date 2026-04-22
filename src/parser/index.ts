/**
 * Parser module - orchestrates deck parsing pipeline
 */

export { parseDeck, isValidDeckFile, type ParseResult } from './deckParser';
export { parseSlides, renderMarkdown, getLastParseWarnings } from './slideParser';
export { parseActionLinks, parseActionUri } from './actionLinkParser';
export { parseActionBlocks, type ActionBlockParseResult, type ActionBlockParseError } from './actionBlockParser';
export { resolveSidecarPath, sidecarExists, loadSidecar } from './sidecarLoader';
export type { SidecarFile, SidecarSlide, SidecarAction, SidecarDeck, SidecarRecording, SidecarExport } from '../models/sidecar';
