import * as vscode from 'vscode';
import type { DiagramBlockRef, DiagramRenderOptions } from '@deckpilot/core/models/diagram';
import { DiagramRendererRegistry } from '../renderer/diagram/registry';
import { diagramLog } from '../utils/diagramLogger';

const LOADING_BLOCK_PATTERN = /<figure\b([^>]*\bclass="[^"]*\bdiagram-block--loading\b[^"]*"[^>]*)>([\s\S]*?)<\/figure>/g;

export class DiagramService {
  constructor(private diagramRegistry: DiagramRendererRegistry) {}

  async resolveSlideBlocks(slideHtml: string): Promise<Array<{ blockId: string; html: string }>> {
    const blocks = this.extractBlocks(slideHtml);
    diagramLog(`[diagram-service] resolveSlideBlocks: blocks = ${blocks.length}`);

    return Promise.all(blocks.map(async (block) => ({
      blockId: block.id,
      html: await this.renderBlock(block),
    })));
  }

  private extractBlocks(slideHtml: string): DiagramBlockRef[] {
    const blocks: DiagramBlockRef[] = [];

    for (const match of slideHtml.matchAll(LOADING_BLOCK_PATTERN)) {
      const attrs = match[1] ?? '';
      const body = match[2] ?? '';
      const id = readAttr(attrs, 'data-render-id');
      const language = readAttr(attrs, 'data-diagram-language');
      const source = decodeHtml(extractCodeSource(body));

      if (!id || !language || !source) {
        continue;
      }

      const caption = readAttr(attrs, 'data-diagram-caption');
      const theme = readAttr(attrs, 'data-diagram-theme');
      const workspaceRoot = readAttr(attrs, 'data-diagram-workspace-root');
      blocks.push({
        id,
        slideIndex: 0,
        source,
        fence: {
          language,
          attributes: {
            ...(caption ? { caption } : {}),
            ...(theme ? { theme } : {}),
            ...(workspaceRoot ? { workspaceRoot } : {}),
          },
        },
        position: { start: 0, end: source.length },
      });
    }

    return blocks;
  }

  private async renderBlock(block: DiagramBlockRef): Promise<string> {
    diagramLog(`[diagram-service] rendering block ${block.id} ${block.fence.language}`);

    const attrs = block.fence.attributes;
    const fenceTheme = attrs?.theme;
    const theme: DiagramRenderOptions['theme'] =
      !fenceTheme || fenceTheme === 'auto' ? resolveTheme() : fenceTheme;
    const workspaceRoot = attrs?.workspaceRoot ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    try {
      const result = await this.diagramRegistry.renderBlock(block, { theme, workspaceRoot });
      if (result.ok && result.svg) {
        const caption = attrs?.caption ?? '';
        const captionHtml = caption
          ? `<figcaption class="diagram-block__caption">${escapeHtml(caption)}</figcaption>`
          : '';
        return `<figure class="diagram-block" data-render-id="${block.id}" data-diagram-renderer="${result.rendererId}" data-diagram-language="${block.fence.language}">\
<div class="diagram-block__viewport">${result.svg}</div>${captionHtml}</figure>`;
      }

      return buildErrorHtml(
        block,
        result.errorMessage ?? 'Diagram render failed.',
        '⚠ Diagram failed to render',
        true,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return buildErrorHtml(block, message, '⚠ Diagram render error', false);
    }
  }
}

export function annotateDiagramPlaceholders(slideHtml: string, workspaceRoot?: string): string {
  if (!workspaceRoot) {
    return slideHtml;
  }

  return slideHtml.replace(LOADING_BLOCK_PATTERN, (match, attrs: string, body: string) => {
    if (/data-diagram-workspace-root=/.test(attrs)) {
      return match;
    }
    return `<figure${attrs} data-diagram-workspace-root="${escapeAttr(workspaceRoot)}">${body}</figure>`;
  });
}

function buildErrorHtml(
  block: DiagramBlockRef,
  message: string,
  title: string,
  showSource: boolean,
): string {
  const sourceHtml = showSource
    ? `<details class="diagram-block__source"><summary>Show source</summary>\
<pre><code class="language-${block.fence.language}">${escapeHtml(block.source)}</code></pre></details>`
    : '';

  return `<figure class="diagram-block diagram-block--error" data-render-id="${block.id}">\
<div class="diagram-block__error-header">${title}</div>\
<pre class="diagram-block__error-message">${escapeHtml(message)}</pre>${sourceHtml}</figure>`;
}

function extractCodeSource(body: string): string {
  const match = body.match(/<code\b[^>]*>([\s\S]*?)<\/code>/);
  return match?.[1] ?? '';
}

function readAttr(attrs: string, name: string): string | undefined {
  const match = attrs.match(new RegExp(`${name}="([^"]*)"`, 'i'));
  return match?.[1];
}

function resolveTheme(): DiagramRenderOptions['theme'] {
  const vsTheme = vscode.window.activeColorTheme?.kind;
  return vsTheme === vscode.ColorThemeKind.Light ? 'light'
    : vsTheme === vscode.ColorThemeKind.HighContrast || vsTheme === vscode.ColorThemeKind.HighContrastLight ? 'contrast'
    : 'dark';
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
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
