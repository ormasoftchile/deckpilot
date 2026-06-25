/**
 * Slide parser for extracting individual slides from deck content
 * Splits content on `---` delimiter (horizontal rule)
 */

import { matter } from './frontmatter';
import MarkdownIt from 'markdown-it';
import { Slide, SlideFrontmatter, createSlide } from '../models/slide';
import { parseActionLinks } from './actionLinkParser';
import { parseActionBlocks } from './actionBlockParser';
import { parseDiagramBlocks } from './diagramBlockParser';
import { parseRenderDirectives } from '../renderer';
import { processLayoutComments } from './layoutCommentProcessor';
import { injectBlockElementsFromParsed } from '../renderer/blockElementRenderer';
import { injectDiagramPlaceholders } from '../renderer/diagramPlaceholderRenderer';
import { processFragments } from './fragmentProcessor';
import { extractCheckpoint } from './checkpointParser';
import { extractIdComment, generateSlideId, resolveUniqueIds } from './slideIdParser';
import { validateSlideIds, SlideDiagnosticResult } from './deckValidator';

// Initialize markdown-it renderer
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

/**
 * Accumulated parse warnings from the last parseSlides() call.
 * Reset at the start of each parseSlides() invocation.
 */
let _lastParseWarnings: string[] = [];

/**
 * Validation diagnostics (duplicate explicit IDs) from the last parseSlides() call.
 * Reset at the start of each parseSlides() invocation.
 */
let _lastValidationDiagnostics: SlideDiagnosticResult[] = [];

/**
 * Get warnings from the most recent parseSlides() call.
 * Returns action block parse errors formatted as human-readable strings.
 */
export function getLastParseWarnings(): string[] {
  return _lastParseWarnings;
}

/**
 * Get validation diagnostics (e.g. duplicate explicit slide IDs) from the
 * most recent parseSlides() call.  Results can be forwarded to VS Code's
 * DiagnosticCollection by mapping them to vscode.Diagnostic in extension.ts.
 */
export function getLastValidationDiagnostics(): SlideDiagnosticResult[] {
  return _lastValidationDiagnostics;
}

/**
 * Parse content into individual slides
 */
export function parseSlides(content: string): Slide[] {
  // Reset warnings and validation diagnostics
  _lastParseWarnings = [];
  _lastValidationDiagnostics = [];
  
  // Split content on slide delimiter (with line range tracking for sync)
  const rawSlides = splitOnDelimiter(content);
  
  const slides: Slide[] = [];
  let pendingFrontmatter: SlideFrontmatter | undefined;
  let pendingRangeStart: number | undefined;
  
  for (let index = 0; index < rawSlides.length; index++) {
    const { text: rawText, start: rangeStart, end: rangeEnd } = rawSlides[index];
    const rawContent = rawText.trim();
    
    // Skip empty slides (but keep first slide even if empty)
    if (!rawContent && index > 0) {
      continue;
    }
    
    const slide = parseSlideContent(index, rawContent);
    slide.sourceRange = { start: rangeStart, end: rangeEnd };

    // If this "slide" is frontmatter-only (no visible content), hold it
    // and merge into the next slide. This lets authors write:
    //   ---
    //   notes: Speaker notes here
    //   ---
    //   # Actual Slide Content
    if (isFrontmatterOnly(slide)) {
      pendingFrontmatter = mergeFrontmatter(pendingFrontmatter, slide.frontmatter);
      if (pendingRangeStart === undefined) {
        pendingRangeStart = rangeStart;
      }
      continue;
    }

    // Merge any pending frontmatter from a preceding frontmatter-only block
    if (pendingFrontmatter) {
      slide.frontmatter = mergeFrontmatter(pendingFrontmatter, slide.frontmatter);
      slide.speakerNotes = slide.frontmatter?.notes ?? slide.speakerNotes;
      pendingFrontmatter = undefined;
    }
    if (pendingRangeStart !== undefined && slide.sourceRange) {
      slide.sourceRange = { start: pendingRangeStart, end: slide.sourceRange.end };
      pendingRangeStart = undefined;
    }

    // Re-index after filtering
    slide.index = slides.length;
    slides.push(slide);
  }

  // Assign IDs for slides that had no <!-- id: --> comment (priorities 2-4).
  // Done here so pending-frontmatter merging above is already reflected.
  for (const slide of slides) {
    if (slide.id === undefined) {
      const fmId = slide.frontmatter?.id;
      slide.id = generateSlideId(slide.content, slide.frontmatter, slide.index);
      // Mark as explicit if the frontmatter id field drove the result
      if (typeof fmId === 'string' && fmId.trim().length > 0) {
        slide.idExplicit = true;
      }
    }
  }

  // Validate for duplicate explicit IDs before uniquification renames them.
  // Results are stored so callers can surface them as editor diagnostics.
  _lastValidationDiagnostics = validateSlideIds(slides);

  // Ensure all IDs are unique within this deck
  resolveUniqueIds(slides);
  
  return slides;
}

