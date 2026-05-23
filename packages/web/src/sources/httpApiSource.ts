/**
 * HttpApiDeckSource — wraps the dev-server / static-host endpoints:
 *   GET /api/decks            → JSON string[] of deck paths
 *   GET /api/file?path=...    → raw file bytes (text)
 *   HEAD /api/file?path=...   → existence probe
 *
 * Behavior here is intentionally identical to what the web viewer did
 * before the DeckSource abstraction was introduced. A future Azure
 * DevOps-backed source will implement the same interface; nothing else
 * in the web app needs to change.
 */

import type { DeckRef, DeckSource } from '@deckpilot/core/sources/deckSource';

const API_FILE = '/api/file?path=';
const API_DECKS = '/api/decks';

function toRelative(p: string): string {
  return p.startsWith('/') ? p.slice(1) : p;
}

export class HttpApiDeckSource implements DeckSource {
  async listDecks(): Promise<DeckRef[]> {
    const res = await fetch(API_DECKS);
    if (!res.ok) throw new Error(`listDecks failed: HTTP ${res.status}`);
    const paths = (await res.json()) as string[];
    return paths.map((path) => ({ path }));
  }

  async readFile(path: string): Promise<string> {
    const res = await fetch(`${API_FILE}${encodeURIComponent(toRelative(path))}`);
    if (!res.ok) {
      throw Object.assign(new Error(`ENOENT: ${path}`), { code: 'ENOENT' });
    }
    return res.text();
  }

  async exists(path: string): Promise<boolean> {
    const res = await fetch(`${API_FILE}${encodeURIComponent(toRelative(path))}`, { method: 'HEAD' });
    return res.ok;
  }

  resolveAssetUrl(path: string): string {
    return `${API_FILE}${encodeURIComponent(toRelative(path))}`;
  }
}
