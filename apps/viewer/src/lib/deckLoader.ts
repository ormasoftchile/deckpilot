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

/**
 * A slide is "visible" when it has any raw content (ignoring HTML comments),
 * any rendered text, or at least one diagram block. Purely-empty chunks are
 * dropped so the viewer never opens on a blank slide.
 */
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

/**
 * Bug A: in `heading` split mode (the viewer's default) core keeps the empty
 * leading chunk formed by the blank line between the deck frontmatter fence and
 * the first heading, so the viewer opens on a completely empty `section`.
 *
 * Drop every content-less slide (empty content + empty HTML + no diagram
 * blocks) and re-index the survivors contiguously, so Reveal DOM order and
 * `#slide=N` deep links stay aligned. Core split behavior is untouched (the VS
 * Code extension is unaffected). If every slide were empty we keep the original
 * list so `createDeck` still gets at least one slide.
 */
function dropEmptyLeadingSlides(slides: Slide[]): Slide[] {
  const visible = slides.filter(slideHasVisibleContent);
  if (visible.length === 0 || visible.length === slides.length) return slides;
  return visible.map((slide, i) => ({ ...slide, index: i }));
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
  const deck = createDeck(deckUrl.toString(), dropEmptyLeadingSlides(slides), metadata);

  return {
    deck,
    sourceUrl: deckUrl.toString(),
    sidecarUrl: sidecarUrlString,
    warnings,
  };
}

/**
 * Standalone Mermaid (`.mmd`) file loaded for the dedicated diagram view.
 */
export interface LoadedMermaid {
  sourceUrl: string;
  source: string;
}

const MERMAID_KEYWORDS = [
  'flowchart', 'graph', 'sequenceDiagram', 'classDiagram', 'stateDiagram', 'stateDiagram-v2',
  'erDiagram', 'gantt', 'journey', 'mindmap', 'timeline', 'gitGraph', 'pie', 'quadrantChart',
  'requirementDiagram', 'c4context', 'c4container', 'c4component', 'sankey-beta', 'xychart-beta',
  'block-beta', 'packet-beta', 'architecture-beta', 'kanban', 'radar-beta', 'treemap',
];

/**
 * True when the URL's path ends in `.mmd`/`.mermaid` (case-insensitive). This
 * is the primary signal for routing to the diagram view instead of the deck
 * pipeline.
 */
export function isMermaidUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl, window.location.href);
    return /\.(mmd|mermaid)$/i.test(u.pathname);
  } catch {
    return /\.(mmd|mermaid)(?:$|[?#])/i.test(rawUrl);
  }
}

/**
 * Content-sniff fallback for extensionless sources (raw/gist URLs): the first
 * non-empty, non-`%%comment` line starts with a Mermaid diagram keyword.
 */
export function looksLikeMermaid(text: string): boolean {
  const firstLine = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !l.startsWith('%%'));
  if (!firstLine) return false;
  const head = firstLine.toLowerCase();
  return MERMAID_KEYWORDS.some((kw) => {
    const k = kw.toLowerCase();
    return head === k || head.startsWith(`${k} `) || head.startsWith(`${k}\t`) || head.startsWith(`${k};`);
  });
}

/**
 * Fetch a standalone `.mmd` file's raw text (validated + CORS-safe, same
 * transport as decks). The diagram view renders it via Triton.
 */
export async function loadMermaidFromUrl(rawUrl: string, signal?: AbortSignal): Promise<LoadedMermaid> {
  const validation = validateDeckUrl(rawUrl);
  if (!validation.ok || !validation.url) {
    throw new DeckLoadError(validation.error ?? 'Invalid URL.');
  }
  const url = validation.url;
  let text: string;
  try {
    const res = await fetchText(url, signal);
    if (res.status === 0 || (res.text === '' && res.status >= 400)) {
      throw new DeckLoadError(`Failed to fetch diagram (HTTP ${res.status}).`);
    }
    text = res.text;
  } catch (err) {
    if (err instanceof DeckLoadError) throw err;
    const msg = err instanceof Error ? err.message : 'Unknown fetch error';
    throw new DeckLoadError(`Could not download diagram: ${msg}`, err);
  }
  if (!text.trim()) {
    throw new DeckLoadError('Diagram file is empty.');
  }
  return { sourceUrl: url.toString(), source: text };
}
