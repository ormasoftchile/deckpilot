/**
 * Regression baseline for the slide rendering pipeline.
 *
 * Calls parseSlides() end-to-end (transformLayoutDirectives → markdown-it →
 * injectBlockElements → processFragments) and asserts on the final slide.html
 * string. No VS Code API involved — runs headlessly via `npm run test:unit`.
 *
 * Purpose: catch regressions when layout class names, wrapper elements, or
 * HTML structure change. If you rename a class, a test here will fail first.
 *
 * Assertions use string contains/regex — no DOM parser dependency needed.
 */

import { expect } from 'chai';
import { parseSlides } from '../../../src/parser/slideParser';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse a single-slide deck and return the first slide's html. */
function renderSlide(markdown: string): string {
  const slides = parseSlides(markdown);
  expect(slides.length).to.be.greaterThan(0, 'parseSlides returned no slides');
  return slides[0].html;
}

// ---------------------------------------------------------------------------
// :::center layout
// ---------------------------------------------------------------------------

describe('slideRenderingPipeline — :::center layout', () => {
  it('should wrap content in a layout-center div', () => {
    const html = renderSlide(':::center\nBig idea\n:::');
    expect(html).to.contain('class="layout-center"');
  });

  it('should preserve the inner text inside the layout-center wrapper', () => {
    const html = renderSlide(':::center\nBig idea\n:::');
    expect(html).to.contain('Big idea');
  });

  it('should produce valid open and close div tags', () => {
    const html = renderSlide(':::center\nBig idea\n:::');
    expect(html).to.contain('<div class="layout-center">');
    expect(html).to.contain('</div>');
  });

  it('should render heading inside :::center correctly', () => {
    const html = renderSlide(':::center\n# Title\n:::');
    expect(html).to.contain('class="layout-center"');
    expect(html).to.contain('<h1>');
    expect(html).to.contain('Title');
  });
});

// ---------------------------------------------------------------------------
// :::columns layout
// ---------------------------------------------------------------------------

describe('slideRenderingPipeline — :::columns layout', () => {
  const columnsMarkdown = ':::columns\n:::left\nLeft text\n:::\n:::right\nRight text\n:::\n:::';

  it('should produce a layout-columns wrapper', () => {
    const html = renderSlide(columnsMarkdown);
    expect(html).to.contain('class="layout-columns"');
  });

  it('should produce a layout-left column', () => {
    const html = renderSlide(columnsMarkdown);
    expect(html).to.contain('class="layout-left"');
  });

  it('should produce a layout-right column', () => {
    const html = renderSlide(columnsMarkdown);
    expect(html).to.contain('class="layout-right"');
  });

  it('should preserve left column content', () => {
    const html = renderSlide(columnsMarkdown);
    expect(html).to.contain('Left text');
  });

  it('should preserve right column content', () => {
    const html = renderSlide(columnsMarkdown);
    expect(html).to.contain('Right text');
  });

  it('should have balanced open and close div tags', () => {
    const html = renderSlide(columnsMarkdown);
    const opens = (html.match(/<div/g) || []).length;
    const closes = (html.match(/<\/div>/g) || []).length;
    expect(opens).to.equal(closes, 'Unbalanced <div> tags in columns layout');
  });

  it('should place layout-left before layout-right in document order', () => {
    const html = renderSlide(columnsMarkdown);
    const leftIdx = html.indexOf('layout-left');
    const rightIdx = html.indexOf('layout-right');
    expect(leftIdx).to.be.lessThan(rightIdx, 'layout-left should appear before layout-right');
  });
});

// ---------------------------------------------------------------------------
// :::advanced layout
// ---------------------------------------------------------------------------

