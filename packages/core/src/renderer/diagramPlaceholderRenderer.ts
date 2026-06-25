/**
 * Injects loading-state placeholder HTML for diagram blocks.
 *
 * The parser emits <!--DIAGRAM:id--> markers wherever diagram fences appeared.
 * After markdown-it renders the slide HTML (preserving those comments),
 * this function replaces each marker with a <figure> loading shell that:
 *   - is identified by data-render-id for async replacement
 *   - preserves the source as a <pre><code> fallback
 *   - remains immediately visible while the async renderer resolves
 */

import type { DiagramBlockRef } from '../models/diagram';

/**
 * Replace <!--DIAGRAM:id--> markers in rendered HTML with diagram loading placeholders.
 * Unmatched markers are silently removed.
 */
export function injectDiagramPlaceholders(html: string, blocks: DiagramBlockRef[]): string {
  if (blocks.length === 0) {
    return html;
  }

  const blockMap = new Map<string, DiagramBlockRef>();
  for (const block of blocks) {
    blockMap.set(block.id, block);
  }

  return html.replace(/<!--DIAGRAM:(diagram-\d+-\d+)-->/g, (_match, id: string) => {
    const block = blockMap.get(id);
    if (!block) {
      return '';
    }
    return buildLoadingPlaceholder(block);
  });
}

function buildLoadingPlaceholder(block: DiagramBlockRef): string {
  const lang = escapeAttr(block.fence.language);
  const sourceEscaped = escapeHtml(block.source);

  return (
    `<figure class="diagram-block diagram-block--loading" ` +
    `data-render-id="${block.id}" data-diagram-language="${lang}">` +
    // Fallback source shown until SVG arrives (or if no renderer is registered)
    `<pre class="diagram-block__source-fallback" data-no-fragment><code class="language-${lang}">${sourceEscaped}</code></pre>` +
    `</figure>`
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(text: string): string {
  return text.replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
