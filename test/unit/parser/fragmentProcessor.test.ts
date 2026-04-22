/**
 * Unit tests for the auto-fragment processor.
 *
 * New behaviour (as of v0.8.4):
 *  - Every eligible block element fragments by default — no <!-- .fragment --> needed.
 *  - h1 is NEVER a fragment (slide title, always visible).
 *  - h2–h6, p, li, blockquote, table, div.render-block each become one step.
 *  - <div class="slide-group"> (:::group) becomes ONE fragment step; its children are NOT tagged.
 *  - data-no-fragment on a <p> opts that element out.
 *  - Loose list: <li><p>content</p></li> — inner <p> is NOT fragmented (de-tagged).
 *  - Phase 2 merges "fragment" into any existing class= attribute so there's only one class= attr.
 *  - Legacy <!-- .fragment --> comments are stripped but ignored (no longer drive behaviour).
 */

import { expect } from 'chai';
import { processFragments } from '../../../src/parser/fragmentProcessor';

// Helper: count occurrences of a substring
function countOccurrences(str: string, sub: string): number {
  return str.split(sub).length - 1;
}

// ---------------------------------------------------------------------------
// h1 — always visible
// ---------------------------------------------------------------------------

describe('processFragments — h1 never fragments', () => {
  it('h1 gets no fragment class or data-fragment attribute', () => {
    const { html, fragmentCount } = processFragments('<h1>Slide Title</h1>');
    expect(fragmentCount).to.equal(0);
    expect(html).to.not.contain('class="fragment"');
    expect(html).to.not.contain('data-fragment');
  });

  it('h1 alongside other elements does not gain fragment class', () => {
    const { html } = processFragments('<h1>Title</h1>\n<p>Body</p>');
    expect(html).to.match(/<h1>Title<\/h1>/);
    expect(html).to.not.contain('<h1 class=');
  });
});

// ---------------------------------------------------------------------------
// Paragraph auto-fragmentation
// ---------------------------------------------------------------------------

describe('processFragments — paragraphs', () => {
  it('every <p> is a fragment by default', () => {
    const { html, fragmentCount } = processFragments('<p>First</p>\n<p>Second</p>');
    expect(fragmentCount).to.equal(2);
    expect(html).to.contain('data-fragment="1"');
    expect(html).to.contain('data-fragment="2"');
  });

  it('<p data-no-fragment> is excluded', () => {
    const { html, fragmentCount } = processFragments(
      '<p data-no-fragment>Always visible</p>\n<p>Hidden initially</p>'
    );
    expect(fragmentCount).to.equal(1);
    expect(html).to.not.contain('data-no-fragment" class="fragment"');
    expect(html).to.contain('<p data-no-fragment>Always visible</p>');
    expect(html).to.contain('<p class="fragment"');
  });
});

// ---------------------------------------------------------------------------
// List item auto-fragmentation
// ---------------------------------------------------------------------------

describe('processFragments — tight lists', () => {
  it('each <li> in a tight list is its own fragment step', () => {
    const html = '<ul>\n<li>Alpha</li>\n<li>Beta</li>\n<li>Gamma</li>\n</ul>';
    const { html: out, fragmentCount } = processFragments(html);
    expect(fragmentCount).to.equal(3);
    expect(out).to.contain('data-fragment="1"');
    expect(out).to.contain('data-fragment="2"');
    expect(out).to.contain('data-fragment="3"');
  });

  it('fragment indices are in document order', () => {
    const html = '<ul>\n<li>One</li>\n<li>Two</li>\n<li>Three</li>\n</ul>';
    const { html: out } = processFragments(html);
    const pos1 = out.indexOf('data-fragment="1"');
    const pos2 = out.indexOf('data-fragment="2"');
    const pos3 = out.indexOf('data-fragment="3"');
    expect(pos1).to.be.lessThan(pos2);
    expect(pos2).to.be.lessThan(pos3);
  });

  it('uses fade animation by default', () => {
    const { html } = processFragments('<ul>\n<li>Item</li>\n</ul>');
    expect(html).to.contain('data-fragment-animation="fade"');
  });
});