describe('slideRenderingPipeline — :::advanced layout', () => {
  const advancedMarkdown = ':::advanced\nDeep dive content\n:::';

  it('should produce a <details> element', () => {
    const html = renderSlide(advancedMarkdown);
    expect(html).to.contain('<details');
  });

  it('should use the disclosure-advanced class on <details>', () => {
    const html = renderSlide(advancedMarkdown);
    expect(html).to.contain('class="disclosure-advanced"');
  });

  it('should include a <summary> element', () => {
    const html = renderSlide(advancedMarkdown);
    expect(html).to.contain('<summary>');
  });

  it('should use the hardcoded English label "Advanced" in <summary>', () => {
    const html = renderSlide(advancedMarkdown);
    expect(html).to.contain('<summary>Advanced</summary>');
  });

  it('should preserve the inner content inside <details>', () => {
    const html = renderSlide(advancedMarkdown);
    expect(html).to.contain('Deep dive content');
  });

  it('should close the <details> element', () => {
    const html = renderSlide(advancedMarkdown);
    expect(html).to.contain('</details>');
  });
});

// ---------------------------------------------------------------------------
// :::optional layout
// ---------------------------------------------------------------------------

describe('slideRenderingPipeline — :::optional layout', () => {
  const optionalMarkdown = ':::optional\nOptional step\n:::';

  it('should wrap content in a step-optional div', () => {
    const html = renderSlide(optionalMarkdown);
    expect(html).to.contain('class="step-optional"');
  });

  it('should include the optional-badge span', () => {
    const html = renderSlide(optionalMarkdown);
    expect(html).to.contain('class="optional-badge"');
  });

  it('should use the hardcoded English label "Optional" in the badge', () => {
    const html = renderSlide(optionalMarkdown);
    expect(html).to.contain('<span class="optional-badge">Optional</span>');
  });

  it('should preserve the inner content inside the optional wrapper', () => {
    const html = renderSlide(optionalMarkdown);
    expect(html).to.contain('Optional step');
  });

  it('should close the wrapper div', () => {
    const html = renderSlide(optionalMarkdown);
    expect(html).to.contain('</div>');
  });
});

// ---------------------------------------------------------------------------
// Plain slide (no layout directive)
// ---------------------------------------------------------------------------

describe('slideRenderingPipeline — plain slide (no layout directive)', () => {
  it('should render a heading without any layout wrapper', () => {
    const html = renderSlide('# Hello World');
    expect(html).to.contain('<h1>Hello World</h1>');
    expect(html).not.to.contain('layout-center');
    expect(html).not.to.contain('layout-columns');
    expect(html).not.to.contain('disclosure-advanced');
    expect(html).not.to.contain('step-optional');
  });

  it('should render a paragraph as a <p> tag (auto-fragmented)', () => {
    // Auto-fragment system: every <p> gets class="fragment" by default
    const html = renderSlide('Just some text.');
    expect(html).to.contain('<p');
    expect(html).to.contain('Just some text.');
    expect(html).to.contain('class="fragment"');
  });

  it('should render a bullet list as <ul>/<li> elements (auto-fragmented)', () => {
    // Auto-fragment system: every <li> gets class="fragment" by default
    const html = renderSlide('- Item A\n- Item B');
    expect(html).to.contain('<ul>');
    expect(html).to.contain('Item A');
    expect(html).to.contain('Item B');
    expect(html).to.contain('class="fragment"');
  });

  it('should render inline code within a <code> tag', () => {
    const html = renderSlide('Use `npm install` to install.');
    expect(html).to.contain('<code>npm install</code>');
  });
});

// ---------------------------------------------------------------------------
// Multiple slides — delimiter splitting
// ---------------------------------------------------------------------------

