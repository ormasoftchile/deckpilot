import type {
  DiagramFenceInfo,
  DiagramRenderOptions,
  DiagramRenderResult,
  IDiagramRenderer,
} from '@deckpilot/core/renderer/diagramRenderer';

export class MermaidFallbackRenderer implements IDiagramRenderer {
  readonly id = 'mermaid-js';
  readonly priority = 5;
  readonly supportedFenceLanguages = ['mermaid'] as const;

  canRender(_source: string, fence: DiagramFenceInfo): boolean {
    return (this.supportedFenceLanguages as readonly string[]).includes(fence.language);
  }

  async render(
    source: string,
    fence: DiagramFenceInfo,
    options?: DiagramRenderOptions,
  ): Promise<DiagramRenderResult> {
    const sourceBase64 = Buffer.from(source, 'utf8').toString('base64');
    const theme = resolveMermaidTheme(
      fence.attributes?.theme && fence.attributes.theme !== 'auto'
        ? fence.attributes.theme
        : options?.theme,
    );

    return {
      ok: true,
      format: 'svg',
      svg: `<div class="diagram-block__mermaid-fallback" data-mermaid-source="${escapeAttr(sourceBase64)}" data-mermaid-theme="${escapeAttr(theme)}"><div class="diagram-block__mermaid-status">Rendering with Mermaid.js…</div></div>`,
      rendererId: this.id,
    };
  }
}

function resolveMermaidTheme(theme?: string): string {
  switch (theme) {
    case 'dark':
    case 'midnight':
      return 'dark';
    case 'contrast':
      return 'neutral';
    case 'light':
    case 'default':
    case 'minimal':
    case 'blueprint':
    case 'editorial':
      return 'default';
    default:
      return 'dark';
  }
}

function escapeAttr(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
