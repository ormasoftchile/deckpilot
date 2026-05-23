/**
 * Minimal YAML frontmatter parser. Replaces `gray-matter` for our usage:
 * we only need `--- ... ---` delimited YAML at the top of a Markdown document.
 * Dropping gray-matter and its transitive deps (section-matter, kind-of,
 * extend-shallow, is-extendable, strip-bom-string) shrinks the bundled
 * extension by ~50 KB minified.
 *
 * Behavior chosen to match the bits of gray-matter we actually relied on:
 *   - returns `{ data, content }` where `data` is the parsed YAML (object or {})
 *   - if no frontmatter fence is present, returns `{ data: {}, content: input }`
 *   - leading BOM is stripped
 *   - if YAML parsing fails, throws (callers already wrap calls in try/catch)
 */
import { load as yamlLoad } from 'js-yaml';

const FENCE_RE = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/;

export function matter(input: string): { data: Record<string, unknown>; content: string } {
  if (input.length === 0) return { data: {}, content: '' };
  const stripped = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const match = FENCE_RE.exec(stripped);
  if (!match) return { data: {}, content: stripped };
  const yamlBody = match[1];
  const content = stripped.slice(match[0].length);
  const parsed = yamlBody.trim().length === 0 ? {} : yamlLoad(yamlBody);
  const data =
    parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  return { data, content };
}

export default matter;
