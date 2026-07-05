/**
 * Deck loader — fetches a public `.deck.md` URL (and optional sidecar),
 * then runs it through `@deckpilot/core` parsers to produce a Deck model.
 *
 * The viewer never touches the filesystem; all I/O is HTTP `fetch`. Core's
 * own sidecar/env loaders are bypassed by relying on the fs stub returning
 * ENOENT (so the parser sees "no sidecar present") and merging the sidecar
 * ourselves.
 */

import yaml from 'js-yaml';
import matter from 'gray-matter';
import { parseSlides } from '@deckpilot/core/parser/slideParser';
import { resolveSlideBreakConfig } from '@deckpilot/core/parser/slideBreakResolver';
import {
  mergeSidecarIntoSlides,
  mergeSidecarDeckMetadata,
} from '@deckpilot/core/parser/mergeEngine';
import type { Deck, DeckMetadata } from '@deckpilot/core/models/deck';
import { createDeck } from '@deckpilot/core/models/deck';
import type { Slide } from '@deckpilot/core/models/slide';
import type { SidecarFile } from '@deckpilot/core/models/sidecar';
import { validateDeckUrl, deriveSidecarUrl } from './urlValidator';

export interface LoadedDeck {
  deck: Deck;
  sourceUrl: string;
  sidecarUrl?: string;
  warnings: string[];
}

export class DeckLoadError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'DeckLoadError';
  }
}

const FETCH_TIMEOUT_MS = 15000;

async function fetchText(url: URL, signal?: AbortSignal): Promise<{ text: string; status: number }> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const composite = signal
    ? mergeSignals(signal, controller.signal)
    : controller.signal;
  try {
    const res = await fetch(url.toString(), {
      signal: composite,
      redirect: 'follow',
      credentials: 'omit',
      headers: { Accept: 'text/plain, text/markdown, application/x-yaml, text/yaml, */*' },
    });
    const text = res.ok ? await res.text() : '';
    return { text, status: res.status };
  } finally {
    window.clearTimeout(timer);
  }
}

function mergeSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  const c = new AbortController();
  const onAbort = (): void => c.abort();
  a.addEventListener('abort', onAbort);
  b.addEventListener('abort', onAbort);
  if (a.aborted || b.aborted) c.abort();
  return c.signal;
}

export interface LoadDeckOptions {
  /**
   * Slide-break mode override (from the viewer URL, e.g. `?split=heading`).
   * Takes precedence over the deck's frontmatter `slideBreak:`/`split:`.
   * Accepts 'marker' | 'blank' | 'heading' | 'hN' | 'hN-hM'.
   */
  slideBreak?: string;
}

export async function loadDeckFromUrl(
  rawUrl: string,
  signal?: AbortSignal,
  options?: LoadDeckOptions,
): Promise<LoadedDeck> {
  const validation = validateDeckUrl(rawUrl);
  if (!validation.ok || !validation.url) {
    throw new DeckLoadError(validation.error ?? 'Invalid URL.');
  }
  const deckUrl = validation.url;
  const warnings: string[] = [];

  // 1. Fetch deck markdown
  let deckBody: string;
  try {
    const res = await fetchText(deckUrl, signal);
    if (res.status === 0 || res.text === '' && res.status >= 400) {
      throw new DeckLoadError(`Failed to fetch deck (HTTP ${res.status}).`);
    }
    deckBody = res.text;
  } catch (err) {
    if (err instanceof DeckLoadError) throw err;
    const msg = err instanceof Error ? err.message : 'Unknown fetch error';
    throw new DeckLoadError(`Could not download deck: ${msg}`, err);
  }
  if (!deckBody.trim()) {
    throw new DeckLoadError('Deck file is empty.');
  }

  // 2. Split deck-level frontmatter from body
  const { data: rawMetadata, content: initialBody } = matter(deckBody) as { data: Record<string, unknown>; content: string };
  let metadata = rawMetadata as DeckMetadata;
  let body = initialBody;

  // 2b. If frontmatter declares `content: <url-or-path>`, fetch that file's body.
  //     URL is resolved relative to the deck URL. Imported frontmatter is ignored.
  const importPath = typeof rawMetadata.content === 'string' ? rawMetadata.content.trim() : '';
  if (importPath) {
    try {
      const importUrl = new URL(importPath, deckUrl);
      const res = await fetchText(importUrl, signal);
      if (res.status >= 200 && res.status < 300 && res.text.trim()) {
        const { content: importedBody } = matter(res.text) as { data: Record<string, unknown>; content: string };
        body = importedBody;
      } else {
        warnings.push(`[content] could not import '${importPath}' (HTTP ${res.status})`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      warnings.push(`[content] import failed for '${importPath}': ${msg}`);
    }
  }

  // 3. Parse slides via core (browser-safe — uses gray-matter stub + markdown-it).
  //    Slide-break mode precedence: URL override > deck frontmatter > default.
  const asStr = (v: unknown): string | undefined =>
    typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;
  const breakCfg = resolveSlideBreakConfig(
    options?.slideBreak ?? asStr(rawMetadata.slideBreak) ?? asStr(rawMetadata.split),
  );
  let slides: Slide[];
  try {
    slides = parseSlides(body, { slideBreak: breakCfg.mode, headingLevels: breakCfg.headingLevels });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown parse error';
    throw new DeckLoadError(`Failed to parse deck: ${msg}`, err);
  }
  if (slides.length === 0) {
    throw new DeckLoadError('Deck must contain at least one slide.');
  }

  // 4. Attempt sidecar discovery + merge
  const sidecarUrl = deriveSidecarUrl(deckUrl);
  let sidecarUrlString: string | undefined;
  if (sidecarUrl) {
    try {
      const res = await fetchText(sidecarUrl, signal);
      if (res.status >= 200 && res.status < 300 && res.text.trim()) {
        let parsedSidecar: unknown;
        try {
          parsedSidecar = yaml.load(res.text);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown YAML error';
          warnings.push(`[sidecar] could not parse YAML: ${msg}`);
          parsedSidecar = null;
        }
        if (parsedSidecar && typeof parsedSidecar === 'object') {
          const sidecar = parsedSidecar as SidecarFile;
          slides = mergeSidecarIntoSlides(slides, sidecar);
          metadata = mergeSidecarDeckMetadata(metadata, sidecar);
          sidecarUrlString = sidecarUrl.toString();
        }
      }
      // 404 / non-OK is normal — no sidecar present
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      warnings.push(`[sidecar] fetch failed: ${msg}`);
    }
  }

  // 5. Build Deck DTO via core's `createDeck` so all required fields (state,
  //    currentSlideIndex, etc.) are populated. The viewer identifies decks by URL.
  const deck = createDeck(deckUrl.toString(), slides, metadata);

  return {
    deck,
    sourceUrl: deckUrl.toString(),
    sidecarUrl: sidecarUrlString,
    warnings,
  };
}
