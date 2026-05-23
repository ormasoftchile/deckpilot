/**
 * Single seam for selecting which DeckSource the web viewer uses.
 *
 * Everything in the web app (main.ts, the `fs` stub used by the parser)
 * goes through `getActiveSource()`. Swapping backends — e.g. adding an
 * `AzureDevOpsDeckSource` later — is a one-line change here.
 */

import type { DeckSource } from '@deckpilot/core/sources/deckSource';
import { HttpApiDeckSource } from './httpApiSource';

let active: DeckSource = new HttpApiDeckSource();

export function getActiveSource(): DeckSource {
  return active;
}

/**
 * Override the active source. Intended for bootstrap-time configuration
 * (e.g. reading a runtime config and choosing a backend) and for tests.
 */
export function setActiveSource(source: DeckSource): void {
  active = source;
}

export { HttpApiDeckSource };
