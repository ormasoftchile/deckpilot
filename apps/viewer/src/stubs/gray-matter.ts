/**
 * Browser stub for gray-matter.
 *
 * Real gray-matter pulls in Node Buffer and several filesystem helpers; we only
 * need YAML frontmatter splitting for `.deck.md` strings. We delegate YAML parsing
 * to js-yaml (browser-safe) and return the same shape `{ data, content }` that the
 * core deck parser consumes.
 */

import yaml from 'js-yaml';

export interface GrayMatterFile<T = Record<string, unknown>> {
  data: T;
  content: string;
  excerpt?: string;
  orig: string;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function matter<T = Record<string, unknown>>(input: string): GrayMatterFile<T> {
  if (typeof input !== 'string') {
    return { data: {} as T, content: '', orig: '' };
  }
  const match = input.match(FRONTMATTER_RE);
  if (!match) {
    return { data: {} as T, content: input, orig: input };
  }
  let data: T = {} as T;
  try {
    const parsed = yaml.load(match[1]);
    if (parsed && typeof parsed === 'object') {
      data = parsed as T;
    }
  } catch {
    // Treat parse failures as "no frontmatter" — viewer surfaces malformed YAML separately.
  }
  const content = input.slice(match[0].length);
  return { data, content, orig: input };
}

export default matter;
