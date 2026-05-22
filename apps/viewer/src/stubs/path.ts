/**
 * Minimal path stub for the browser. Mirrors POSIX semantics on URL-shaped paths.
 */

export function join(...parts: string[]): string {
  return parts.filter(Boolean).join('/').replace(/\/+/g, '/');
}

export function resolve(...parts: string[]): string {
  return join(...parts);
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

export default { join, resolve, extname, basename, dirname, isAbsolute, sep };
