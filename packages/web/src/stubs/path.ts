/**
 * Minimal path stub for Vite (browser environment).
 * Only the functions actually used by renderer modules are implemented.
 */

export function resolve(...parts: string[]): string {
  return join(...parts);
}

export function join(...parts: string[]): string {
  return parts.join('/').replace(/\/+/g, '/');
}

export function extname(p: string): string {
  const base = p.split('/').pop() ?? '';
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot) : '';
}

export function basename(p: string, ext?: string): string {
  let base = p.split('/').pop() ?? '';
  if (ext && base.endsWith(ext)) base = base.slice(0, base.length - ext.length);
  return base;
}

export function dirname(p: string): string {
  const parts = p.split('/');
  parts.pop();
  return parts.join('/') || '.';
}

export function isAbsolute(p: string): boolean {
  return p.startsWith('/');
}

export const sep = '/';

export default { resolve, join, extname, basename, dirname, isAbsolute, sep };
