/**
 * Contract tests for the `DeckSource` abstraction defined in
 * `@deckpilot/core/sources/deckSource`.
 *
 * Concrete implementations live in their host packages (e.g.
 * `packages/web/src/sources/httpApiSource.ts`) which are NOT part of the
 * root TypeScript project. Their behavior is exercised end-to-end by
 * each host's own tests; here we only verify the contract.
 */

import { expect } from 'chai';
import type { DeckSource, DeckRef } from '@deckpilot/core/sources/deckSource';

describe('DeckSource contract', () => {
  it('is implementable by a minimal fake', async () => {
    const refs: DeckRef[] = [{ path: 'a.deck.md' }, { path: 'b.deck.md', title: 'B' }];

    const fake: DeckSource = {
      listDecks: () => Promise.resolve(refs),
      readFile: (p: string) => Promise.resolve(`content of ${p}`),
      exists: (_p: string) => Promise.resolve(true),
      resolveAssetUrl: (p: string) => `/assets/${p}`,
    };

    expect(await fake.listDecks()).to.deep.equal(refs);
    expect(await fake.readFile('x')).to.equal('content of x');
    expect(await fake.exists('x')).to.equal(true);
    expect(fake.resolveAssetUrl('img.png')).to.equal('/assets/img.png');
  });

  it('readFile() implementations signal missing files via Error.code === "ENOENT"', async () => {
    const missingFs: DeckSource = {
      listDecks: () => Promise.resolve([]),
      readFile: (p: string) => {
        throw Object.assign(new Error(`ENOENT: ${p}`), { code: 'ENOENT' });
      },
      exists: () => Promise.resolve(false),
      resolveAssetUrl: (p: string) => p,
    };

    try {
      await missingFs.readFile('nope.deck.md');
      expect.fail('expected readFile to throw');
    } catch (err) {
      const e = err as { code?: string; message: string };
      expect(e.code).to.equal('ENOENT');
      expect(e.message).to.include('nope.deck.md');
    }
  });

  it('exists() must not throw for missing files', async () => {
    const src: DeckSource = {
      listDecks: () => Promise.resolve([]),
      readFile: (p: string) => Promise.reject(new Error(`ENOENT: ${p}`)),
      exists: () => Promise.resolve(false),
      resolveAssetUrl: (p: string) => p,
    };
    expect(await src.exists('missing.deck.md')).to.equal(false);
  });
});
