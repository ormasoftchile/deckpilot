/**
 * Fragment processor - handles slide fragment annotations.
 * Pure functions with no VS Code dependencies for testability.
 *
 * Standard block-level slide content auto-fragments by default so authors can
 * reveal the narrative one block at a time in natural document order,
 * including async diagram placeholders.
 */

const FRAGMENT_COMMENT_RE = /\s*<!--\s*\.fragment(?:\s+([\w-]+))?\s*-->/g;

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

function stripFragmentComments(html: string): string {
  return html.replace(FRAGMENT_COMMENT_RE, '');
}

function stripRemainingFragAttrs(html: string): string {
  return html.replace(/\s+__frag="[\w-]+"/g, '');
}

function addFragAttrToOpenTag(openTag: string, animation = 'fade'): string {
  if (/__frag=/.test(openTag) || /data-no-fragment/.test(openTag)) {
    return openTag;
  }
  return openTag.replace(/>$/, ` __frag="${animation}">`);
}

function tagSimpleElementWithComment(seg: string, tag: string, skipDataNoFragment = true): string {
  const noFragmentGuard = skipDataNoFragment ? '(?![^>]*data-no-fragment)' : '';
  const inside = new RegExp(
    `(<${tag}\\b)(?![^>]*__frag)${noFragmentGuard}([^>]*>)((?:(?!<\\/${tag}>)[\\s\\S])*?)<!--\\s*\\.fragment(?:\\s+([\\w-]+))?\\s*-->((?:(?!<\\/${tag}>)[\\s\\S])*?<\\/${tag}>)`,
    'g',
  );

  seg = seg.replace(
    inside,
    (_m, start: string, attrsAndClose: string, beforeComment: string, animation: string | undefined, afterComment: string) =>
      `${start}${attrsAndClose.slice(0, -1)} __frag="${animation ?? 'fade'}">${beforeComment}${afterComment}`,
  );
  return seg;
}

function tagRenderBlocksWithComment(seg: string): string {
  const inside = /(<div\b(?=[^>]*\brender-block\b)[^>]*)(?![^>]*__frag)([^>]*>)((?:(?!<\/div>)[\s\S])*?)<!--\s*\.fragment(?:\s+([\w-]+))?\s*-->((?:(?!<\/div>)[\s\S])*?<\/div>)/g;

  seg = seg.replace(
    inside,
    (_m, start: string, attrsAndClose: string, beforeComment: string, animation: string | undefined, afterComment: string) =>
      `${start}${attrsAndClose.slice(0, -1)} __frag="${animation ?? 'fade'}">${beforeComment}${afterComment}`,
  );
  return seg;
}

function tagExplicitElements(seg: string): string {
  for (const heading of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) {
    seg = tagSimpleElementWithComment(seg, heading);
  }
  for (const tag of ['p', 'ul', 'ol', 'blockquote', 'table', 'pre', 'figure']) {
    seg = tagSimpleElementWithComment(seg, tag);
  }
  seg = tagRenderBlocksWithComment(seg);
  return seg;
}

function tagAutoElements(seg: string): string {
  for (const heading of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) {
    const pattern = new RegExp(`(<${heading}\\b)(?![^>]*__frag)(?![^>]*data-no-fragment)([^>]*>)`, 'g');
    seg = seg.replace(pattern, (_m, start: string, rest: string) => `${start}${rest.slice(0, -1)} __frag="fade">`);
  }

  for (const tag of ['p', 'ul', 'ol', 'blockquote', 'table', 'pre', 'figure']) {
    const pattern = new RegExp(`(<${tag}\\b)(?![^>]*__frag)(?![^>]*data-no-fragment)([^>]*>)`, 'g');
    seg = seg.replace(pattern, (_m, start: string, rest: string) => `${start}${rest.slice(0, -1)} __frag="fade">`);
  }

  seg = seg.replace(
    /(<div\b(?=[^>]*\brender-block\b)[^>]*)(?![^>]*__frag)(?![^>]*data-no-fragment)([^>]*>)/g,
    (_m, start: string, rest: string) => `${start}${rest.slice(0, -1)} __frag="fade">`,
  );

  return seg;
}

function tagWrapperUnits(seg: string): string {
  seg = seg.replace(
    /(<details\b[^>]*>)([\s\S]*?)(<\/details>)/g,
    (_m: string, open: string, inner: string, close: string) =>
      `${addFragAttrToOpenTag(open)}${stripFragmentComments(inner)}${close}`,
  );
  seg = seg.replace(
    /(<div\b[^>]*\bstep-optional\b[^>]*>)([\s\S]*?)(<\/div>)/g,
    (_m: string, open: string, inner: string, close: string) =>
      `${addFragAttrToOpenTag(open)}${stripFragmentComments(inner)}${close}`,
  );

  seg = seg.replace(
    /(<details\b[^>]*>)([\s\S]*?)(<\/details>)/g,
    (_m: string, open: string, inner: string, close: string) => `${open}${inner.replace(/ __frag="[\w-]+"/g, '')}${close}`,
  );
  seg = seg.replace(
    /(<div\b[^>]*\bstep-optional\b[^>]*>)([\s\S]*?)(<\/div>)/g,
    (_m: string, open: string, inner: string, close: string) => `${open}${inner.replace(/ __frag="[\w-]+"/g, '')}${close}`,
  );

  return seg;
}

function stripNestedParagraphFragments(seg: string): string {
  seg = seg.replace(
    /(<li\b[^>]*>)(\s*<p\b[^>]*?) __frag="[\w-]+"([^>]*>)/g,
    (_m, li: string, pStart: string, pRest: string) => `${li}${pStart}${pRest}`,
  );
  seg = seg.replace(
    /(<blockquote\b[^>]*>)(\s*<p\b[^>]*?) __frag="[\w-]+"([^>]*>)/g,
    (_m, blockquote: string, pStart: string, pRest: string) => `${blockquote}${pStart}${pRest}`,
  );
  return seg;
}

/**
 * Process fragments in slide HTML.
 * Standard block elements become fragment steps automatically in document order.
 */
export function processFragments(html: string): { html: string; fragmentCount: number } {
  const segments = splitOnGroups(html);
  const tagged = segments.map(seg => {
    if (seg.isGroup) {
      return stripFragmentComments(
        seg.text.replace(
          /<div class="slide-group"[^>]*>/,
          (openTag: string) => addFragAttrToOpenTag(openTag),
        ),
      );
    }

    return stripFragmentComments(
      stripNestedParagraphFragments(
        tagWrapperUnits(
          tagAutoElements(
            tagExplicitElements(seg.text),
          ),
        ),
      ),
    );
  }).join('');

  let fragmentIndex = 0;
  const result = tagged.replace(
    /(<(?:p|ul|ol|h[1-6]|blockquote|table|div|pre|details|figure)\b[^>]*?) __frag="([\w-]+)"([^>]*>)/g,
    (_m, pre: string, animation: string, post: string) => {
      fragmentIndex++;
      let withClass: string;
      if (/class="[^"]*"/.test(pre)) {
        withClass = pre.replace(/class="([^"]*)"/, 'class="$1 fragment"');
      } else {
        withClass = `${pre} class="fragment"`;
      }
      return `${withClass} data-fragment="${fragmentIndex}" data-fragment-animation="${animation}"${post}`;
    },
  );

  return { html: stripRemainingFragAttrs(result), fragmentCount: fragmentIndex };
}