describe('processFragments — loose lists (markdown-it wraps content in <p>)', () => {
  it('loose list <li><p>content</p></li> counts as one step, not two', () => {
    // markdown-it produces <li><p>text</p></li> for loose lists
    const html = '<ul>\n<li><p>First</p></li>\n<li><p>Second</p></li>\n</ul>';
    const { html: out, fragmentCount } = processFragments(html);
    // 2 <li> = 2 steps, the inner <p> must NOT add extra steps
    expect(fragmentCount).to.equal(2);
    // <li> should be a fragment
    expect(out).to.contain('<li class="fragment"');
    // Inner <p> must NOT be a fragment
    expect(out).to.not.match(/<li[^>]*>[\s]*<p[^>]*class="fragment"/);
  });
});

// ---------------------------------------------------------------------------
// Heading h2–h6 auto-fragmentation
// ---------------------------------------------------------------------------

describe('processFragments — h2–h6', () => {
  it('h2 through h6 each become a fragment step', () => {
    const html = '<h2>Section</h2>\n<h3>Sub</h3>\n<h4>Sub-sub</h4>';
    const { fragmentCount } = processFragments(html);
    expect(fragmentCount).to.equal(3);
  });
});

// ---------------------------------------------------------------------------
// blockquote and table
// ---------------------------------------------------------------------------

describe('processFragments — blockquote and table', () => {
  it('blockquote becomes one fragment; inner <p> is de-tagged (same as loose list)', () => {
    // markdown-it wraps blockquote content in <p>: <blockquote><p>text</p></blockquote>
    const { html, fragmentCount } = processFragments('<blockquote><p>Quote</p></blockquote>');
    expect(fragmentCount).to.equal(1);
    expect(html).to.contain('<blockquote class="fragment"');
    // Inner <p> must NOT be a second fragment step
    expect(html).to.not.match(/<p[^>]*class="fragment"/);
  });

  it('table becomes a single fragment (not each row)', () => {
    const html = '<table>\n<tr><td>A</td></tr>\n<tr><td>B</td></tr>\n</table>';
    const { fragmentCount } = processFragments(html);
    expect(fragmentCount).to.equal(1);
  });
});

// ---------------------------------------------------------------------------
// :::group → <div class="slide-group"> becomes ONE fragment step
// ---------------------------------------------------------------------------

describe('processFragments — slide-group (:::group)', () => {
  it('slide-group container is one fragment; its li children are NOT tagged', () => {
    const html = [
      '<div class="slide-group">',
      '<ul>',
      '<li>Bullet 1</li>',
      '<li>Bullet 2</li>',
      '</ul>',
      '</div>',
    ].join('\n');
    const { html: out, fragmentCount } = processFragments(html);
    expect(fragmentCount).to.equal(1);
    // The container should have class="slide-group fragment" (merged, not duplicate)
    expect(out).to.contain('class="slide-group fragment"');
    // Children must NOT be fragments
    expect(out).to.not.match(/<li[^>]*class="fragment"/);
  });

  it('merges "fragment" into existing class= — no duplicate class= attributes', () => {
    const html = '<div class="slide-group">\n<p>Content</p>\n</div>';
    const { html: out } = processFragments(html);
    // Must NOT have two class= on the same tag
    const openTag = out.match(/<div[^>]*>/)?.[0] ?? '';
    expect(countOccurrences(openTag, 'class=')).to.equal(1);
    expect(openTag).to.contain('slide-group fragment');
  });

  it('content outside the group fragments normally after the group', () => {
    const html = [
      '<div class="slide-group">',
      '<ul><li>A</li><li>B</li></ul>',
      '</div>',
      '<ul>',
      '<li>C</li>',
      '<li>D</li>',
      '</ul>',
    ].join('\n');
    const { html: out, fragmentCount } = processFragments(html);
    // group = 1, C = 2, D = 3
    expect(fragmentCount).to.equal(3);
    expect(out).to.contain('data-fragment="1"');  // the group
    expect(out).to.contain('data-fragment="2"');  // C
    expect(out).to.contain('data-fragment="3"');  // D
  });

  it('handles nested divs inside slide-group without breaking depth counting', () => {
    const html = [
      '<div class="slide-group">',
      '<div class="inner"><p>Nested</p></div>',
      '</div>',
      '<p>After group</p>',
    ].join('\n');
    const { fragmentCount } = processFragments(html);
    // 1 for the group, 1 for the <p> after — inner <p> and <div> must not be tagged
    expect(fragmentCount).to.equal(2);
  });
});

