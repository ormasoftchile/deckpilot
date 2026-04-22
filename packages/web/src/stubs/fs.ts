/**
 * Minimal fs stub for Vite (browser environment).
 * Routes file existence checks and reads through the Vite dev-server /api/file endpoint.
 * Absolute paths are converted to workspace-relative paths by stripping the leading slash.
 */

const API_BASE = '/api/file?path=';

function toRelative(p: string): string {
  // Strip leading slash so it becomes a relative path the server accepts
  return p.startsWith('/') ? p.slice(1) : p;
}

async function readFile(p: string, _encoding: string): Promise<string> {
  const res = await fetch(`${API_BASE}${encodeURIComponent(toRelative(p))}`);
  if (!res.ok) throw Object.assign(new Error(`ENOENT: ${p}`), { code: 'ENOENT' });
  return res.text();
}

async function access(p: string): Promise<void> {
  const res = await fetch(`${API_BASE}${encodeURIComponent(toRelative(p))}`, { method: 'HEAD' });
  if (!res.ok) throw Object.assign(new Error(`ENOENT: ${p}`), { code: 'ENOENT' });
}

export const promises = { readFile, access };
export const constants = { F_OK: 0 };
