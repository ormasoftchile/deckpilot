/**
 * HTML sanitization for deck content.
 * Deck markdown is untrusted input — we always strip executable script vectors,
 * but allow common presentation elements (code blocks, fragments, lists, images).
 */

import DOMPurify from 'dompurify';

type PurifyConfig = Parameters<typeof DOMPurify.sanitize>[1];

const PURIFY_CONFIG: PurifyConfig = {
  USE_PROFILES: { html: true, svg: true },
  // Reveal.js fragment markers + slide data attrs
  ADD_ATTR: [
    'class',
    'data-fragment',
    'data-fragment-index',
    'data-fragment-animation',
    'data-id',
    'data-action',
    'data-action-type',
    'data-action-raw',
    'data-slide-index',
    'data-triton-reveal',
    'data-triton-expanded',
    'data-triton-step',
    'data-triton-step-key',
    'target',
    'rel',
  ],
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'srcdoc'],
};

export function sanitizeSlideHtml(html: string): string {
  const cleaned = DOMPurify.sanitize(html, PURIFY_CONFIG);
  return typeof cleaned === 'string' ? cleaned : String(cleaned);
}

/** Class tokens Reveal uses to hide/show fragments — stripped from the leading block. */
const FRAGMENT_CLASS_TOKENS = new Set(['fragment', 'visible', 'current-fragment']);

/**
 * Un-fragment ONLY the leading block-level element of a slide so its title /
 * first block is visible the moment the slide is entered.
 *
 * `@deckpilot/core` auto-fragments every block for step-through narration
 * (`class="fragment"` + `data-fragment*`). Reveal starts fragments hidden, so
 * without this every slide — including the title slide — renders blank until
 * the viewer taps or arrows. We deliberately DO NOT strip all fragments (that
 * killed block-by-block reveal and angered users); only the first block is
 * revealed on entry, every other block keeps its fragment markup and still
 * steps one at a time.
 *
 * Triton diagram figures (`figure[data-triton-reveal]`) are re-fragmented by
 * the reveal runtime after injection, so their progressive reveal is untouched
 * even if such a figure happens to be a slide's leading block.
 */
export function unfragmentLeadingBlock(html: string): string {
  if (!html || !html.includes('fragment')) return html;
  if (typeof DOMParser === 'undefined') return html;
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const body = doc.body;
  const first = body.firstElementChild;
  if (!first) return html;

  const classes = Array.from(first.classList).filter((c) => !FRAGMENT_CLASS_TOKENS.has(c));
  if (classes.length > 0) {
    first.setAttribute('class', classes.join(' '));
  } else {
    first.removeAttribute('class');
  }
  first.removeAttribute('data-fragment');
  first.removeAttribute('data-fragment-index');
  first.removeAttribute('data-fragment-animation');

  return body.innerHTML;
}
