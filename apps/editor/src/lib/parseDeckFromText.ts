/**
 * parseDeckFromText — turns raw editor text into a `LoadedDeck`, reusing the
 * SAME `@deckpilot/core` parsers the viewer's `deckLoader` uses. This is the
 * live-preview counterpart to `loadDeckFromUrl`, minus all HTTP/sidecar I/O.
 *
 * Steps mirror deckLoader §2/§3/§5 verbatim:
 *   1. `matter(text)` — split deck-level frontmatter from body.
 *   2. `resolveSlideBreakConfig` — frontmatter `slideBreak:`/`split:` precedence.
 *   3. `parseSlides` — core slide splitter + markdown-it render.
 *   4. `dropEmptyLeadingSlides` — same fix the viewer applies so heading mode
 *      never opens on a blank leading section (replicated locally; core is
 *      untouched).
 *   5. `createDeck` — build the Deck DTO with all required fields populated.
 *
 * The result is shaped exactly like `LoadedDeck` so it can be handed straight
 * to the imported viewer `<DeckViewer>`.
 */
import matter from 'gray-matter';
import { parseSlides } from '@deckpilot/core/parser/slideParser';
import { resolveSlideBreakConfig } from '@deckpilot/core/parser/slideBreakResolver';
import { createDeck } from '@deckpilot/core/models/deck';
import type { DeckMetadata } from '@deckpilot/core/models/deck';
import type { Slide } from '@deckpilot/core/models/slide';
import type { LoadedDeck } from '@viewer/lib/deckLoader';

const LIVE_SOURCE_URL = 'editor://live';

/** Mirror of deckLoader.slideHasVisibleContent (kept local; core untouched). */
function slideHasVisibleContent(slide: Slide): boolean {
  const rawText = (slide.content ?? '').replace(/<!--[\s\S]*?-->/g, '').trim();
  if (rawText.length > 0) return true;
  const htmlText = (slide.html ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
  if (htmlText.length > 0) return true;
  return (slide.diagramBlocks?.length ?? 0) > 0;
}

/** Mirror of deckLoader.dropEmptyLeadingSlides (kept local; core untouched). */
function dropEmptyLeadingSlides(slides: Slide[]): Slide[] {
  const visible = slides.filter(slideHasVisibleContent);
  if (visible.length === 0 || visible.length === slides.length) return slides;
  return visible.map((slide, i) => ({ ...slide, index: i }));
}

const asStr = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;

export class DeckParseError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'DeckParseError';
  }
}

/**
 * Parse editor text into a `LoadedDeck`. Throws `DeckParseError` on empty or
 * unparseable input so the caller can render an inline message instead of an
 * empty deck.
 */
export function parseDeckFromText(text: string): LoadedDeck {
  if (!text.trim()) {
    throw new DeckParseError('Deck is empty — start typing to see a preview.');
  }

  const { data: rawMetadata, content: body } = matter(text) as {
    data: Record<string, unknown>;
    content: string;
  };
  const metadata = rawMetadata as DeckMetadata;

  const breakCfg = resolveSlideBreakConfig(
    asStr(rawMetadata.slideBreak) ?? asStr(rawMetadata.split),
  );

  let slides: Slide[];
  try {
    slides = parseSlides(body, {
      slideBreak: breakCfg.mode,
      headingLevels: breakCfg.headingLevels,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown parse error';
    throw new DeckParseError(`Failed to parse deck: ${msg}`, err);
  }

  if (slides.length === 0) {
    throw new DeckParseError('Deck must contain at least one slide.');
  }

  const deck = createDeck(LIVE_SOURCE_URL, dropEmptyLeadingSlides(slides), metadata);

  return {
    deck,
    sourceUrl: LIVE_SOURCE_URL,
    warnings: [],
  };
}
