import { expect } from 'chai';
import {
  resolveSlideBreaks,
  looksLikeBareYaml,
  resolveSlideBreakMode,
  resolveSlideBreakConfig,
} from '../../../packages/core/src/parser/slideBreakResolver';

describe('resolveSlideBreaks', () => {
  describe('markers and --- (active in all modes)', () => {
    it('splits on <!-- slide --> markers', () => {
      const content = ['# A', 'body a', '<!-- slide -->', '# B', 'body b'].join('\n');
      const { chunks } = resolveSlideBreaks(content);
      expect(chunks).to.have.length(2);
      expect(chunks[0].text).to.contain('# A');
      expect(chunks[1].text).to.contain('# B');
    });

    it('accepts marker whitespace variants and is case-insensitive', () => {
      const content = ['# A', '<!--slide-->', '# B', '<!--   SLIDE   -->', '# C'].join('\n');
      const { chunks } = resolveSlideBreaks(content);
      expect(chunks).to.have.length(3);
    });

    it('accepts an optional trailing label for readability', () => {
      const content = [
        '# A',
        '<!-- slide 10 - home work -->',
        '# B',
        '<!-- slide: intro -->',
        '# C',
      ].join('\n');
      const { chunks } = resolveSlideBreaks(content);
      expect(chunks).to.have.length(3);
    });

    it('does not treat a different word (slides/slideshow) as a break', () => {
      const content = ['# A', '<!-- slides -->', '<!-- slideshow -->', 'body'].join('\n');
      const { chunks } = resolveSlideBreaks(content);
      expect(chunks).to.have.length(1);
    });

    it('still splits on bare --- for backward compatibility', () => {
      const content = ['# A', 'body a', '---', '# B', 'body b'].join('\n');
      const { chunks } = resolveSlideBreaks(content);
      expect(chunks).to.have.length(2);
    });

    it('splits on both markers and --- together', () => {
      const content = ['# A', '---', '# B', '<!-- slide -->', '# C'].join('\n');
      const { chunks } = resolveSlideBreaks(content);
      expect(chunks).to.have.length(3);
    });

    it('tracks 0-based inclusive source line ranges', () => {
      const content = [
        '# A',            // 0
        'body a',         // 1
        '<!-- slide -->', // 2
        '# B',            // 3
        'body b',         // 4
      ].join('\n');
      const { chunks } = resolveSlideBreaks(content);
      expect(chunks[0]).to.include({ start: 0, end: 1 });
      expect(chunks[1]).to.include({ start: 3, end: 4 });
    });
  });

  describe('fence awareness', () => {
    it('ignores --- inside a fenced code block', () => {
      const content = [
        '# A',
        '```',
        'front',
        '---',      // inside fence — must NOT split
        'back',
        '```',
        'after',
      ].join('\n');
      const { chunks } = resolveSlideBreaks(content);
      expect(chunks).to.have.length(1);
      expect(chunks[0].text).to.contain('---');
    });

    it('ignores <!-- slide --> inside a fenced code block', () => {
      const content = ['# A', '```md', '<!-- slide -->', '```', 'tail'].join('\n');
      const { chunks } = resolveSlideBreaks(content);
      expect(chunks).to.have.length(1);
    });

    it('supports ~~~ fences and a different inner fence char', () => {
      const content = [
        '# A',
        '~~~',
        '```',       // different char — does not close the ~~~ fence
        '---',       // still inside ~~~ fence
        '~~~',       // closes
        '<!-- slide -->',
        '# B',
      ].join('\n');
      const { chunks } = resolveSlideBreaks(content);
      expect(chunks).to.have.length(2);
    });
  });

  describe('deprecation reporting', () => {
    it('flags --- used as a content separator', () => {
      const content = ['# A', 'body', '---', '# B'].join('\n');
      const { usedDeprecatedDelimiter } = resolveSlideBreaks(content);
      expect(usedDeprecatedDelimiter).to.equal(true);
    });

    it('does NOT flag --- fences of a per-slide frontmatter block', () => {
      const content = [
        '# A',
        '<!-- slide -->',
        '---',
        'notes: a speaker note',
        '---',
        '# B',
      ].join('\n');
      const { usedDeprecatedDelimiter } = resolveSlideBreaks(content);
      // The marker does the slide separation; the --- pair only fences bare
      // YAML (not real content) → not a deprecated separator.
      expect(usedDeprecatedDelimiter).to.equal(false);
    });

    it('does NOT flag when only markers are used', () => {
      const content = ['# A', '<!-- slide -->', '# B'].join('\n');
      const { usedDeprecatedDelimiter } = resolveSlideBreaks(content);
      expect(usedDeprecatedDelimiter).to.equal(false);
    });
  });

  describe("mode 'blank' (default)", () => {
    it('splits on 2+ blank lines with no explicit mode (default)', () => {
      const content = ['# A', 'body a', '', '', '# B', 'body b'].join('\n');
      const { chunks } = resolveSlideBreaks(content);
      expect(chunks).to.have.length(2);
    });

    it('splits on runs of 2+ blank lines', () => {
      const content = ['# A', 'body a', '', '', '# B', 'body b'].join('\n');
      const { chunks } = resolveSlideBreaks(content, 'blank');
      expect(chunks).to.have.length(2);
      expect(chunks[0].text).to.contain('# A');
      expect(chunks[1].text).to.contain('# B');
    });

    it('does NOT split on a single blank line (paragraph break)', () => {
      const content = ['# A', 'para one', '', 'para two'].join('\n');
      const { chunks } = resolveSlideBreaks(content, 'blank');
      expect(chunks).to.have.length(1);
    });

    it('treats 3+ blank lines as a single separator', () => {
      const content = ['# A', '', '', '', '', '# B'].join('\n');
      const { chunks } = resolveSlideBreaks(content, 'blank');
      expect(chunks).to.have.length(2);
    });

    it('does not split on blank lines inside a fenced code block', () => {
      const content = [
        '# A',
        '```',
        'line 1',
        '',
        '',
        'line 2',
        '```',
        'tail',
      ].join('\n');
      const { chunks } = resolveSlideBreaks(content, 'blank');
      expect(chunks).to.have.length(1);
    });

    it('ignores a leading blank run (no phantom first slide)', () => {
      const content = ['', '', '# A', 'body'].join('\n');
      const { chunks } = resolveSlideBreaks(content, 'blank');
      expect(chunks).to.have.length(1);
      expect(chunks[0].text).to.contain('# A');
    });

    it('still honors explicit markers in blank mode', () => {
      const content = ['# A', '<!-- slide -->', '# B', '', '', '# C'].join('\n');
      const { chunks } = resolveSlideBreaks(content, 'blank');
      expect(chunks).to.have.length(3);
    });

    it('does not split blank runs inside an indented (4-space) code block', () => {
      const content = [
        '# A',
        'text:',
        '',
        '    code line 1',
        '',
        '',
        '        code line 2',
        '',
        'after',
      ].join('\n');
      const { chunks } = resolveSlideBreaks(content, 'blank');
      expect(chunks).to.have.length(1);
    });

    it('still splits when a blank run precedes top-level content after code', () => {
      const content = [
        '    indented code',
        '',
        '',
        '# Heading',
      ].join('\n');
      const { chunks } = resolveSlideBreaks(content, 'blank');
      expect(chunks).to.have.length(2);
    });

    it('does not split on 2+ blank lines when mode is marker', () => {
      const content = ['# A', '', '', '# B'].join('\n');
      const { chunks } = resolveSlideBreaks(content, 'marker');
      expect(chunks).to.have.length(1);
    });
  });

  describe("mode 'heading'", () => {
    it('splits before each H1/H2 heading', () => {
      const content = [
        '# Title',
        'intro para',
        '## Section A',
        'body a',
        '## Section B',
        'body b',
      ].join('\n');
      const { chunks } = resolveSlideBreaks(content, 'heading');
      expect(chunks).to.have.length(3);
      expect(chunks[0].text).to.contain('# Title');
      expect(chunks[1].text).to.contain('## Section A');
      expect(chunks[2].text).to.contain('## Section B');
    });

    it('keeps the heading line with its slide (not consumed)', () => {
      const content = ['# A', 'body', '## B', 'body b'].join('\n');
      const { chunks } = resolveSlideBreaks(content, 'heading');
      expect(chunks[1].text.startsWith('## B')).to.equal(true);
    });

    it('does not split on H3+ headings', () => {
      const content = ['# A', '### Sub', 'body', '## B'].join('\n');
      const { chunks } = resolveSlideBreaks(content, 'heading');
      expect(chunks).to.have.length(2); // # A (incl ### Sub) and ## B
    });

    it('does not split on headings inside a fenced code block', () => {
      const content = ['# A', '```', '## not a slide', '```', 'tail'].join('\n');
      const { chunks } = resolveSlideBreaks(content, 'heading');
      expect(chunks).to.have.length(1);
    });

    it('does not create a leading empty slide when content starts with a heading', () => {
      const content = ['# First', 'body', '## Second'].join('\n');
      const { chunks } = resolveSlideBreaks(content, 'heading');
      expect(chunks).to.have.length(2);
      expect(chunks[0].text).to.contain('# First');
    });

    it('honors an explicit single level (h2 splits only at H2)', () => {
      const content = ['# Title', 'intro', '## A', 'a', '## B', 'b'].join('\n');
      const { chunks } = resolveSlideBreaks(content, 'heading', { headingLevels: [2] });
      // H1 does NOT split, so "# Title + intro" merges with... nothing before
      // first H2; result: [# Title + intro], [## A + a], [## B + b]
      expect(chunks).to.have.length(3);
      expect(chunks[0].text).to.contain('# Title');
      expect(chunks[1].text.startsWith('## A')).to.equal(true);
    });

    it('honors a level range (h1-h3 splits H1, H2 and H3)', () => {
      const content = ['# A', '## B', '### C', '#### D', 'body'].join('\n');
      const { chunks } = resolveSlideBreaks(content, 'heading', { headingLevels: [1, 2, 3] });
      // H1, H2, H3 split; H4 stays in the H3 slide
      expect(chunks).to.have.length(3);
      expect(chunks[2].text).to.contain('### C');
      expect(chunks[2].text).to.contain('#### D');
    });
  });

  describe('edge cases', () => {
    it('returns a single chunk when there is no delimiter', () => {
      const { chunks } = resolveSlideBreaks('# Only\nbody');
      expect(chunks).to.have.length(1);
    });

    it('keeps a single chunk for empty input', () => {
      const { chunks } = resolveSlideBreaks('');
      expect(chunks).to.have.length(1);
      expect(chunks[0].text).to.equal('');
    });
  });
});