// ---------------------------------------------------------------------------
// Mixed: paragraph + list (the full "Group Opt-Out" slide scenario)
// ---------------------------------------------------------------------------

describe('processFragments — group opt-out slide scenario', () => {
  it('paragraph(1) → group(2) → 3 individual bullets(3,4,5)', () => {
    const html = [
      '<h1>Group Opt-Out</h1>',
      '<p>Intro text.</p>',
      '<div class="slide-group">',
      '<ul><li>Grouped A</li><li>Grouped B</li></ul>',
      '</div>',
      '<ul>',
      '<li>Solo C</li>',
      '<li>Solo D</li>',
      '<li>Solo E</li>',
      '</ul>',
    ].join('\n');
    const { html: out, fragmentCount } = processFragments(html);

    expect(fragmentCount).to.equal(5);
    // h1 untouched
    expect(out).to.match(/<h1>Group Opt-Out<\/h1>/);
    // intro = step 1
    expect(out).to.contain('<p class="fragment" data-fragment="1"');
    // group = step 2, class merged correctly
    expect(out).to.contain('class="slide-group fragment" data-fragment="2"');
    // bullets 3–5
    expect(out).to.contain('data-fragment="3"');
    expect(out).to.contain('data-fragment="4"');
    expect(out).to.contain('data-fragment="5"');
    // No duplicate class= on the group div
    const groupTag = out.match(/<div[^>]*slide-group[^>]*>/)?.[0] ?? '';
    expect(countOccurrences(groupTag, 'class=')).to.equal(1);
  });
});

// ---------------------------------------------------------------------------
// pre (code blocks) auto-fragmentation
// ---------------------------------------------------------------------------

describe('processFragments — pre (code blocks)', () => {
  it('a bare <pre> becomes a fragment step', () => {
    const { html, fragmentCount } = processFragments('<pre><code>npm install</code></pre>');
    expect(fragmentCount).to.equal(1);
    expect(html).to.contain('<pre class="fragment"');
    expect(html).to.contain('data-fragment="1"');
  });

  it('<pre> after a <p> fragments AFTER the paragraph (correct reveal order)', () => {
    const html = '<h1>Setup</h1>\n<p>Install dependencies before running:</p>\n<pre><code>npm install</code></pre>';
    const { html: out, fragmentCount } = processFragments(html);
    // h1 is not a fragment; p=1, pre=2
    expect(fragmentCount).to.equal(2);
    expect(out).to.contain('<p class="fragment" data-fragment="1"');
    expect(out).to.contain('<pre class="fragment" data-fragment="2"');
  });

  it('<pre> with data attributes works correctly', () => {
    // markdown-it puts language class on <code>, not <pre>
    // so <pre> with a data attribute is the realistic edge case
    const { html } = processFragments('<pre data-lang="bash"><code>npm install</code></pre>');
    expect(html).to.contain('class="fragment"');
    expect(html).to.contain('data-fragment="1"');
    expect(html).to.contain('data-lang="bash"');
  });

  it('multiple <pre> blocks each become separate fragment steps', () => {
    const html = '<pre><code>step one</code></pre>\n<pre><code>step two</code></pre>';
    const { fragmentCount } = processFragments(html);
    expect(fragmentCount).to.equal(2);
  });

  it('uses fade animation for <pre> by default', () => {
    const { html } = processFragments('<pre><code>hello</code></pre>');
    expect(html).to.contain('data-fragment-animation="fade"');
  });
});



describe('processFragments — legacy comment stripping', () => {
  it('removes <!-- .fragment --> comments from output', () => {
    const html = '<ul>\n<li>Item <!-- .fragment --></li>\n</ul>';
    const { html: out } = processFragments(html);
    expect(out).to.not.contain('<!-- .fragment -->');
    // The li is still a fragment (by default, not by comment)
    expect(out).to.contain('<li class="fragment"');
  });

  it('removes <!-- .fragment slide-up --> variant comments', () => {
    const html = '<p>Para <!-- .fragment slide-up --></p>';
    const { html: out } = processFragments(html);
    expect(out).to.not.contain('<!--');
    expect(out).to.contain('<p class="fragment"');
  });
});
