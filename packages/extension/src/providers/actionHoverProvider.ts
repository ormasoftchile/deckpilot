/**
 * ActionHoverProvider — re-export shim.
 *
 * The implementation now lives in the framework-neutral `@deckpilot/language`
 * package so the VS Code extension, the web editor, and a future LSP all share
 * ONE engine. This file preserves the historical import path
 * (`providers/actionHoverProvider`) that the extension and unit tests consume.
 * No behavior changes — the class is identical.
 */

export { ActionHoverProvider, getHover } from '@deckpilot/language';
export type { HoverResult } from '@deckpilot/language';
