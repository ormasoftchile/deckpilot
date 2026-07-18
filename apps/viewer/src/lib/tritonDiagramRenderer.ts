import { compileAndRenderSync } from '@cristianormazabal/triton-core';
import type { Deck } from '@deckpilot/core/models/deck';
import type { DiagramBlockRef } from '@deckpilot/core/models/diagram';
import type { Slide } from '@deckpilot/core/models/slide';
import { sanitizeSlideHtml } from './sanitize';

const TRITON_THEME_PRESETS = new Set([
  'default',
  'executive',
  'minimal',
  'consulting',
  'product',
  'release',
  'ai-timeline',
  'bytebytego',
  'gitline',
  'our-timeline',
  'subject-timeline',
  'showcase',
]);

const LOADING_BLOCK_PATTERN =
  /<figure\b([^>]*\bclass="[^"]*\bdiagram-block--loading\b[^"]*"[^>]*)>([\s\S]*?)<\/figure>/g;
const BARE_TRITON_CODE_PATTERN =
  /<pre><code class="language-triton">([\s\S]*?)<\/code><\/pre>/g;

export async function renderSlideDiagrams(html: string, slide: Slide, deck: Deck): Promise<string> {
  let renderedHtml = await renderDiagramPlaceholders(html, slide, deck);
  renderedHtml = renderBareTritonBlocks(renderedHtml, deck);
  return sanitizeSlideHtml(renderedHtml);
}

async function renderDiagramPlaceholders(html: string, slide: Slide, deck: Deck): Promise<string> {
  const blocksById = new Map((slide.diagramBlocks ?? []).map((block) => [block.id, block]));
  const replacements = await Promise.all(
    Array.from(html.matchAll(LOADING_BLOCK_PATTERN), async (match) => {
      const fullMatch = match[0];
      const attrs = match[1] ?? '';
      const id = readAttr(attrs, 'data-render-id');
      const block = id ? blocksById.get(id) : undefined;
      if (!block) {
        return { fullMatch, html: fullMatch };
      }
      return { fullMatch, html: renderBlock(block, deck, attrs) };
    }),
  );

  let result = html;
  for (const replacement of replacements) {
    result = result.replace(replacement.fullMatch, replacement.html);
  }
  return result;
}

function renderBareTritonBlocks(html: string, deck: Deck): string {
  return html.replace(BARE_TRITON_CODE_PATTERN, (_match, encodedSource: string) => {
    const source = decodeHtml(encodedSource);
    const block: DiagramBlockRef = {
      id: `bare-triton-${hashSource(source)}`,
      slideIndex: 0,
      source,
      fence: { language: 'triton' },
      position: { start: 0, end: source.length },
    };
    return renderBlock(block, deck);
  });
}

function renderBlock(block: DiagramBlockRef, deck: Deck, placeholderAttrs = ''): string {
  const language = block.fence.language.trim().toLowerCase();
  if (language !== 'triton' && language !== 'mermaid') {
    return buildErrorHtml(block, `No browser renderer is registered for diagram:${language}.`);
  }

  let result: ReturnType<typeof compileAndRenderSync>;
  try {
    const theme = resolveTritonTheme(resolveDiagramTheme(block, deck));
    result = compileAndRenderSync(block.source, undefined, 'svg', theme);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return buildErrorHtml(block, message);
  }

  if (!result.ok) {
    return buildErrorHtml(block, result.error.message);
  }

  const svg = stripBackgroundRect(result.value.svg);
  const revealAttr = result.value.reveal
    ? ` data-triton-reveal="${escapeAttr(JSON.stringify(result.value.reveal))}"`
    : '';

  const caption = block.fence.attributes?.caption?.trim();
  const captionHtml = caption
    ? `<figcaption class="diagram-block__caption">${escapeHtml(caption)}</figcaption>`
    : '';

  return `<figure ${buildFigureAttrs(block, language, placeholderAttrs)} data-diagram-renderer="triton"${revealAttr}><div class="diagram-block__viewport">${svg}</div>${captionHtml}</figure>`;
}

function resolveDiagramTheme(block: DiagramBlockRef, deck: Deck): string | undefined {
  const fenceTheme = block.fence.attributes?.theme?.trim();
  if (fenceTheme && fenceTheme !== 'auto') {
    return fenceTheme;
  }

  const deckTheme = deck.metadata.diagrams?.theme?.trim();
  if (deckTheme && deckTheme !== 'auto') {
    return deckTheme;
  }

  const presentationTheme = deck.metadata?.theme?.toString().trim();
  return presentationTheme || 'dark';
}

function resolveTritonTheme(theme?: string): string {
  if (!theme || theme === 'auto') {
    return 'executive';
  }

  if (TRITON_THEME_PRESETS.has(theme)) {
    return theme;
  }

  switch (theme) {
    case 'dark': return 'executive';
    case 'light': return 'default';
    case 'contrast': return 'showcase';
    case 'blueprint': return 'consulting';
    case 'editorial': return 'minimal';
    default: return 'executive';
  }
}

function stripBackgroundRect(svg: string): string {
  const viewBoxMatch = svg.match(/viewBox="([^"]+)"/);
  if (!viewBoxMatch) {
    return svg;
  }

  const parts = viewBoxMatch[1].trim().split(/\s+/);
  if (parts.length !== 4) {
    return svg;
  }

  const [x, y, width, height] = parts.map(escapeRegExp);
  const bgRectPattern = new RegExp(
    `\\s*<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="[^"]*"\\s*/>`,
  );

  return svg.replace(bgRectPattern, '');
}

function buildErrorHtml(block: DiagramBlockRef, message: string): string {
  return `<figure class="diagram-block diagram-block--error" data-render-id="${escapeAttr(block.id)}"><div class="diagram-block__error-header">⚠ Diagram failed to render</div><pre class="diagram-block__error-message">${escapeHtml(message)}</pre><details class="diagram-block__source"><summary>Show source</summary><pre><code class="language-${escapeAttr(block.fence.language)}">${escapeHtml(block.source)}</code></pre></details></figure>`;
}

function buildDiagramClasses(language: string): string {
  const suffix = language.replace(/[^a-z0-9_-]+/g, '-');
  return suffix ? `diagram-block diagram-block--${suffix}` : 'diagram-block';
}

function buildFigureAttrs(block: DiagramBlockRef, language: string, placeholderAttrs: string): string {
  const preserved = new Map<string, string>();
  for (const name of ['data-fragment', 'data-fragment-index', 'data-fragment-animation']) {
    const value = readAttr(placeholderAttrs, name);
    if (value) {
      preserved.set(name, value);
    }
  }

  const existingClasses = (readAttr(placeholderAttrs, 'class') ?? '')
    .split(/\s+/)
    .filter((name) => name && name !== 'diagram-block--loading');
  const classes = new Set([...existingClasses, ...buildDiagramClasses(language).split(/\s+/)]);
  preserved.set('class', Array.from(classes).join(' '));
  preserved.set('data-render-id', block.id);
  preserved.set('data-diagram-language', language);

  return Array.from(preserved.entries())
    .map(([name, value]) => `${name}="${escapeAttr(value)}"`)
    .join(' ');
}

function readAttr(attrs: string, name: string): string | undefined {
  const match = attrs.match(new RegExp(`${name}="([^"]*)"`, 'i'));
  return match?.[1];
}

function decodeHtml(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, '\'')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/'/g, '&#039;');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hashSource(source: string): string {
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}
