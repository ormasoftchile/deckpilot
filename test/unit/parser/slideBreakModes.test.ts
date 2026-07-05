import { expect } from 'chai';
import {
  parseSlides,
  getLastParseWarnings,
} from '../../../packages/core/src/parser/slideParser';

describe('parseSlides — slide-break modes', () => {
  it('splits on <!-- slide --> markers (default mode)', () => {
    const deck = ['# One', 'body one', '<!-- slide -->', '# Two', 'body two'].join('\n');
    const slides = parseSlides(deck);
    expect(slides).to.have.length(2);
    expect(slides[0].content).to.contain('# One');
    expect(slides[1].content).to.contain('# Two');
  });

  it('still splits on --- for backward compatibility', () => {
    const deck = ['# One', '---', '# Two'].join('\n');
    const slides = parseSlides(deck);
    expect(slides).to.have.length(2);
  });

  it('surfaces a deprecation warning when --- separates content', () => {
    const deck = ['# One', 'body', '---', '# Two'].join('\n');
    parseSlides(deck);
    const warnings = getLastParseWarnings();
    expect(warnings.some(w => w.includes('deprecated'))).to.equal(true);
  });

  it('emits no deprecation warning for marker-only decks', () => {
    const deck = ['# One', '<!-- slide -->', '# Two'].join('\n');
    parseSlides(deck);
    expect(getLastParseWarnings()).to.have.length(0);
  });

  it('splits on 2+ blank lines by default, and marker mode opts out', () => {
    const deck = ['# One', 'body', '', '', '# Two', 'body two'].join('\n');

    const defaultSlides = parseSlides(deck);
    expect(defaultSlides).to.have.length(2);

    const markerSlides = parseSlides(deck, { slideBreak: 'marker' });
    expect(markerSlides).to.have.length(1);
  });

  it('does not create a phantom first slide from leading blanks in blank mode', () => {
    const deck = ['', '', '# One', 'body', '', '', '# Two'].join('\n');
    const slides = parseSlides(deck, { slideBreak: 'blank' });
    expect(slides).to.have.length(2);
    expect(slides[0].content).to.contain('# One');
  });

  it('keeps an indented code block with internal blanks in one slide (default)', () => {
    const deck = [
      '# Slide',
      'Indented code follows:',
      '',
      '    def foo():',
      '',
      '',
      '        return 42',
      '',
      'After code.',
    ].join('\n');
    const slides = parseSlides(deck);
    expect(slides).to.have.length(1);
  });
});
