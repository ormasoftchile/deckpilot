import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { parseDeck } from '../../../packages/core/src/parser/deckParser';

describe('parseDeck — listFragmentMode', () => {
  const runtimeRoot = path.join(process.cwd(), '.test-artifacts');
  let runtimeDir: string;

  beforeEach(() => {
    fs.mkdirSync(runtimeRoot, { recursive: true });
    runtimeDir = fs.mkdtempSync(path.join(runtimeRoot, 'deck-parser-'));
  });

  afterEach(() => {
    fs.rmSync(runtimeDir, { recursive: true, force: true });
  });

  it('preserves legacy list behavior when .deck.md frontmatter omits listFragmentMode', async () => {
    const deckPath = path.join(runtimeDir, 'legacy.deck.md');
    const deckSource = ['# Intro', '', '- A', '- B'].join('\n');

    const { deck, error } = await parseDeck(deckSource, deckPath);

    expect(error).to.be.undefined;
    expect(deck!.metadata.listFragmentMode).to.be.undefined;
    expect(deck!.listFragmentMode).to.be.undefined;
    expect(deck!.slides[0].html).to.contain('<ul class="fragment" data-fragment="2" data-fragment-animation="fade">');
    expect(deck!.slides[0].html).to.not.match(/<li[^>]*class="fragment"/);
  });

  it('parses listFragmentMode from .deck.md frontmatter', async () => {
    const deckPath = path.join(runtimeDir, 'inline.deck.md');
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
    expect(deck!.listFragmentMode).to.equal('each');
    expect(deck!.slides[0].html).to.not.match(/<ul[^>]*class="fragment"/);
    expect(deck!.slides[0].html).to.contain('<li class="fragment" data-fragment="1" data-fragment-animation="fade">A</li>');
    expect(deck!.slides[0].html).to.contain('<li class="fragment" data-fragment="2" data-fragment-animation="fade">B</li>');
    expect(deck!.slides[0].html).to.contain('<li class="fragment" data-fragment="3" data-fragment-animation="fade">C</li>');
  });

  it('reads listFragmentMode from a companion .deck.yaml sidecar when .deck.md omits it', async () => {
    const deckPath = path.join(runtimeDir, 'sidecar.deck.md');
    fs.writeFileSync(deckPath, '- A\n- B\n- C\n', 'utf-8');
    fs.writeFileSync(
      deckPath.replace(/\.deck\.md$/, '.deck.yaml'),
      ['deck:', '  listFragmentMode: each'].join('\n'),
      'utf-8',
    );

    const { deck, error } = await parseDeck(fs.readFileSync(deckPath, 'utf-8'), deckPath);

    expect(error).to.be.undefined;
    expect(deck!.metadata.listFragmentMode).to.equal('each');
    expect(deck!.listFragmentMode).to.equal('each');
    expect(deck!.slides[0].html).to.not.match(/<ul[^>]*class="fragment"/);
    expect(deck!.slides[0].html).to.contain('<li class="fragment" data-fragment="1" data-fragment-animation="fade">A</li>');
    expect(deck!.slides[0].html).to.contain('<li class="fragment" data-fragment="2" data-fragment-animation="fade">B</li>');
    expect(deck!.slides[0].html).to.contain('<li class="fragment" data-fragment="3" data-fragment-animation="fade">C</li>');
  });

  it('reads split from the deck block of a companion .deck.yaml sidecar', async () => {
    const deckPath = path.join(runtimeDir, 'sidecar-break.deck.md');
    fs.writeFileSync(deckPath, '# One\n\n\n# Two\n', 'utf-8');
    fs.writeFileSync(
      deckPath.replace(/\.deck\.md$/, '.deck.yaml'),
      ['deck:', '  split: marker'].join('\n'),
      'utf-8',
    );

    const { deck, error } = await parseDeck(fs.readFileSync(deckPath, 'utf-8'), deckPath);

    expect(error).to.be.undefined;
    expect(deck!.slides).to.have.lengthOf(1);
  });

  it('keeps top-level split working in a companion .deck.yaml sidecar with a deprecation warning', async () => {
    const deckPath = path.join(runtimeDir, 'legacy-sidecar-break.deck.md');
    fs.writeFileSync(deckPath, '# One\n\n\n# Two\n', 'utf-8');
    fs.writeFileSync(
      deckPath.replace(/\.deck\.md$/, '.deck.yaml'),
      'split: marker\n',
      'utf-8',
    );

    const { deck, error, warnings } = await parseDeck(fs.readFileSync(deckPath, 'utf-8'), deckPath);

    expect(error).to.be.undefined;
    expect(deck!.slides).to.have.lengthOf(1);
    expect(warnings?.some((w) => w.includes('deprecated') && w.includes('deck.split'))).to.equal(true);
  });

  it('reads listFragmentMode from a YAML-primary .deck.yaml deck manifest', async () => {
    const contentPath = path.join(runtimeDir, 'body.md');
    const manifestPath = path.join(runtimeDir, 'tour.deck.yaml');
    fs.writeFileSync(contentPath, '- A\n- B\n- C\n', 'utf-8');
    fs.writeFileSync(
      manifestPath,
      [
        'content: ./body.md',
        'deck:',
        '  listFragmentMode: each',
      ].join('\n'),
      'utf-8',
    );

    const { deck, error } = await parseDeck(fs.readFileSync(manifestPath, 'utf-8'), manifestPath);

    expect(error).to.be.undefined;
    expect(deck!.metadata.content).to.equal('./body.md');
    expect(deck!.metadata.listFragmentMode).to.equal('each');
    expect(deck!.listFragmentMode).to.equal('each');
    expect(deck!.slides[0].html).to.not.match(/<ul[^>]*class="fragment"/);
    expect(deck!.slides[0].html).to.contain('<li class="fragment" data-fragment="1" data-fragment-animation="fade">A</li>');
    expect(deck!.slides[0].html).to.contain('<li class="fragment" data-fragment="2" data-fragment-animation="fade">B</li>');
    expect(deck!.slides[0].html).to.contain('<li class="fragment" data-fragment="3" data-fragment-animation="fade">C</li>');
  });
});
