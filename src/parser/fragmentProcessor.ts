/**
 * Fragment processor - handles slide fragment animations
 * Pure functions with no VS Code dependencies for testability
 *
 * All block-level elements fragment by default:
 *   - <h1> is always visible (slide title)
 *   - <h2>–<h6>, <p>, <blockquote>, <table>, <li>, render-blocks → each a separate step
 *   - <div class="slide-group"> → the whole group appears as one step
 *   - <!-- .fragment --> comments are still honoured for backward compat but no
 *     longer necessary — everything is already a fragment by default
 */

/**
 * Split HTML into segments, separating out <div class="slide-group"> blocks
 * using depth-counting so nested divs inside groups are handled correctly.
 */
function splitOnGroups(html: string): Array<{ text: string; isGroup: boolean }> {
  const result: Array<{ text: string; isGroup: boolean }> = [];
  const OPEN_MARKER = '<div class="slide-group"';
  const OPEN_DIV = '<div';
  const CLOSE_DIV = '</div>';

  let i = 0;
  let outside = '';

  while (i < html.length) {
    const groupStart = html.indexOf(OPEN_MARKER, i);
    if (groupStart === -1) {
      outside += html.slice(i);
      break;
    }

    outside += html.slice(i, groupStart);
    if (outside) { result.push({ text: outside, isGroup: false }); outside = ''; }

    // Depth-count to find the matching </div>
    let depth = 0;
    let j = groupStart;
    while (j < html.length) {
      if (html.startsWith(OPEN_DIV, j)) { depth++; j += OPEN_DIV.length; continue; }
      if (html.startsWith(CLOSE_DIV, j)) {
        depth--;
        j += CLOSE_DIV.length;
        if (depth === 0) break;
        continue;
      }
      j++;
    }

    result.push({ text: html.slice(groupStart, j), isGroup: true });
    i = j;
  }

  if (outside) { result.push({ text: outside, isGroup: false }); }
  return result;
}

/**
 * Add __frag sentinel to all eligible block elements in an HTML segment
 * that should each be their own fragment step.
 *
 * Eligible: p, h2–h6, blockquote, table, li, div.render-block
 * NOT eligible: h1 (always visible), ul/ol containers (their li children fragment)
 */
function tagEligibleElements(seg: string): string {
  // Strip legacy <!-- .fragment --> comments (no longer needed)
  seg = seg.replace(/\s*<!--\s*\.fragment(?:\s+[\w-]+)?\s*-->/g, '');

  // h2–h6
  seg = seg.replace(
    /(<h([2-6])\b)(?![^>]*__frag)([^>]*>)/g,
    (_m, start, _n, rest) => `${start} __frag="fade"${rest}`,
  );
  // p (skip if data-no-fragment)
  seg = seg.replace(
    /(<p\b)(?![^>]*__frag)(?![^>]*data-no-fragment)([^>]*>)/g,
    (_m, start, rest) => `${start} __frag="fade"${rest}`,
  );
  // blockquote
  seg = seg.replace(
    /(<blockquote\b)(?![^>]*__frag)([^>]*>)/g,
    (_m, start, rest) => `${start} __frag="fade"${rest}`,
  );
  // table
  seg = seg.replace(
    /(<table\b)(?![^>]*__frag)([^>]*>)/g,
    (_m, start, rest) => `${start} __frag="fade"${rest}`,
  );
  // li
  seg = seg.replace(
    /(<li\b)(?![^>]*__frag)([^>]*>)/g,
    (_m, start, rest) => `${start} __frag="fade"${rest}`,
  );
  // render-block divs (but not slide-group)
  seg = seg.replace(
    /(<div\b(?=[^>]*\brender-block\b)[^>]*)(?![^>]*__frag)([^>]*>)/g,
    (_m, start, rest) => `${start} __frag="fade"${rest}`,
  );

  // De-tag <p> elements that are direct children of <li> (loose list items).
  // markdown-it wraps loose list item content in <p>, causing the bullet to
  // appear empty on one step and the text on the next.
  seg = seg.replace(
    /(<li\b[^>]*>)(\s*<p\b[^>]*?) __frag="[\w-]+"([^>]*>)/g,
    (_m, li, pStart, pRest) => `${li}${pStart}${pRest}`,
  );

  // De-tag <p> elements that are direct children of <blockquote>.
  // markdown-it wraps blockquote content in <p>, tagging both the blockquote
  // and its inner paragraph would create two steps for one visual unit.
  seg = seg.replace(
    /(<blockquote\b[^>]*>)(\s*<p\b[^>]*?) __frag="[\w-]+"([^>]*>)/g,
    (_m, bq, pStart, pRest) => `${bq}${pStart}${pRest}`,
  );

  return seg;
}

/**
 * Process fragments in slide HTML.
 * Every eligible block element becomes a fragment step automatically.
 */
export function processFragments(html: string): { html: string; fragmentCount: number } {
  // Phase 1 — add __frag sentinels

  const segments = splitOnGroups(html);
  const tagged = segments.map(seg => {
    if (seg.isGroup) {
      // Tag the slide-group div itself as one fragment, leave its children alone
      return seg.text.replace(
        /(<div class="slide-group")/,
        '$1 __frag="fade"',
      );
    }
    return tagEligibleElements(seg.text);
  }).join('');

  // Phase 2 — assign sequential fragment indices in document order
  let fragmentIndex = 0;
  const result = tagged.replace(
    /(<(?:li|p|h[2-6]|blockquote|table|div)\b[^>]*?) __frag="([\w-]+)"([^>]*>)/g,
    (_m, pre: string, animation, post) => {
      fragmentIndex++;
      // Merge fragment into an existing class attribute to avoid duplicate class= attributes
      // (duplicate class= causes browsers to only honour the first one, breaking visibility)
      let withClass: string;
      if (/class="[^"]*"/.test(pre)) {
        withClass = pre.replace(/class="([^"]*)"/, 'class="$1 fragment"');
      } else {
        withClass = `${pre} class="fragment"`;
      }
      return `${withClass} data-fragment="${fragmentIndex}" data-fragment-animation="${animation}"${post}`;
    },
  );

  return { html: result, fragmentCount: fragmentIndex };
}

