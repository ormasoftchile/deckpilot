/**
 * Minimal child_process stub for Vite (browser environment).
 * commandRenderer.ts imports spawn but never calls it during a parse.
 */

export function spawn() {
  throw new Error('child_process.spawn is not available in the browser');
}

export function exec() {
  throw new Error('child_process.exec is not available in the browser');
}

export type SpawnOptions = Record<string, unknown>;
