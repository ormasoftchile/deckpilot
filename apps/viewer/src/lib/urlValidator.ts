/**
 * URL validation for the public viewer.
 *
 * Rules:
 *  - Only http(s) schemes accepted.
 *  - http:// is allowed for localhost / 127.0.0.1 only (dev convenience).
 *  - data:, file:, javascript:, vbscript:, blob:, ftp:, etc. are rejected.
 *  - Empty / malformed inputs rejected with a friendly message.
 */

export interface UrlValidationResult {
  ok: boolean;
  url?: URL;
  error?: string;
}

export function validateDeckUrl(raw: string): UrlValidationResult {
  if (!raw || typeof raw !== 'string') {
    return { ok: false, error: 'Missing deck URL.' };
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: 'Missing deck URL.' };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, error: `Not a valid URL: ${trimmed}` };
  }

  if (url.protocol === 'https:') {
    return { ok: true, url };
  }

  if (url.protocol === 'http:') {
    const host = url.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
      return { ok: true, url };
    }
    return {
      ok: false,
      error: 'Only https:// URLs are allowed (http:// permitted for localhost only).',
    };
  }

  return {
    ok: false,
    error: `Unsupported URL scheme: ${url.protocol}. Use https://`,
  };
}

/**
 * Derive the sidecar `.deck.yaml` URL for a given `.deck.md` URL, if applicable.
 * Returns null if the path does not end with `.deck.md`.
 */
export function deriveSidecarUrl(deckUrl: URL): URL | null {
  if (!deckUrl.pathname.endsWith('.deck.md')) {
    return null;
  }
  const sidecar = new URL(deckUrl.toString());
  sidecar.pathname = sidecar.pathname.replace(/\.deck\.md$/, '.deck.yaml');
  return sidecar;
}