/**
 * Split content on --- delimiter, tracking source line ranges.
 * Returns each chunk's text plus its 0-based [start, end] inclusive line
 * range in the original input. Used by parseSlides() to populate
 * Slide.sourceRange for editor ↔ preview sync.
 */
interface RawSlideChunk {
  text: string;
  start: number; // 0-based inclusive line number in original input
  end: number;   // 0-based inclusive line number in original input
}

function splitOnDelimiter(content: string): RawSlideChunk[] {
  const lines = content.split(/\r?\n/);
  const delimiterRe = /^---+\s*$/;
  const chunks: RawSlideChunk[] = [];
  let segmentStart = 0;
  for (let i = 0; i < lines.length; i++) {
    if (delimiterRe.test(lines[i])) {
      const segLines = lines.slice(segmentStart, i);
      chunks.push({
        text: segLines.join('\n'),
        start: segmentStart,
        end: Math.max(segmentStart, i - 1),
      });
      segmentStart = i + 1;
    }
  }
  // Trailing segment after last delimiter (or whole input if no delimiters)
  const tailLines = lines.slice(segmentStart);
  chunks.push({
    text: tailLines.join('\n'),
    start: segmentStart,
    end: Math.max(segmentStart, lines.length - 1),
  });

  // Filter out completely empty parts (but keep first chunk even when empty
  // to preserve historical behavior).
  return chunks.filter((chunk, index) => {
    if (index === 0) {
      return true;
    }
    return chunk.text.trim().length > 0;
  });
}

/**
 * Parse individual slide content including frontmatter
 */
