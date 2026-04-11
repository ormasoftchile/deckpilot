/**
 * Slide parser for extracting individual slides from deck content
 * Splits content on `---` delimiter (horizontal rule)
 */

import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';
import { Slide, SlideFrontmatter, createSlide } from '../models/slide';
import { parseActionLinks } from './actionLinkParser';
import { parseActionBlocks } from './actionBlockParser';
import { parseRenderDirectives } from '../renderer';
import { transformLayoutDirectives } from './layoutDirectivePlugin';
import { injectBlockElementsFromParsed } from '../renderer/blockElementRenderer';
import { processFragments } from './fragmentProcessor';
import { extractCheckpoint } from './checkpointParser';

// Initialize markdown-it renderer
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

/**
 * Slide delimiter pattern: --- on its own line
 * Must be at least 3 dashes with optional whitespace
 */
const SLIDE_DELIMITER = /^---+\s*$/m;

/**
 * Accumulated parse warnings from the last parseSlides() call.
 * Reset at the start of each parseSlides() invocation.
 */
let _lastParseWarnings: string[] = [];

/**
 * Get warnings from the most recent parseSlides() call.
 * Returns action block parse errors formatted as human-readable strings.
 */
export function getLastParseWarnings(): string[] {
  return _lastParseWarnings;
}

/**
 * Parse content into individual slides
 */
export function parseSlides(content: string): Slide[] {
  // Reset warnings
  _lastParseWarnings = [];
  
  // Split content on slide delimiter
  const rawSlides = splitOnDelimiter(content);
  
  const slides: Slide[] = [];
  let pendingFrontmatter: SlideFrontmatter | undefined;
  
  for (let index = 0; index < rawSlides.length; index++) {
    const rawContent = rawSlides[index].trim();
    
    // Skip empty slides (but keep first slide even if empty)
    if (!rawContent && index > 0) {
      continue;
    }
    
    const slide = parseSlideContent(index, rawContent);

    // If this "slide" is frontmatter-only (no visible content), hold it
    // and merge into the next slide. This lets authors write:
    //   ---
    //   notes: Speaker notes here
    //   ---
    //   # Actual Slide Content
    if (isFrontmatterOnly(slide)) {
      pendingFrontmatter = mergeFrontmatter(pendingFrontmatter, slide.frontmatter);
      continue;
    }

    // Merge any pending frontmatter from a preceding frontmatter-only block
    if (pendingFrontmatter) {
      slide.frontmatter = mergeFrontmatter(pendingFrontmatter, slide.frontmatter);
      slide.speakerNotes = slide.frontmatter?.notes ?? slide.speakerNotes;
      pendingFrontmatter = undefined;
    }

    // Re-index after filtering
    slide.index = slides.length;
    slides.push(slide);
  }
  
  return slides;
}

/**
 * Split content on --- delimiter
 * Handles edge cases like leading/trailing delimiters
 */
function splitOnDelimiter(content: string): string[] {
  // Split on delimiter lines
  const parts = content.split(SLIDE_DELIMITER);
  
  // Filter out completely empty parts but preserve whitespace-only for processing
  return parts.filter((part, index) => {
    // Always keep first part
    if (index === 0) {
      return true;
    }
    // Keep non-empty parts
    return part.trim().length > 0;
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
  }
  
  // Step 1.5: Extract checkpoint before any rendering
  const { checkpoint, cleanedContent: contentAfterCheckpoint } = extractCheckpoint(content);
  content = contentAfterCheckpoint;

  // Step 1.6: Strip voice-over cue comments — they are for recording mode only
  // and must not appear in the rendered presentation HTML
  content = content.replace(/<!--\s*voice(?:\[\d+\])?:[\s\S]*?-->/gi, '').trim();

  // Step 2: Parse action blocks (NEW — extracts elements + cleans content)
  const actionBlockResult = parseActionBlocks(content, index);
  const cleanedContent = actionBlockResult.cleanedContent;
  
  // Accumulate action block parse errors as warnings (non-fatal)
  for (const err of actionBlockResult.errors) {
    _lastParseWarnings.push(
      `Slide ${index + 1}, line ${err.line}: ${err.message}`
    );
  }
  
  // Step 3: Render markdown to HTML (uses cleaned content — no action blocks in output)
  const layoutTransformed = transformLayoutDirectives(cleanedContent);
  let html = md.render(layoutTransformed);
  
  // Step 4: Inject block element buttons into HTML (replaces <!--ACTION:--> placeholders)
  // This must happen BEFORE fragment processing so that action buttons with
  // `fragment: true` get fragment indices in document order alongside other
  // fragment-marked elements.
  html = injectBlockElementsFromParsed(html, actionBlockResult.elements);
  
  // Step 5: Process fragments and get count
  const { html: fragmentHtml, fragmentCount } = processFragments(html);
  html = fragmentHtml;
  
  // Create base slide
  const slide = createSlide(index, content, html, frontmatter, checkpoint);
  slide.fragmentCount = fragmentCount;
  
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
  
  return slide;
}

/**
 * Render markdown content to HTML
 */
export function renderMarkdown(content: string): string {
  return md.render(content);
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
 * Merge two frontmatter objects, with `override` taking precedence.
 */
function mergeFrontmatter(
  base: SlideFrontmatter | undefined,
  override: SlideFrontmatter | undefined,
): SlideFrontmatter | undefined {
  if (!base && !override) {
    return undefined;
  }
  return { ...base, ...override };
}
