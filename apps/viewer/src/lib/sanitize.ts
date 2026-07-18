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
