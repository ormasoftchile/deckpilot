/**
 * Tests for collectWatchPaths — confirms the watch set covers sidecar, env,
 * `content:` import, and render directive paths, and skips render:command.
 */

import { expect } from 'chai';
import * as path from 'path';
import { collectWatchPaths } from '../../../packages/extension/src/preview/collectWatchPaths';
import type { Deck } from '../../../packages/core/src/models/deck';
import type { Slide } from '../../../packages/core/src/models/slide';

function makeSlide(index: number, content: string): Slide {
  return {
    index,
    content,
    html: '',
    onEnterActions: [],
    interactiveElements: [],
    renderDirectives: [{ id: `r-${index}`, type: 'file', rawDirective: '', position: { start: 0, end: 0 } }],
    fragmentCount: 0,
  };
}

function makeDeck(filePath: string, slides: Slide[], metadataExtra: Record<string, unknown> = {}): Deck {
  return {
    filePath,
    title: 'Test',
    slides,
    currentSlideIndex: 0,
    metadata: { title: 'Test', ...metadataExtra },
    state: 'active',
    envDeclarations: [],
  };
}

describe('collectWatchPaths', () => {
  const deckDir = path.resolve('/tmp/deck-fixture');
  const deckPath = path.join(deckDir, 'demo.deck.md');

  it('always includes sibling sidecar (.deck.yaml) and env (.deck.env)', () => {
    const deck = makeDeck(deckPath, []);
    const paths = collectWatchPaths(deck);
    expect(paths).to.include(path.join(deckDir, 'demo.deck.yaml'));
    expect(paths).to.include(path.join(deckDir, 'demo.deck.env'));
  });

  it('resolves a relative content: import to an absolute path', () => {
    const deck = makeDeck(deckPath, [], { content: './imported.deck.md' });
    const paths = collectWatchPaths(deck);
    expect(paths).to.include(path.join(deckDir, 'imported.deck.md'));
  });

  it('keeps an absolute content: import unchanged', () => {
    const absolute = path.resolve('/elsewhere/other.deck.md');
    const deck = makeDeck(deckPath, [], { content: absolute });
    const paths = collectWatchPaths(deck);
    expect(paths).to.include(absolute);
  });

  it('collects render:file paths from slide bodies', () => {
    const slideContent = '[](render:file?path=src/foo.ts&lines=1-5)';
    const deck = makeDeck(deckPath, [makeSlide(0, slideContent)]);
    const paths = collectWatchPaths(deck);
    expect(paths).to.include(path.join(deckDir, 'src/foo.ts'));
  });

  it('collects render:diff file paths (path, left, right) — before/after are git refs, not paths', () => {
    const slideContent = [
      '[](render:diff?path=src/a.ts)',
      '[](render:diff?left=src/l.ts&right=src/r.ts)',
      '[](render:diff?path=src/d.ts&before=HEAD~1&after=HEAD)',
    ].join('\n\n');
    const deck = makeDeck(deckPath, [makeSlide(0, slideContent)]);
    const paths = collectWatchPaths(deck);
    expect(paths).to.include(path.join(deckDir, 'src/a.ts'));
    expect(paths).to.include(path.join(deckDir, 'src/l.ts'));
    expect(paths).to.include(path.join(deckDir, 'src/r.ts'));
    expect(paths).to.include(path.join(deckDir, 'src/d.ts'));
    expect(paths.some((p) => p.includes('HEAD'))).to.equal(false);
  });

  it('does NOT watch render:command targets (commands are not executed in preview)', () => {
    const slideContent = '[](render:command?cmd=node%20--version)';
    const deck = makeDeck(deckPath, [makeSlide(0, slideContent)]);
    const paths = collectWatchPaths(deck);
    const cmdLeak = paths.some((p) => p.includes('node') || p.includes('--version'));
    expect(cmdLeak).to.equal(false);
  });

  it('deduplicates paths across slides', () => {
    const dup = '[](render:file?path=src/shared.ts)';
    const deck = makeDeck(deckPath, [makeSlide(0, dup), makeSlide(1, dup)]);
    const paths = collectWatchPaths(deck);
    const sharedPath = path.join(deckDir, 'src/shared.ts');
    const occurrences = paths.filter((p) => p === sharedPath).length;
    expect(occurrences).to.equal(1);
  });
});
