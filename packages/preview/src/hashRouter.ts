/**
 * Hash router for `#slide=N` deep links.
 * Slide indices are 1-based in the URL but 0-based internally.
 */

const HASH_RE = /(?:^|[&#])slide=(\d+)/i;

export function readSlideFromHash(hash: string = window.location.hash): number {
  const m = hash.match(HASH_RE);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n >= 1 ? n - 1 : 0;
}

export function writeSlideToHash(index: number): void {
  const display = index + 1;
  const next = `#slide=${display}`;
  if (window.location.hash !== next) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${next}`);
  }
}

export function onHashChange(handler: (index: number) => void): () => void {
  const listener = (): void => handler(readSlideFromHash());
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
}
