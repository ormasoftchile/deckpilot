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
  private readonly renderers: IDiagramRenderer[] = [];

  register(renderer: IDiagramRenderer): { dispose(): void } {
    this.unregister(renderer.id);
    this.renderers.push(renderer);
    return {
      dispose: () => { this.unregister(renderer.id); },
    };
  }

  unregister(id: string): void {
    const index = this.renderers.findIndex((renderer) => renderer.id === id);
    if (index >= 0) {
      this.renderers.splice(index, 1);
    }
  }

  get(id: string): IDiagramRenderer | undefined {
    return this.renderers.find((renderer) => renderer.id === id);
  }

  findRenderer(source: string, fence: DiagramFenceInfo): IDiagramRenderer | undefined {
    return this.findCandidateRenderers(source, fence)[0];
  }

  async renderBlock(
    block: DiagramBlockRef,
    options?: DiagramRenderOptions,
  ): Promise<DiagramRenderResult> {
    const candidates = this.findCandidateRenderers(block.source, block.fence);
    if (candidates.length === 0) {
      return {
        ok: false,
        format: 'svg',
        errorMessage: `No diagram renderer registered for "${block.fence.language}". Install a diagram adapter extension (e.g. deckpilot-triton).`,
        rendererId: 'none',
      };
    }

    let fallbackFailure: DiagramRenderResult | undefined;

    for (const renderer of candidates) {
      const result = await renderer.render(block.source, block.fence, options);
      if (result.ok && result.svg) {
        return result;
      }
      fallbackFailure ??= result;
    }

    return fallbackFailure ?? {
      ok: false,
      format: 'svg',
      errorMessage: `No diagram renderer could render "${block.fence.language}".`,
      rendererId: 'none',
    };
  }

  private findCandidateRenderers(source: string, fence: DiagramFenceInfo): IDiagramRenderer[] {
    return this.renderers
      .map((renderer, index) => ({ renderer, index }))
      .filter(({ renderer }) => {
        if (!renderer.supportedFenceLanguages.includes(fence.language)) {
          return false;
        }

        return renderer.canRender ? renderer.canRender(source, fence) : true;
      })
      .sort((left, right) => {
        const priorityDelta = (right.renderer.priority ?? 0) - (left.renderer.priority ?? 0);
        return priorityDelta !== 0 ? priorityDelta : left.index - right.index;
      })
      .map(({ renderer }) => renderer);
  }
}
