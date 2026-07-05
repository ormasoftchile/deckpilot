/**
 * Tests for the YAML-primary deck manifest (`.deck.yaml` as the single deck
 * file). It references untouched external markdown via `content:` and carries
 * all overlays inline — replacing the `.deck.md` + `.deck.yaml` pair.
 */

import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {
  parseDeck,
  readDeckContentImport,
} from '../../../packages/core/src/parser/deckParser';

const FIXTURE_DIR = path.join(__dirname, '../fixtures/yaml-deck');
const TOUR_PATH = path.join(FIXTURE_DIR, 'tour.deck.yaml');

async function parseTour() {
  const raw = fs.readFileSync(TOUR_PATH, 'utf-8');
  return parseDeck(raw, TOUR_PATH);
}

describe('parseDeck — YAML-primary deck (.deck.yaml manifest)', () => {
  it('loads untouched markdown content and splits it by heading', async () => {
    const { deck, error } = await parseTour();
    expect(error, error).to.be.undefined;
    expect(deck).to.exist;
    // guide.md: # Widget, ## Setup, ## Running, ## Notes → 4 slides
    expect(deck!.slides).to.have.lengthOf(4);
    expect(deck!.slides.map(s => s.id)).to.deep.equal([
      'widget',
      'setup',
      'running',
      'notes',
    ]);
  });

  it('applies deck-level metadata from the manifest', async () => {
    const { deck } = await parseTour();
    expect(deck!.metadata.title).to.equal('Widget Tour');
    expect(deck!.metadata.theme).to.equal('dark');
    expect(deck!.metadata.recording).to.include({ autoStart: false, format: 'mp4' });
  });

  it('attaches per-slide overlays by heading slug', async () => {
    const { deck } = await parseTour();
    const setup = deck!.slides.find(s => s.id === 'setup')!;
    expect(setup.duration).to.equal('8s');
    expect(setup.cues).to.deep.equal(['Walk through install']);
    expect(setup.interactiveElements.length).to.be.greaterThan(0);

    const running = deck!.slides.find(s => s.id === 'running')!;
    expect(running.speakerNotes).to.equal('Show the running app here.');
  });

  it('resolves scenes by slide id to 0-based indices', async () => {
    const { deck } = await parseTour();
    expect(deck!.metadata.scenes).to.deep.equal([
      { name: 'start', slide: 0 },
      { name: 'demo', slide: 2 },
    ]);
  });

  it('errors when the manifest declares no content', async () => {
    const { error } = await parseDeck('deck:\n  title: x\n', TOUR_PATH);
    expect(error).to.match(/content:/);
  });

  it('errors when the referenced content file is missing', async () => {
    const { error } = await parseDeck('content: does-not-exist.md\n', TOUR_PATH);
    expect(error).to.match(/could not import/);
  });

  it('records the content import in metadata (so the preview watches it)', async () => {
    const { deck } = await parseTour();
    expect(deck!.metadata.content).to.equal('guide.md');
  });

  it('uses the readImport hook for live (unsaved) content', async () => {
    const live = ['# Live Title', '', 'edited body'].join('\n');
    const { deck } = await parseDeck(
      'content: guide.md\ndeck:\n  split: heading\n',
      TOUR_PATH,
      { readImport: () => live },
    );
    expect(deck!.slides).to.have.lengthOf(1);
    expect(deck!.slides[0].content).to.contain('Live Title');
  });

  it('keeps top-level split working with a deprecation warning', async () => {
    const { deck, warnings, error } = await parseDeck(
      'content: guide.md\nsplit: heading\n',
      TOUR_PATH,
    );

    expect(error).to.be.undefined;
    expect(deck!.slides).to.have.lengthOf(4);
    expect(warnings?.some((w) => w.includes('deprecated') && w.includes('deck.split'))).to.equal(true);
  });

  it('prefers deck.split over the deprecated top-level split', async () => {
    const { deck, warnings, error } = await parseDeck(
      [
        'content: guide.md',
        'split: marker',
        'deck:',
        '  split: heading',
      ].join('\n'),
      TOUR_PATH,
    );

    expect(error).to.be.undefined;
    expect(deck!.slides).to.have.lengthOf(4);
    expect(warnings?.some((w) => w.includes('deprecated') && w.includes('deck.split'))).to.equal(true);
  });
});

describe('readDeckContentImport', () => {
  it('reads content: from a .deck.yaml manifest', () => {
    const raw = fs.readFileSync(TOUR_PATH, 'utf-8');
    expect(readDeckContentImport(raw, TOUR_PATH)).to.equal('guide.md');
  });

  it('reads content: from .deck.md frontmatter', () => {
    const raw = ['---', 'title: X', 'content: ./body.md', '---', ''].join('\n');
    expect(readDeckContentImport(raw, '/x/demo.deck.md')).to.equal('./body.md');
  });

  it('returns undefined when no content: is declared', () => {
    expect(readDeckContentImport('deck:\n  title: x\n', '/x/a.deck.yaml')).to.be.undefined;
    expect(readDeckContentImport('# just markdown', '/x/a.deck.md')).to.be.undefined;
  });
});