describe('slideRenderingPipeline — multiple slides', () => {
  it('should return one slide when there is no --- delimiter', () => {
    const slides = parseSlides('# Only Slide');
    expect(slides).to.have.lengthOf(1);
  });

  it('should split on --- and return two slides', () => {
    const slides = parseSlides('# Slide One\n\n---\n\n# Slide Two');
    expect(slides).to.have.lengthOf(2);
  });

  it('should return three slides for two --- delimiters', () => {
    const slides = parseSlides('# One\n\n---\n\n# Two\n\n---\n\n# Three');
    expect(slides).to.have.lengthOf(3);
  });

  it('should render each slide independently', () => {
    const slides = parseSlides('# First\n\n---\n\n# Second');
    expect(slides[0].html).to.contain('First');
    expect(slides[1].html).to.contain('Second');
  });

  it('should assign sequential zero-based indices to slides', () => {
    const slides = parseSlides('# A\n\n---\n\n# B\n\n---\n\n# C');
    expect(slides[0].index).to.equal(0);
    expect(slides[1].index).to.equal(1);
    expect(slides[2].index).to.equal(2);
  });

  it('should give each slide its own layout wrapper when directives differ', () => {
    const deck = ':::center\nCentered\n:::\n\n---\n\n:::optional\nSide note\n:::';
    const slides = parseSlides(deck);
    expect(slides).to.have.lengthOf(2);
    expect(slides[0].html).to.contain('layout-center');
    expect(slides[1].html).to.contain('step-optional');
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('slideRenderingPipeline — edge cases', () => {
  it('should handle an empty string and return the first (empty) slide', () => {
    const slides = parseSlides('');
    // First slide is always preserved even if empty
    expect(slides).to.have.lengthOf(1);
  });

  it('should handle a slide with only a layout directive and no body content', () => {
    const html = renderSlide(':::center\n:::');
    // Should still produce the wrapper without crashing
    expect(html).to.contain('layout-center');
  });

  it('should handle a slide with only whitespace as content', () => {
    const slides = parseSlides('   \n   ');
    expect(slides).to.have.lengthOf(1);
  });

  it('should skip empty slides that appear after the first slide', () => {
    // Two --- delimiters with no content between them produces one empty
    // middle section that should be skipped
    const slides = parseSlides('# A\n\n---\n\n---\n\n# B');
    // Middle empty segment is dropped; result is 2 slides
    expect(slides).to.have.lengthOf(2);
  });

  it('should render a slide that mixes a layout directive and a plain heading', () => {
    const markdown = '# Intro\n\n:::center\nCentered bit\n:::';
    const html = renderSlide(markdown);
    expect(html).to.contain('<h1>Intro</h1>');
    expect(html).to.contain('layout-center');
    expect(html).to.contain('Centered bit');
  });

  it('should not inject layout wrappers into a fenced code block containing directives', () => {
    const markdown = '```\n:::center\nfake directive\n:::\n```';
    const html = renderSlide(markdown);
    // The directive text should be in a <code>/<pre> block, not a layout div
    expect(html).to.contain(':::center');
    expect(html).not.to.contain('class="layout-center"');
  });
});

// ---------------------------------------------------------------------------
// showCommand option
// ---------------------------------------------------------------------------

describe('slideRenderingPipeline — showCommand action block option', () => {
  it('should render action-command-preview when showCommand: true', () => {
    const markdown = [
      '# Demo',
      '',
      '```action',
      'type: terminal.run',
      'command: npm test',
      'showCommand: true',
      '```',
    ].join('\n');

    const html = renderSlide(markdown);
    expect(html).to.contain('action-command-preview');
    expect(html).to.contain('npm test');
  });

  it('should NOT render action-command-preview when showCommand is omitted', () => {
    const markdown = [
      '# Demo',
      '',
      '```action',
      'type: terminal.run',
      'command: npm test',
      '```',
    ].join('\n');

    const html = renderSlide(markdown);
    expect(html).not.to.contain('action-command-preview');
  });

  it('should show the file path for file.open with showCommand: true', () => {
    const markdown = [
      '```action',
      'type: file.open',
      'path: src/main.ts',
      'showCommand: true',
      '```',
    ].join('\n');

    const html = renderSlide(markdown);
    expect(html).to.contain('action-command-preview');
    expect(html).to.contain('src/main.ts');
  });

  it('should show path:lines for editor.highlight with showCommand: true', () => {
    const markdown = [
      '```action',
      'type: editor.highlight',
      'path: src/main.ts',
      'lines: 10-20',
      'showCommand: true',
      '```',
    ].join('\n');

    const html = renderSlide(markdown);
    expect(html).to.contain('action-command-preview');
    expect(html).to.contain('src/main.ts:10-20');
  });
});
