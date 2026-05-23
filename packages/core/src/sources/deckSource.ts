/**
 * DeckSource — abstraction over where decks and their referenced files live.
 *
 * This interface is the single seam that lets the web viewer (and, in the
 * future, other hosts) plug in different backends without changing the
 * parser, renderer, or UI: local Vite dev server, an Azure Functions BFF
 * fronting Azure DevOps Git, etc.
 *
 * Implementations live OUTSIDE @deckpilot/core. Core only owns the contract.
 *
 * Path semantics:
 *  - All paths are source-relative POSIX-style strings (e.g.
 *    "examples/foo.deck.md"). No leading slash, no scheme.
 *  - The source is free to interpret these however it likes (filesystem
 *    paths under a workspace root, ADO repo paths under a fixed branch, …),
 *    as long as `listDecks()` and `readFile()` agree.
 */

/** A discoverable deck as returned by `DeckSource.listDecks()`. */
export interface DeckRef {
  /** Source-relative path; pass back to `readFile()` to fetch the deck. */
  path: string;
  /** Optional human-friendly title for UI. UI may derive one from `path`. */
  title?: string;
}

export interface DeckSource {
  /** Enumerate decks the current caller is allowed to see. */
  listDecks(): Promise<DeckRef[]>;

  /**
   * Read a UTF-8 text file (deck markdown, sidecar YAML, env file).
   * Throws an Error with `code === 'ENOENT'` when the file is missing.
   */
  readFile(path: string): Promise<string>;

  /** Probe existence without reading. Must not throw on missing. */
  exists(path: string): Promise<boolean>;

  /**
   * Resolve a relative asset (typically an image referenced from a deck)
   * to an absolute URL the browser can load directly via `<img src>`.
   * For backends that need per-request auth, return a proxy URL that the
   * BFF will resolve server-side.
   */
  resolveAssetUrl(path: string): string;
}
