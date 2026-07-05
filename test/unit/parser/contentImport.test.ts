/**
 * Tests for `content:` frontmatter — external markdown import.
 *
 * The deck file declares `content: <relative-path>`; the parser loads the
 * referenced file's body in place of the inline body. The imported file's
 * own frontmatter (if any) is discarded.
 */

import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parseDeck } from '../../../packages/core/src/parser/deckParser';

describe('parseDeck — content: import', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deckpilot-content-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('imports body from a sibling .md file with --- slide breaks', async () => {
    const talkPath = path.join(tmpDir, 'talk.md');
    fs.writeFileSync(
      talkPath,
      ['# Intro', '', 'First slide.', '', '---', '', '# Demo', '', 'Second slide.'].join('\n'),
      'utf-8'
    );

    const deckPath = path.join(tmpDir, 'demo.deck.md');
    const wrapper = ['---', 'title: Wrapped Talk', 'content: ./talk.md', '---', ''].join('\n');

    const { deck, error, warnings } = await parseDeck(wrapper, deckPath);

    expect(error, error).to.be.undefined;
    expect(warnings, JSON.stringify(warnings)).to.satisfy(
      (w?: string[]) => !w || w.every((x) => !x.startsWith('[content]'))
    );
    expect(deck).to.exist;
    expect(deck!.slides).to.have.lengthOf(2);
    expect(deck!.metadata.title).to.equal('Wrapped Talk');
    expect(deck!.metadata.content).to.equal('./talk.md');
  });

  it('discards frontmatter inside the imported file (wrapper is source of truth)', async () => {
    const talkPath = path.join(tmpDir, 'talk.md');
    fs.writeFileSync(
      talkPath,
      [
        '---',
        'title: Imported Title (should be ignored)',
        'author: Imported Author',
        '---',
        '# Only slide',
        '',
        'Content body.',
      ].join('\n'),
      'utf-8'
    );

    const deckPath = path.join(tmpDir, 'demo.deck.md');
    const wrapper = ['---', 'title: Wrapper Title', 'content: ./talk.md', '---'].join('\n');

    const { deck, error } = await parseDeck(wrapper, deckPath);

    expect(error, error).to.be.undefined;
    expect(deck!.metadata.title).to.equal('Wrapper Title');
    expect(deck!.metadata.author).to.be.undefined;
    expect(deck!.slides).to.have.lengthOf(1);
  });

  it('emits a non-fatal warning and falls back to inline body when import path is missing', async () => {
    const deckPath = path.join(tmpDir, 'demo.deck.md');
    const wrapper = [
      '---',
      'title: Fallback Test',
      'content: ./does-not-exist.md',
      '---',
      '# Fallback slide',
      '',
      'Inline body still works.',
    ].join('\n');

    const { deck, error, warnings } = await parseDeck(wrapper, deckPath);

    expect(error).to.be.undefined;
    expect(deck).to.exist;
    expect(deck!.slides).to.have.lengthOf(1);
    expect(warnings ?? []).to.satisfy((ws: string[]) =>
      ws.some((w) => w.startsWith('[content]') && w.includes('does-not-exist.md'))
    );
  });

  it('resolves absolute paths as given', async () => {
    const talkPath = path.join(tmpDir, 'absolute-talk.md');
    fs.writeFileSync(talkPath, '# Absolute\n\nFrom absolute path.', 'utf-8');

    const deckPath = path.join(tmpDir, 'demo.deck.md');
    const wrapper = ['---', `content: ${talkPath}`, '---'].join('\n');

    const { deck, error } = await parseDeck(wrapper, deckPath);

    expect(error).to.be.undefined;
    expect(deck!.slides).to.have.lengthOf(1);
    expect(deck!.slides[0].content).to.include('Absolute');
  });

  it('passes listFragmentMode frontmatter into fragment processing', async () => {
    const deckPath = path.join(tmpDir, 'demo.deck.md');
    const deckSource = [
      '---',
      'listFragmentMode: each',
      '---',
      '- A',
      '- B',
      '- C',
    ].join('\n');

    const { deck, error } = await parseDeck(deckSource, deckPath);

    expect(error).to.be.undefined;
    expect(deck!.metadata.listFragmentMode).to.equal('each');
    expect(deck!.slides[0].html).to.not.match(/<ul[^>]*class="fragment"/);
    expect(deck!.slides[0].html).to.contain('<li class="fragment" data-fragment="1" data-fragment-animation="fade">A</li>');
    expect(deck!.slides[0].html).to.contain('<li class="fragment" data-fragment="2" data-fragment-animation="fade">B</li>');
    expect(deck!.slides[0].html).to.contain('<li class="fragment" data-fragment="3" data-fragment-animation="fade">C</li>');
  });
});
