import { expect } from 'chai';
import type {
  DiagramBlockRef,
  DiagramFenceInfo,
  DiagramRenderOptions,
  DiagramRenderResult,
  IDiagramRenderer,
} from '../../packages/core/src/renderer/diagramRenderer';
import { DiagramRendererRegistry } from '../../packages/extension/src/renderer/diagram/registry';

function makeFence(language: string): DiagramFenceInfo {
  return { language };
}

function makeBlock(language: string, source: string = 'graph TD\n  A --> B\n'): DiagramBlockRef {
  return {
    id: 'diagram-0-0',
    slideIndex: 0,
    source,
    fence: makeFence(language),
    position: { start: 0, end: source.length },
  };
}

function makeRenderer(
  id: string,
  languages: readonly string[],
  priority?: number,
  canRenderImpl?: (source: string, fence: DiagramFenceInfo) => boolean,
  renderImpl?: (source: string, fence: DiagramFenceInfo, options?: DiagramRenderOptions) => Promise<DiagramRenderResult>,
): IDiagramRenderer {
  return {
    id,
    priority,
    supportedFenceLanguages: languages,
    canRender: canRenderImpl ?? ((_source: string, fence: DiagramFenceInfo) => languages.includes(fence.language)),
    render: renderImpl ?? (async () => ({
      ok: true,
      format: 'svg',
      svg: `<svg data-renderer="${id}"></svg>`,
      rendererId: id,
    })),
  };
}

describe('DiagramRendererRegistry', () => {
  it('returns undefined from findRenderer when the registry is empty', () => {
    const registry = new DiagramRendererRegistry();

    expect(registry.findRenderer('graph TD\n  A --> B\n', makeFence('mermaid'))).to.equal(undefined);
  });

  it('returns the matching renderer for a supported language', () => {
    const registry = new DiagramRendererRegistry();
    const mermaidRenderer = makeRenderer('mermaid-renderer', ['mermaid']);
    registry.register(mermaidRenderer);

    expect(registry.findRenderer('graph TD\n  A --> B\n', makeFence('mermaid'))).to.equal(mermaidRenderer);
  });

  it('returns undefined for an unsupported language', () => {
    const registry = new DiagramRendererRegistry();
    registry.register(makeRenderer('mermaid-renderer', ['mermaid']));

    expect(registry.findRenderer('@startuml\n@enduml\n', makeFence('plantuml'))).to.equal(undefined);
  });

  it('routes different languages to the correct registered renderer', () => {
    const registry = new DiagramRendererRegistry();
    const mermaidRenderer = makeRenderer('mermaid-renderer', ['mermaid']);
    const d2Renderer = makeRenderer('d2-renderer', ['d2']);

    registry.register(mermaidRenderer);
    registry.register(d2Renderer);

    expect(registry.findRenderer('graph TD\n  A --> B\n', makeFence('mermaid'))).to.equal(mermaidRenderer);
    expect(registry.findRenderer('direction: right\n', makeFence('d2'))).to.equal(d2Renderer);
  });

  it('skips renderers whose canRender rejects the specific source', () => {
    const registry = new DiagramRendererRegistry();
    const tritonRenderer = makeRenderer(
      'triton',
      ['mermaid'],
      undefined,
      (source) => !source.startsWith('packet-beta'),
    );
    const fallbackRenderer = makeRenderer('mermaid-js', ['mermaid']);

    registry.register(tritonRenderer);
    registry.register(fallbackRenderer);

    expect(registry.findRenderer('packet-beta\n  title Header\n', makeFence('mermaid'))).to.equal(fallbackRenderer);
  });

  it('prefers the highest-priority matching renderer', () => {
    const registry = new DiagramRendererRegistry();
    const fallbackRenderer = makeRenderer('mermaid-js', ['mermaid'], 5);
    const nativeRenderer = makeRenderer('deckpilot-mermaid', ['mermaid'], 10);

    registry.register(fallbackRenderer);
    registry.register(nativeRenderer);

    expect(registry.findRenderer('graph TD\n  A --> B\n', makeFence('mermaid'))).to.equal(nativeRenderer);
  });

  it('returns the fallback result when no renderer is registered for a block', async () => {
    const registry = new DiagramRendererRegistry();

    const result = await registry.renderBlock(makeBlock('plantuml'));

    expect(result).to.deep.equal({
      ok: false,
      format: 'svg',
      errorMessage: 'No diagram renderer registered for "plantuml". Install a diagram adapter extension (e.g. deckpilot-triton).',
      rendererId: 'none',
    });
  });

  it('delegates renderBlock to the matched renderer and returns its result', async () => {
    const registry = new DiagramRendererRegistry();
    const block = makeBlock('mermaid', 'graph TD\n  Start --> End\n');
    const options: DiagramRenderOptions = { theme: 'dark', workspaceRoot: '/workspace' };
    let received: { source?: string; fence?: DiagramFenceInfo; options?: DiagramRenderOptions } = {};

    const expected: DiagramRenderResult = {
      ok: true,
      format: 'svg',
      svg: '<svg>diagram</svg>',
      rendererId: 'mermaid-renderer',
    };

    registry.register(makeRenderer(
      'mermaid-renderer',
      ['mermaid'],
      undefined,
      undefined,
      async (source, fence, renderOptions) => {
        received = { source, fence, options: renderOptions };
        return expected;
      },
    ));

    const result = await registry.renderBlock(block, options);

    expect(received).to.deep.equal({
      source: block.source,
      fence: block.fence,
      options,
    });
    expect(result).to.equal(expected);
  });

  it('falls through to the next renderer when the first candidate fails', async () => {
    const registry = new DiagramRendererRegistry();
    registry.register(makeRenderer('triton', ['mermaid'], undefined, undefined, async () => ({
      ok: false,
      format: 'svg',
      errorMessage: 'Triton render error',
      rendererId: 'triton',
    })));
    registry.register(makeRenderer('mermaid-js', ['mermaid']));

    const result = await registry.renderBlock(makeBlock('mermaid', 'packet-beta\n  title Header\n'));

    expect(result.ok).to.equal(true);
    expect(result.rendererId).to.equal('mermaid-js');
  });

  it('treats renderers without canRender as eligible when language matches', async () => {
    const registry = new DiagramRendererRegistry();
    const renderer: IDiagramRenderer = {
      id: 'legacy',
      supportedFenceLanguages: ['mermaid'],
      render: async () => ({
        ok: true,
        format: 'svg',
        svg: '<svg data-renderer="legacy"></svg>',
        rendererId: 'legacy',
      }),
    };

    registry.register(renderer);

    const result = await registry.renderBlock(makeBlock('mermaid'));

    expect(result.ok).to.equal(true);
    expect(result.rendererId).to.equal('legacy');
  });
});
