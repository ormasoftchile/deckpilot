/**
 * Browser fs stub for @deckpilot/core consumption in apps/viewer.
 *
 * Behavior: every call rejects with an ENOENT-like error. The viewer never relies on
 * `fs` — sidecars are fetched over HTTP and merged manually. Core code paths that
 * touch `fs` (sidecarLoader, envFileLoader) catch these errors and treat them as
 * "no sidecar / no env file present", which is the correct browser default.
 */

function enoent(p: string): Error {
  return Object.assign(new Error(`ENOENT: ${p}`), { code: 'ENOENT' });
}

const promises = {
  async readFile(p: string): Promise<string> {
    throw enoent(p);
  },
  async access(p: string): Promise<void> {
    throw enoent(p);
  },
  async stat(p: string): Promise<never> {
    throw enoent(p);
  },
};

export { promises };
export const constants = { F_OK: 0, R_OK: 4 };
export function existsSync(_p: string): boolean {
  return false;
}
export function readFileSync(p: string): never {
  throw enoent(p);
}
export default { promises, constants, existsSync, readFileSync };
