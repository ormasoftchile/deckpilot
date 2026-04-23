/**
 * Slide ID extraction and auto-generation.
 *
 * Priority order:
 *  1. HTML comment:  <!-- id: intro -->
 *  2. Frontmatter:   id: intro
 *  3. First heading slug: # Introduction → "introduction"
 *  4. Positional fallback: slide-{index}
 *
 * Comment extraction (priority 1) must happen inside parseSlideContent so the
 * comment is stripped before rendering.  ID generation (priorities 2-4) runs
 * in parseSlides, after pending-frontmatter merging, so per-slide YAML blocks
 * (---\nid: setup\n---) are visible when the id is assigned.
 */

import { SlideFrontmatter } from '../models/slide';

/** Pattern for inline ID comment: <!-- id: some-id --> */
const ID_COMMENT_PATTERN = /<!--\s*id:\s*([a-zA-Z0-9_-]+)\s*-->/;

/** Pattern for the first ATX heading (# … through ###### …) */
const HEADING_PATTERN = /^#{1,6}\s+(.+)$/m;

/**
 * Convert a heading string to a URL-safe slug.
 * - Lowercase
 * - Collapse whitespace to hyphens
 * - Strip everything that is not alphanumeric or a hyphen
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Extract a slide ID from an HTML comment and strip the comment from content.
 * This is priority-1 extraction; call it inside parseSlideContent so the
 * comment is removed before markdown rendering.
 *
 * Returns `commentId: undefined` when no id comment is present.
 */
export function extractIdComment(
  content: string,
): { commentId?: string; cleanedContent: string } {
  const match = content.match(ID_COMMENT_PATTERN);
  if (match) {
    return {
      commentId: match[1],
      cleanedContent: content.replace(ID_COMMENT_PATTERN, '').trim(),
    };
  }
  return { cleanedContent: content };
}

/**
 * Generate a slide ID using priorities 2-4 (no comment stripping).
 * Call this after pending-frontmatter merging in parseSlides.
 *
 *  2. Frontmatter `id:` field
 *  3. First heading slug
 *  4. Positional fallback: slide-{index}
 */
export function generateSlideId(
  content: string,
  frontmatter: SlideFrontmatter | undefined,
  index: number,
): string {
  // Priority 2 — frontmatter id field
  const fmId = frontmatter?.id;
  if (typeof fmId === 'string' && fmId.trim().length > 0) {
    return fmId.trim();
  }

  // Priority 3 — first heading slug
  const headingMatch = content.match(HEADING_PATTERN);
  if (headingMatch) {
    const slug = slugify(headingMatch[1]);
    if (slug.length > 0) {
      return slug;
    }
  }

  // Priority 4 — positional fallback
  return `slide-${index}`;
}

/**
 * Ensure every auto-generated slide ID is unique within the deck.
 * Mutates the id field in place.  Duplicates get a numeric suffix: -2, -3, …
 *
 * Explicit IDs (idExplicit === true) are author-owned and are never
 * auto-suffixed — duplicate explicit IDs are a deck authoring error, not
 * something the parser should silently repair.  They are pre-registered so
 * that auto-generated IDs avoid colliding with them.
 */
export function resolveUniqueIds(
  slides: Array<{ id?: string; idExplicit?: boolean }>,
): void {
  const seen = new Map<string, number>();

  // First pass: register all explicit IDs so auto-generated IDs avoid collisions.
  for (const slide of slides) {
    if (slide.idExplicit && slide.id && slide.id !== '') {
      seen.set(slide.id, 1);
    }
  }

  // Second pass: deduplicate auto-generated IDs only.
  for (const slide of slides) {
    if (slide.idExplicit) {
      continue; // Explicit IDs are author-owned — never auto-suffixed
    }

    const base = slide.id ?? '';
    if (base === '') {
      continue;
    }

    const count = seen.get(base) ?? 0;
    if (count === 0) {
      seen.set(base, 1);
      // First occurrence — keep as-is
    } else {
      // Collision — append suffix, find a free slot
      let suffix = count + 1;
      let candidate = `${base}-${suffix}`;
      while (seen.has(candidate)) {
        suffix++;
        candidate = `${base}-${suffix}`;
      }
      seen.set(base, suffix);
      seen.set(candidate, 1);
      slide.id = candidate;
    }
  }
}
