/**
 * Fragment processor - handles slide fragment animations
 * Pure functions with no VS Code dependencies for testability
 */

/**
 * Process fragment markers in HTML
 * Transforms <!-- .fragment --> comments into fragment class attributes.
 *
 * Also promotes any non-fragment block elements that appear AFTER the first
 * fragment on a slide so they don't render immediately while earlier
 * fragments are still hidden.
 *
 * Uses a two-phase sentinel approach so all fragment indices are assigned in
 * document order (explicit AND auto-promoted elements interleaved correctly).
 *
 * @param html - The HTML content to process
 * @returns Object with processed HTML and fragment count
 */
export function processFragments(html: string): { html: string; fragmentCount: number } {
  if (!/<!--\s*\.fragment/.test(html)) {
    return { html, fragmentCount: 0 };
  }

  // Phase 1 — tag every element that needs a fragment index with a sentinel
  // attribute (__frag) so we can assign indices in a single document-order
  // pass later.

  // 1a. Explicit <!-- .fragment [animation] --> markers → add sentinel, strip comment.
  let tagged = html.replace(
    /(<(li|p|h[1-6]|div|blockquote)\b[^>]*>)((?:(?!<\/(?:li|p|h[1-6]|div|blockquote)\b)[\s\S])*?)(<!--\s*\.fragment(?:\s+([\w-]+))?\s*-->)/g,
    (_m, openTag: string, tagName: string, content: string, _comment: string, anim?: string) => {
      const animation = anim ?? 'fade';
      return openTag.replace(`<${tagName}`, `<${tagName} __frag="${animation}"`) + content;
    },
  );

  // 1b. Auto-promote: p, h1-h6, and blockquote elements that appear AFTER
  //     the first sentinel-tagged element and are not already tagged.
  //     This ensures content after a fragment list doesn't render immediately.
  const firstSentinel = tagged.search(/__frag="/);
  if (firstSentinel === -1) {
    return { html, fragmentCount: 0 };
  }

  const pre = tagged.slice(0, firstSentinel);
  const post = tagged.slice(firstSentinel).replace(
    /(<(p|h[1-6]|blockquote)\b)(?![^>]*__frag=)([^>]*>)/g,
    (_m, tagStart: string, _tag: string, rest: string) => `${tagStart} __frag="fade"${rest}`,
  );
  tagged = pre + post;

  // Phase 2 — single document-order sweep: assign sequential fragment indices
  // to every sentinelled element so explicit and auto-promoted elements are
  // correctly interleaved.
  let fragmentIndex = 0;
  const result = tagged.replace(
    /(<(li|p|h[1-6]|div|blockquote)\b[^>]*?) __frag="([\w-]+)"([^>]*>)/g,
    (_m, pre2: string, _tag: string, animation: string, post2: string) => {
      fragmentIndex++;
      return `${pre2} class="fragment" data-fragment="${fragmentIndex}" data-fragment-animation="${animation}"${post2}`;
    },
  );

  return { html: result, fragmentCount: fragmentIndex };
}

