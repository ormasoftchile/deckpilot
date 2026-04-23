/**
 * URL allowlist validator for the browser panel.
 * Permits HTTPS remote URLs and HTTP for localhost / loopback only.
 */

/**
 * Returns true if the URL is allowed to be opened in the browser panel.
 * Allowed:
 *   - https://<any host>
 *   - http://localhost[:<port>]
 *   - http://127.0.0.1[:<port>]
 *   - http://[::1][:<port>]
 * Everything else (javascript:, file:, data:, arbitrary http:// remote) is rejected.
 */
export function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:') {
      return true;
    }
    if (parsed.protocol === 'http:') {
      const host = parsed.hostname.toLowerCase();
      return host === 'localhost' || host === '127.0.0.1' || host === '::1';
    }
    return false;
  } catch {
    return false;
  }
}