function parseSlideContent(index: number, rawContent: string): Slide {
  let content = rawContent;
  let frontmatter: SlideFrontmatter | undefined;
  
  // Step 1: Check if slide starts with frontmatter (---)
  if (rawContent.startsWith('---')) {
    try {
      const parsed = matter(rawContent);
      frontmatter = parsed.data as SlideFrontmatter;
      content = parsed.content.trim();
    } catch {
      // If frontmatter parsing fails, use raw content
      content = rawContent;
    }
  } else if (looksLikeBareYaml(rawContent)) {
    // Handle bare YAML between --- delimiters (e.g. "notes: some text")
    // This happens when authors write:
    //   ---
    //   notes: Speaker notes here
    //   ---
    // The --- delimiters get consumed by splitOnDelimiter, leaving just
    // the YAML content without fences.
    try {
      const parsed = matter(`---\n${rawContent}\n---`);
      if (parsed.data && Object.keys(parsed.data).length > 0) {
        frontmatter = parsed.data as SlideFrontmatter;
        content = parsed.content.trim();
      }
    } catch {
      // Not valid YAML — treat as regular content
    }
  } else {
    // Step 1b: Handle the common LLM-generated pattern where a notes: line
    // appears at the start of slide content WITHOUT a closing --- fence.
    // Example (LLM output):
    //   notes: Speaker reminder text
    //
    //   <!-- voice: ... -->
    //   # Slide Title
    // The notes value is extracted and stripped; the rest becomes slide content.
    const extracted = extractLeadingNotesLine(rawContent);
    if (extracted.notes !== undefined) {
      frontmatter = { notes: extracted.notes };
      content = extracted.rest;
    }
  }
  
  // Step 1.5: Extract checkpoint before any rendering
  const { checkpoint, cleanedContent: contentAfterCheckpoint } = extractCheckpoint(content);
  content = contentAfterCheckpoint;

  // Step 1.55: Strip any <!-- id: xxx --> comment from content before rendering.
  // The id value is stored immediately; heading/frontmatter fallbacks run in
  // parseSlides after pending-frontmatter merging.
  const { commentId, cleanedContent: contentAfterId } = extractIdComment(content);
  content = contentAfterId;
  if (commentId !== undefined) {
    // Assign now; parseSlides won't overwrite an already-set id.
    // (stored as a local; set on slide after createSlide below)
  }

  // Step 1.6: Extract voice-over cues BEFORE stripping them, so parseCues()
  // can still find them after slide.content no longer contains the comments.
  const voiceCues = extractVoiceCues(content);

  // Replace fragment voice cues (voice[N]) with position markers so we can
  // resolve the actual data-fragment index each cue precedes after rendering.
  // Slide-level cues (no [N]) are stripped immediately.
  // Markers are numbered in source order: <!-- __vcm-0 -->, <!-- __vcm-1 -->, ...
  const fragmentCueVcIndices: number[] = []; // marker index → voiceCues array index
  let vcmCount = 0;
  let nonEmptyMatchCursor = 0;
  content = content.replace(
    /<!--\s*voice(?:\[(\d+)\])?:\s*([\s\S]*?)\s*-->/gi,
    (_, nStr, text) => {
      if ((text as string).trim().length === 0) {
        return ''; // empty cue — just strip
      }
      const cueIdx = nonEmptyMatchCursor++;
      if (nStr !== undefined) {
        // Fragment cue — insert position marker; resolve data-fragment after rendering
        fragmentCueVcIndices.push(cueIdx);
        return `<!-- __vcm-${vcmCount++} -->`;
      }
      // Slide-level cue — strip
      return '';
    },
  );
  content = content.trim();

  // Step 2: Parse action blocks (extracts elements + cleans content)
  const actionBlockResult = parseActionBlocks(content, index);
  const cleanedContent = actionBlockResult.cleanedContent;
  
  // Accumulate action block parse errors as warnings (non-fatal)
  for (const err of actionBlockResult.errors) {
    _lastParseWarnings.push(
      `Slide ${index + 1}, line ${err.line}: ${err.message}`
    );
  }

  // Step 2b: Parse diagram blocks (extracts blocks + cleans content)
  const diagramBlockResult = parseDiagramBlocks(cleanedContent, index);
  console.log(`[DECK-DIAGRAM][slideParser] slide ${index} diagramBlocks:`, diagramBlockResult.blocks.length);
  const contentForRender = diagramBlockResult.cleanedContent;

  // Step 3: Render markdown to HTML (uses cleaned content — no action blocks or diagram fences)
  let html = md.render(contentForRender);
  
  // Step 4: Inject block element buttons into HTML (replaces <!--ACTION:--> placeholders)
  html = injectBlockElementsFromParsed(html, actionBlockResult.elements);

  // Step 4b: Inject diagram loading placeholders (replaces <!--DIAGRAM:--> markers)
  html = injectDiagramPlaceholders(html, diagramBlockResult.blocks);

  // Step 4.5: Convert <!-- layout --> comment markers to HTML wrapper divs.
  // Must run after markdown-it rendering (so comments are in the HTML string)
  // but before fragment processing (so slide-group/details/step-optional are
  // present when processFragments scans for eligible elements).
  html = processLayoutComments(html);
  
  // Step 5: Process fragments and get count
  const { html: fragmentHtml, fragmentCount } = processFragments(html);
  html = fragmentHtml;

  // Resolve each fragment-cue position marker to the data-fragment index of
  // the nearest following fragment in the rendered HTML.  This corrects the
  // fragmentIndex stored in voiceCues from the literal [N] ordinal (which the
  // author wrote) to the actual data-fragment index (which may be higher when
  // there are intro paragraphs or other fragments before the annotated element).
  for (let mi = 0; mi < fragmentCueVcIndices.length; mi++) {
    const marker = `<!-- __vcm-${mi} -->`;
    const markerPos = html.indexOf(marker);
    if (markerPos !== -1) {
      const afterMarker = html.slice(markerPos + marker.length);
      const fragMatch = afterMarker.match(/data-fragment="(\d+)"/);
      if (fragMatch) {
        voiceCues[fragmentCueVcIndices[mi]].fragmentIndex = parseInt(fragMatch[1], 10);
      }
    }
  }
  // Strip position markers — they must not appear in the final slide HTML
  html = html.replace(/<!--\s*__vcm-\d+\s*-->/g, '');
  
  // Create base slide
  const slide = createSlide(index, content, html, frontmatter, checkpoint);
  // Set id from comment if found (prevents parseSlides from overwriting it)
  if (commentId !== undefined) {
    slide.id = commentId;
    slide.idExplicit = true;
  }
  slide.fragmentCount = fragmentCount;
  if (voiceCues.length > 0) {
    slide.voiceCues = voiceCues;
  }
  
  // Step 6: Parse interactive action links from original content (inline links still parsed)
  const inlineElements = parseActionLinks(content, index);
  
  // Step 7: Merge block elements and inline elements into interactiveElements
  slide.interactiveElements = [...actionBlockResult.elements, ...inlineElements];
  
  // Parse render directives from content
  const directives = parseRenderDirectives(content, index);
  slide.renderDirectives = directives.map(d => ({
    id: d.id,
    type: d.type,
    rawDirective: d.rawDirective,
    position: d.position,
  }));

  // Store diagram blocks parsed in Step 2b
  if (diagramBlockResult.blocks.length > 0) {
    slide.diagramBlocks = diagramBlockResult.blocks;
  }
  
  return slide;
}

