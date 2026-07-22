import type { Deck } from '@deckpilot/core/models/deck';
import { rewriteActionLinks } from './actionRenderer';
import { sanitizeSlideHtml, unfragmentLeadingBlock } from './sanitize';

/**
 * A single slide, transformed from `@deckpilot/core` into display-ready HTML
 * plus the presenter metadata the chrome needs (title, notes, voice cues).
 */
export interface RenderedSlide {
  index: number;
  title: string;
  html: string;
  notes: string;
  voiceCues: string[];
}

/**
 * Pure transform: `Deck` → display-ready slides. No React, no DOM side effects
 * beyond the `DOMParser` parse inside `unfragmentLeadingBlock` (which is a
 * detached document). Diagram placeholders are left as-is here; they are
 * resolved asynchronously by `renderSlideDiagrams` inside `DeckPreview`.
 */
export function buildSlides(deck: Deck): RenderedSlide[] {
  return deck.slides.map((slide) => {
    const transformed = rewriteActionLinks(slide.html ?? '');
    // Un-fragment the leading block so the slide's title/first block is visible
    // on entry (core auto-fragments every block; Reveal hides fragments until
    // stepped). Every other block keeps its fragment markup for step-through.
    const safe = unfragmentLeadingBlock(sanitizeSlideHtml(transformed));
    const title =
      slide.frontmatter?.title?.toString().trim() ||
      extractFirstHeading(slide.content) ||
      `Slide ${slide.index + 1}`;
    const voiceCues = (slide.voiceCues ?? []).map((c) => c.text).filter(Boolean);
    return {
      index: slide.index,
      title,
      html: safe,
      notes: slide.speakerNotes ?? '',
      voiceCues,
    };
  });
}

function extractFirstHeading(content: string): string | null {
  const m = content.match(/^\s*#{1,6}\s+(.+?)\s*$/m);
  return m ? m[1].trim() : null;
}
