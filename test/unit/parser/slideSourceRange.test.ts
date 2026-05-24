import { expect } from 'chai';
import { parseSlides } from '../../../packages/core/src/parser/slideParser';

describe('parseSlides — sourceRange', () => {
  it('populates 0-based line ranges for a simple 3-slide deck', () => {
    const deck = [
      '# Slide A',         // line 0
      'body of A',          // line 1
      '',                   // line 2
      '---',                // line 3 (delimiter)
      '# Slide B',          // line 4
      'body of B',          // line 5
      '---',                // line 6 (delimiter)
      '# Slide C',          // line 7
      'body of C',          // line 8
    ].join('\n');

    const slides = parseSlides(deck);
    expect(slides).to.have.length(3);
    expect(slides[0].sourceRange).to.deep.equal({ start: 0, end: 2 });
    expect(slides[1].sourceRange).to.deep.equal({ start: 4, end: 5 });
    expect(slides[2].sourceRange).to.deep.equal({ start: 7, end: 8 });
  });

  it('absorbs a preceding frontmatter-only block into the next slide', () => {
    const deck = [
      '# First',            // 0
      'body',               // 1
      '---',                // 2 (delimiter)
      'notes: a note',      // 3 (frontmatter-only chunk)
      '---',                // 4 (delimiter)
      '# Body',             // 5
      'p',                  // 6
    ].join('\n');

    const slides = parseSlides(deck);
    expect(slides).to.have.length(2);
    // Slide 0 unchanged.
    expect(slides[0].sourceRange).to.deep.equal({ start: 0, end: 1 });
    // The frontmatter-only chunk (line 3) is absorbed into slide 1; the
    // merged range starts at the frontmatter block start (line 3).
    expect(slides[1].sourceRange?.start).to.equal(3);
    expect(slides[1].sourceRange?.end).to.equal(6);
  });
});
