/**
 * Minimal fs stub for Vite (browser environment).
 *
 * The parser and a few helpers in @deckpilot/core import `fs` to read
 * sidecars, env files, etc. In the browser we route those reads through
 * the active DeckSource so there is exactly one place where "where do
 * files come from?" is answered. See packages/web/src/sources/index.ts.
 */

import { getActiveSource } from '../sources';

function toRelative(p: string): string {
  return p.startsWith('/') ? p.slice(1) : p;
}

async function readFile(p: string, _encoding: string): Promise<string> {
  try {
    return await getActiveSource().readFile(toRelative(p));
  } catch (err) {
    const e = err as { code?: string };
    if (e?.code !== 'ENOENT') {
      throw Object.assign(new Error(`ENOENT: ${p}`), { code: 'ENOENT' });
    }
    throw err;
  }
}

async function access(p: string): Promise<void> {
  const ok = await getActiveSource().exists(toRelative(p));
  if (!ok) throw Object.assign(new Error(`ENOENT: ${p}`), { code: 'ENOENT' });
}

export const promises = { readFile, access };
export const constants = { F_OK: 0 };
