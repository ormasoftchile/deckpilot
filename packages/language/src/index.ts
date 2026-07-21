/**
 * @deckpilot/language — framework-neutral Deckpilot language intelligence.
 *
 * Completion, hover, and diagnostics for `.deck.md` / `.deck.yaml` authoring.
 * Depends ONLY on `@deckpilot/core`; never touches `vscode`, `fs`, `path`, or
 * `child_process`. Host adapters (VS Code extension, web editor, future LSP)
 * map the returned plain data onto their own APIs.
 */

// Document abstraction
export type { TextDocument, TextLine, Position } from './textDocument';

// Host-injected existence-check seam
export type { EnvExistenceChecker } from './envExistenceChecker';

// Pure rule-name validation
export { isValidRule } from './validationRules';

// Completion
export { ActionCompletionProvider, getCompletions, CompletionKind } from './completion';
export type { CompletionItem } from './completion';

// Hover
export { ActionHoverProvider, getHover } from './hover';
export type { HoverResult } from './hover';

// Diagnostics
export { ActionDiagnosticProvider, getDiagnostics, DiagnosticSeverity } from './diagnostics';
export type { DiagnosticResult } from './diagnostics';