/**
 * Render markdown content to HTML
 */
export function renderMarkdown(content: string): string {
  return md.render(content);
}

/**
 * Extract voice-over cues from raw slide content before they are stripped.
 * Returns minimal objects — slideIndex is assigned by the caller (parseCues).
 */
function extractVoiceCues(
  content: string,
): Array<{ fragmentIndex?: number; text: string }> {
  const cues: Array<{ fragmentIndex?: number; text: string }> = [];
  const regex = /<!--\s*voice(?:\[(\d+)\])?:\s*([\s\S]*?)\s*-->/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const text = match[2].trim();
    if (text.length > 0) {
      const cue: { fragmentIndex?: number; text: string } = { text };
      if (match[1] !== undefined) {
        cue.fragmentIndex = parseInt(match[1], 10);
      }
      cues.push(cue);
    }
  }
  return cues;
}

/**
 * Check if a parsed slide has only frontmatter and no visible content.
 * These blocks should be merged into the next slide.
 */
function isFrontmatterOnly(slide: Slide): boolean {
  // Has frontmatter but no meaningful content, HTML, or interactive elements
  if (!slide.frontmatter) {
    return false;
  }
  const hasContent = slide.content.trim().length > 0;
  const hasElements = slide.interactiveElements.length > 0;
  const hasDirectives = slide.renderDirectives.length > 0;
  return !hasContent && !hasElements && !hasDirectives;
}

/**
 * Check if raw content looks like bare YAML key-value pairs
 * (no markdown headings, no prose, just "key: value" lines).
 * This detects frontmatter that lost its --- fences during splitting.
 */
function looksLikeBareYaml(raw: string): boolean {
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

/**
 * Extract a leading `notes: <value>` line from raw slide content.
 * Handles the common LLM error where a notes block is generated without
 * a closing --- fence, so the notes text lands in the slide body.
 * Returns { notes, rest } if the very first non-empty line is `notes: …`
 * followed (after optional blank lines) by markdown content.
 * Returns { rest: raw } unchanged if the pattern is not found.
 */
function extractLeadingNotesLine(raw: string): { notes?: string; rest: string } {
  const trimmed = raw.trimStart();
  const firstLineMatch = trimmed.match(/^notes:\s*(.+?)(\r?\n|$)/);
  if (!firstLineMatch) {
    return { rest: raw };
  }
  const notesValue = firstLineMatch[1].trim();
  // Everything after the notes line
  const afterNotesLine = trimmed.slice(firstLineMatch[0].length);
  // Only treat as a notes extraction if there is actual slide content after it
  // (otherwise looksLikeBareYaml would have caught the pure-YAML case already)
  if (afterNotesLine.trim().length === 0) {
    return { rest: raw };
  }
  return { notes: notesValue, rest: afterNotesLine.trimStart() };
}


function mergeFrontmatter(
  base: SlideFrontmatter | undefined,
  override: SlideFrontmatter | undefined,
): SlideFrontmatter | undefined {
  if (!base && !override) {
    return undefined;
  }
  return { ...base, ...override };
}
