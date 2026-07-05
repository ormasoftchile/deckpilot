/**
 * Slide-break resolver — decides where one slide ends and the next begins.
 *
 * Splitting the deck body into raw slide chunks is intentionally isolated here
 * because the delimiter is configurable and the logic must be *fence-aware*:
 * a delimiter that appears inside a fenced code block (``` … ``` or ~~~ … ~~~)
 * must never split a slide.
 *
 * Three break signals are supported:
 *
 *   1. `<!-- slide -->`  — the canonical marker. Always active in every mode.
 *                          Idiomatic with the rest of deckpilot's comment
 *                          directives (`<!-- id: -->`, `<!-- center -->`, …)
 *                          and invisible when the `.deck.md` is rendered by a
 *                          plain Markdown viewer. An optional trailing label is
 *                          allowed for readability, e.g. `<!-- slide 10 - intro -->`
 *                          (the label is decorative and ignored).
 *
 *   2. `---`             — a bare horizontal rule. Still supported for backward
 *                          compatibility, but *deprecated* as a slide separator
 *                          (it collides with YAML frontmatter fences). When a
 *                          `---` line is used to separate real content, the
 *                          resolver reports it via `usedDeprecatedDelimiter`
 *                          so callers can surface a migration warning.
 *
 *   3. blank-line runs   — two or more consecutive empty lines. The DEFAULT
 *                          separator. Markdown assigns no meaning to multiple
 *                          blank lines between blocks (CommonMark §4.1; a run
 *                          renders identically to a single blank), so this is a
 *                          safe, ergonomic slide boundary. Fenced and indented
 *                          code blocks are protected. Opt out per-deck with
 *                          frontmatter `slideBreak: marker`.
 *
 *   4. headings          — split BEFORE headings of configured levels. Enabled
 *                          with `slideBreak: heading` (levels 1–2), or a level
 *                          shorthand: `split: h2` (exactly H2), `split: h1-h3`
 *                          (H1 through H3). Designed for untouched external
 *                          content (e.g. a README) where markers can't be added:
 *                          each section heading starts a new slide. Fence-aware.
 */

/** Slide-break mode, selected via deck frontmatter `slideBreak:` (or `split:`). */
export type SlideBreakMode = 'marker' | 'blank' | 'heading';

/**
 * A raw slide chunk plus its 0-based inclusive line range in the original
 * input. The range powers editor ↔ preview sync (Slide.sourceRange).
 */
export interface RawSlideChunk {
  text: string;
  start: number; // 0-based inclusive line number in original input
  end: number;   // 0-based inclusive line number in original input
}

export interface SlideBreakResult {
  chunks: RawSlideChunk[];
  /**
   * True when at least one bare `---` line acted as a separator between real
   * (non-frontmatter) content. Lets callers emit a deprecation warning without
   * false-firing on legitimate per-slide YAML frontmatter fences.
   */
  usedDeprecatedDelimiter: boolean;
}

/**
 * Canonical slide marker. Matches a whole line that is `<!-- slide -->`,
 * optionally with a trailing free-text label for author readability, e.g.
 * `<!-- slide 10 - home work -->`. The label is decorative and ignored by the
 * parser. `slide` must be a whole word, so `<!-- slides -->` /
 * `<!-- slideshow -->` are NOT slide breaks. Case-insensitive.
 */
