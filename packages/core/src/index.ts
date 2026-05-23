/**
 * @deckpilot/core — pure, platform-agnostic Deckpilot logic.
 *
 * Re-exports are intentionally minimal at the root barrel. For tree-shaking
 * and clearer dependencies, prefer importing from the specific subpath:
 *   import { parseDeck } from '@deckpilot/core/parser';
 *   import type { Deck } from '@deckpilot/core/models/deck';
 */

export * from './models';
export * from './parser';
export * from './env';
export * from './renderer';
export * from './sources';