describe('resolveSlideBreakMode', () => {
  it('accepts the three valid modes (case-insensitive)', () => {
    expect(resolveSlideBreakMode('marker')).to.equal('marker');
    expect(resolveSlideBreakMode('BLANK')).to.equal('blank');
    expect(resolveSlideBreakMode(' Heading ')).to.equal('heading');
  });

  it('falls back to heading for unknown or missing values', () => {
    expect(resolveSlideBreakMode(undefined)).to.equal('heading');
    expect(resolveSlideBreakMode('nonsense')).to.equal('heading');
    expect(resolveSlideBreakMode(42)).to.equal('heading');
  });
});

describe('resolveSlideBreakConfig', () => {
  it('maps marker/blank with empty heading levels', () => {
    expect(resolveSlideBreakConfig('marker')).to.deep.equal({ mode: 'marker', headingLevels: [] });
    expect(resolveSlideBreakConfig('blank')).to.deep.equal({ mode: 'blank', headingLevels: [] });
  });

  it('maps bare heading to levels [1, 2]', () => {
    expect(resolveSlideBreakConfig('heading')).to.deep.equal({ mode: 'heading', headingLevels: [1, 2] });
  });

  it('maps hN to a single exact level', () => {
    expect(resolveSlideBreakConfig('h2')).to.deep.equal({ mode: 'heading', headingLevels: [2] });
    expect(resolveSlideBreakConfig('H3')).to.deep.equal({ mode: 'heading', headingLevels: [3] });
  });

  it('maps hN-hM (and hN-M) to an inclusive range', () => {
    expect(resolveSlideBreakConfig('h1-h3')).to.deep.equal({ mode: 'heading', headingLevels: [1, 2, 3] });
    expect(resolveSlideBreakConfig('h2-4')).to.deep.equal({ mode: 'heading', headingLevels: [2, 3, 4] });
    expect(resolveSlideBreakConfig('h3-h1')).to.deep.equal({ mode: 'heading', headingLevels: [1, 2, 3] });
  });

  it('falls back to heading for unknown values', () => {
    expect(resolveSlideBreakConfig('h7')).to.deep.equal({ mode: 'heading', headingLevels: [1, 2] });
    expect(resolveSlideBreakConfig('nope')).to.deep.equal({ mode: 'heading', headingLevels: [1, 2] });
    expect(resolveSlideBreakConfig(undefined)).to.deep.equal({ mode: 'heading', headingLevels: [1, 2] });
  });
});

describe('looksLikeBareYaml', () => {
  it('recognizes key: value blocks', () => {
    expect(looksLikeBareYaml('notes: hello')).to.equal(true);
    expect(looksLikeBareYaml('a: 1\nb: 2')).to.equal(true);
  });

  it('rejects prose and headings', () => {
    expect(looksLikeBareYaml('# Heading')).to.equal(false);
    expect(looksLikeBareYaml('just some prose here')).to.equal(false);
  });

  it('rejects empty content', () => {
    expect(looksLikeBareYaml('   ')).to.equal(false);
  });
});