const MARKER_RE = /^\s*<!--\s*slide\b[^\n>]*-->\s*$/i;
/** Bare horizontal rule used historically as the slide delimiter. */
const HR_RE = /^---+\s*$/;
/** Opening/closing fence token: three or more backticks or tildes. */
const FENCE_RE = /^\s*(`{3,}|~{3,})/;
/** ATX heading (levels 1–6); capture group 1 is the `#` run for level detection. */
const HEADING_RE = /^(#{1,6})\s+\S/;

function isBlank(line: string): boolean {
  return line.trim().length === 0;
}

/**
 * Normalize a raw frontmatter value into a valid SlideBreakMode.
 * Accepts 'marker' | 'blank' | 'heading' plus heading-level shorthands
 * ('h2', 'h1-h3'); anything else (including undefined) falls back to 'blank'.
 */
export function resolveSlideBreakMode(raw: unknown): SlideBreakMode {
  return resolveSlideBreakConfig(raw).mode;
}

/** Resolved slide-break configuration: the mode plus heading levels. */
export interface SlideBreakConfig {
  mode: SlideBreakMode;
  /**
   * For heading mode: the ATX levels (1–6) whose headings start a new slide.
   * Empty for non-heading modes. Defaults to [1, 2] for the bare `heading`.
   */
  headingLevels: number[];
}

/** Default heading levels for the bare `slideBreak: heading` / `split: heading`. */
const DEFAULT_HEADING_LEVELS = [1, 2];

/**
 * Parse a raw `slideBreak:`/`split:` frontmatter value into a SlideBreakConfig.
 *
 * Accepted forms (case-insensitive):
 *   - 'marker'            → marker mode
 *   - 'blank'             → blank mode (default)
 *   - 'heading'           → heading mode, levels [1, 2]
 *   - 'hN'  (e.g. 'h2')   → heading mode, split at exactly level N
 *   - 'hN-hM' (e.g. 'h1-h3', 'h2-3') → heading mode, levels N..M inclusive
 *   - anything else / undefined → blank mode
 */
export function resolveSlideBreakConfig(raw: unknown): SlideBreakConfig {
  if (typeof raw === 'string') {
    const v = raw.trim().toLowerCase();
    if (v === 'marker') {
      return { mode: 'marker', headingLevels: [] };
    }
    if (v === 'blank') {
      return { mode: 'blank', headingLevels: [] };
    }
    if (v === 'heading') {
      return { mode: 'heading', headingLevels: [...DEFAULT_HEADING_LEVELS] };
    }
    const single = v.match(/^h([1-6])$/);
    if (single) {
      return { mode: 'heading', headingLevels: [Number(single[1])] };
    }
    const range = v.match(/^h([1-6])-h?([1-6])$/);
    if (range) {
      const lo = Math.min(Number(range[1]), Number(range[2]));
      const hi = Math.max(Number(range[1]), Number(range[2]));
      const levels: number[] = [];
      for (let n = lo; n <= hi; n++) {
        levels.push(n);
      }
      return { mode: 'heading', headingLevels: levels };
    }
  }
  return { mode: 'blank', headingLevels: [] };
}

/**
 * Split deck body content into raw slide chunks.
 *
 * @param content Deck body (deck-level frontmatter already stripped).
 * @param mode    Slide-break mode; defaults to 'blank'.
 * @param options Extra options; `headingLevels` selects which ATX levels split
 *                in heading mode (defaults to [1, 2]).
 */
export function resolveSlideBreaks(
  content: string,
  mode: SlideBreakMode = 'blank',
  options: { headingLevels?: number[] } = {},
): SlideBreakResult {
  const headingLevels = new Set(
    options.headingLevels && options.headingLevels.length > 0
      ? options.headingLevels
      : DEFAULT_HEADING_LEVELS,
  );
  const lines = content.split(/\r?\n/);
  const chunks: RawSlideChunk[] = [];
  let segmentStart = 0;
  let usedDeprecatedDelimiter = false;

  // Fenced-code tracking: '' when outside a fence, otherwise the fence char
  // ('`' or '~') that opened the current fence. A fence only closes on a token
  // using the same character, so a ``` block can safely contain ~~~ (and v.v.).
  let fenceChar = '';

  const pushChunk = (endExclusive: number): void => {
    const segLines = lines.slice(segmentStart, endExclusive);
    chunks.push({
      text: segLines.join('\n'),
      start: segmentStart,
      end: Math.max(segmentStart, endExclusive - 1),
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track fenced-code state first — no delimiter inside a fence ever splits.
    const fenceMatch = line.match(FENCE_RE);
    if (fenceMatch) {
      const token = fenceMatch[1][0]; // '`' or '~'
      if (fenceChar === '') {
        fenceChar = token; // opening fence
      } else if (token === fenceChar) {
        fenceChar = ''; // closing fence
      }
      continue;
    }
    if (fenceChar !== '') {
      continue; // inside a fenced code block
    }

    // 1. Canonical marker — always active.
    if (MARKER_RE.test(line)) {
      pushChunk(i);
      segmentStart = i + 1;
      continue;
    }

    // 2. Bare `---` horizontal rule — supported, deprecated as a separator.
    if (HR_RE.test(line)) {
      // Distinguish a real content separator from a per-slide frontmatter
      // fence: only flag as deprecated when the segment being closed is real
      // content (not bare YAML and not empty). Frontmatter fences are silent.
      const segText = lines.slice(segmentStart, i).join('\n');
      if (segText.trim().length > 0 && !looksLikeBareYaml(segText)) {
        usedDeprecatedDelimiter = true;
      }
      pushChunk(i);
      segmentStart = i + 1;
      continue;
    }

    // 3. Blank-line runs (2+) — the default separator in 'blank' mode.
    if (mode === 'blank' && isBlank(line)) {
      let j = i;
      while (j < lines.length && isBlank(lines[j])) {
        j++;
      }
      if (j - i >= 2) {
        // Only split when the next non-blank line is top-level content. A
        // following line indented >=4 spaces (or a tab) belongs to an indented
        // code block or a deeply-nested continuation, so the blank run is
        // in-block whitespace (CommonMark preserves blanks inside code) rather
        // than a slide boundary. Fenced code is already handled above.
        const nextLine = j < lines.length ? lines[j] : '';
        const nextIsTopLevel =
          j >= lines.length || (!/^ {4}/.test(nextLine) && !/^\t/.test(nextLine));
        if (nextIsTopLevel) {
          pushChunk(i);
          segmentStart = j; // consume the blank run as the separator
        }
        i = j - 1; // skip past the blank run regardless of split decision
        continue;
      }
      // A single blank line is an ordinary in-slide paragraph break — leave it
      // to be captured as part of the current segment.
    }

    // 4. Headings — split BEFORE headings of the configured levels in 'heading'
    // mode. The heading line starts the next slide (it is not consumed).
    if (mode === 'heading') {
      const hm = line.match(HEADING_RE);
      if (hm && headingLevels.has(hm[1].length)) {
        if (i > segmentStart) {
          pushChunk(i);
          segmentStart = i;
        }
        // A heading at the very start of a segment simply begins that segment.
        continue;
      }
      // Headings at non-selected levels stay within the current slide.
    }
  }

  // Trailing segment (or the whole input when no delimiter was found).
  pushChunk(lines.length);

  // Drop empty chunks, but preserve the first one to keep historical behavior
  // (an all-empty deck still yields a single slide).
  let filtered = chunks.filter(
    (chunk, index) => index === 0 || chunk.text.trim().length > 0,
  );

  // In blank mode, a leading blank run (common right after frontmatter) would
  // otherwise produce a phantom empty first slide — drop leading empties.
  if (mode === 'blank') {
    while (filtered.length > 1 && filtered[0].text.trim().length === 0) {
      filtered = filtered.slice(1);
    }
  }

  return { chunks: filtered, usedDeprecatedDelimiter };
}

/**
 * Check if raw content looks like bare YAML key-value pairs
 * (no markdown headings, no prose, just "key: value" lines).
 * This detects frontmatter that lost its --- fences during splitting.
 */
export function looksLikeBareYaml(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return false;
  }
  const lines = trimmed.split('\n');
  // Every non-empty line must look like "key: value" or be a YAML continuation
  return lines.every(line => {
    const l = line.trim();
    if (l.length === 0) {
      return true;
    }
    // key: value pattern, or YAML multi-line continuation (indented or starting with |, >)
    return /^[\w][\w.-]*\s*:/.test(l) || /^\s+/.test(line) || /^[|>]/.test(l);
  });
}
