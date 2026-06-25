import type {
  IDiagramRenderer,
  DiagramRenderOptions,
  DiagramRenderResult,
  DiagramFenceInfo,
  DiagramBlockRef,
} from '@deckpilot/core/renderer/diagramRenderer';

/**
 * Registry of diagram renderer adapters.
 * Instantiated by Conductor; exposed via DeckpilotDiagramAPI for companion extensions.
 */
export class DiagramRendererRegistry {
  private readonly renderers = new Map<string, IDiagramRenderer>();

  register(renderer: IDiagramRenderer): { dispose(): void } {
    this.renderers.set(renderer.id, renderer);
    return {
      dispose: () => { this.renderers.delete(renderer.id); },
    };
  }

  unregister(id: string): void {
    this.renderers.delete(id);
  }

  get(id: string): IDiagramRenderer | undefined {
    return this.renderers.get(id);
  }

  findRenderer(fence: DiagramFenceInfo): IDiagramRenderer | undefined {
    for (const renderer of this.renderers.values()) {
      if (renderer.canRender(fence)) {
        return renderer;
      }
    }
    return undefined;
  }

  async renderBlock(
    block: DiagramBlockRef,
    options?: DiagramRenderOptions,
  ): Promise<DiagramRenderResult> {
    const renderer = this.findRenderer(block.fence);
    if (!renderer) {
      return {
        ok: false,
        format: 'svg',
        errorMessage: `No diagram renderer registered for "${block.fence.language}". Install a diagram adapter extension (e.g. deckpilot-triton).`,
        rendererId: 'none',
      };
    }
    return renderer.render(block.source, block.fence, options);
  }
}
