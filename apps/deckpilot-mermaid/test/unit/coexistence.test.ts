import * as assert from 'node:assert/strict';
import type { DiagramFenceInfo, IDiagramRenderer } from '../../../../packages/core/src/renderer/diagramRenderer';
import { DiagramRendererRegistry } from '../../../../packages/extension/src/renderer/diagram/registry';
import { MermaidDiagramRenderer } from '../../src/mermaidRenderer';
import { TritonDiagramRenderer } from '../../../deckpilot-triton/src/tritonAdapter';

function createFakeJSDOMModule() {
  return {
    JSDOM: class {
      window: Record<string, unknown>;

      constructor() {
        const window = {
          document: {},
          navigator: {},
          HTMLElement: class {},
          Element: class {},
          SVGElement: class {},
          Node: class {},
          Document: class {},
          DocumentFragment: class {},
          DOMParser: class {},
          XMLSerializer: class {},
          MutationObserver: class {},
          location: { href: 'https://deckpilot.local/diagram' },
          self: undefined,
          close: () => undefined,
          getComputedStyle: () => ({}),
          setTimeout,
          clearTimeout,
          requestAnimationFrame: (callback: (timestamp: number) => void) => {
            callback(Date.now());
            return 0;
          },
          cancelAnimationFrame: () => undefined,
          atob: (value: string) => Buffer.from(value, 'base64').toString('binary'),
          btoa: (value: string) => Buffer.from(value, 'binary').toString('base64'),
          matchMedia: (query: string) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: () => undefined,
            removeListener: () => undefined,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
            dispatchEvent: () => false,
          }),
        } as unknown as Record<string, unknown>;

        window.self = window;
        this.window = window;
      }
    },
  };
}

function createMermaidRenderer(options: {
  parse?: (source: string) => Promise<unknown>;
  render?: (id: string, source: string) => Promise<{ svg?: string }>;
} = {}) {
  return new MermaidDiagramRenderer({
    loadJSDOM: async () => createFakeJSDOMModule(),
    loadMermaid: async () => ({
      initialize: () => undefined,
      parse: options.parse ?? (async () => ({ diagramType: 'flowchart-v2' })),
      render: options.render ?? (async () => ({ svg: '<svg data-renderer="mermaid"></svg>' })),
    }),
  });
}

function createTritonRenderer(renderSvg: (source: string, fence: DiagramFenceInfo) => string | undefined) {
  const renderer = new TritonDiagramRenderer({ fsPath: __dirname } as never);
  (renderer as unknown as { modulePromise: Promise<unknown> }).modulePromise = Promise.resolve({
    renderMermaid: (source: string) => {
      const language = currentFence?.language ?? 'unknown';
      const svg = renderSvg(source, currentFence ?? { language });
      return svg
        ? { svg, warnings: [`handled:${language}`], kind: 'known' }
        : { svg: undefined, warnings: ['Synthetic Triton failure'], kind: 'unknown' };
    },
  });
  let currentFence: DiagramFenceInfo | undefined;
  const originalRender = renderer.render.bind(renderer);
  renderer.render = (source, fence, options) => {
    currentFence = fence;
    return originalRender(source, fence, options);
  };
  return renderer;
}

function makeBlock(language: string, source: string) {
  return {
    id: `diagram-0-${language}`,
    slideIndex: 0,
    source,
    fence: { language },
    position: { start: 0, end: source.length },
  };
}

describe('deckpilot-mermaid coexistence', () => {
  it('wins over Triton fallback for supported mermaid diagrams', async () => {
    const registry = new DiagramRendererRegistry();
    const mermaidRenderer = createMermaidRenderer();
    const tritonRenderer = createTritonRenderer(() => '<svg data-renderer="triton"></svg>');

    registry.register(tritonRenderer);
    registry.register(mermaidRenderer);

    assert.equal(
      registry.findRenderer('graph TD\n  A --> B\n', { language: 'mermaid' }),
      mermaidRenderer,
    );

    const result = await registry.renderBlock(makeBlock('mermaid', 'graph TD\n  A --> B\n'));

    assert.equal(result.ok, true);
    assert.equal(result.rendererId, 'mermaid');
    assert.match(result.svg ?? '', /diagram-block__mermaid/);
  });

  it('keeps Triton active for explicit triton fences', async () => {
    const registry = new DiagramRendererRegistry();
    const mermaidRenderer = createMermaidRenderer();
    const tritonRenderer = createTritonRenderer((_source, fence) => `<svg data-renderer="triton" data-language="${fence.language}"></svg>`);

    registry.register(tritonRenderer);
    registry.register(mermaidRenderer);

    assert.equal(
      registry.findRenderer('row\n  cell\n    title: Architecture\n', { language: 'triton' }),
      tritonRenderer,
    );
    const tritonResult = await registry.renderBlock(makeBlock('triton', 'row\n  cell\n    title: Architecture\n'));

    assert.equal(tritonResult.rendererId, 'triton');
    assert.match(tritonResult.svg ?? '', /data-language="triton"/);
  });

  it('falls through to a lower-priority Triton-style fallback for Mermaid-native edge types', async () => {
    const registry = new DiagramRendererRegistry();
    const mermaidRenderer = createMermaidRenderer();
    const originalCanRender = mermaidRenderer.canRender.bind(mermaidRenderer);
    mermaidRenderer.canRender = (source, fence) => (
      !source.startsWith('block-beta') &&
      !source.startsWith('kanban') &&
      originalCanRender(source, fence)
    );
    const tritonFallback: IDiagramRenderer = {
      id: 'triton-fallback',
      priority: 5,
      supportedFenceLanguages: ['mermaid'],
      canRender: (source, fence) => (
        fence.language === 'mermaid' &&
        (source.startsWith('block-beta') || source.startsWith('kanban'))
      ),
      render: async (_source, fence) => ({
        ok: true,
        format: 'svg',
        svg: `<svg data-renderer="triton-fallback" data-language="${fence.language}"></svg>`,
        rendererId: 'triton-fallback',
      }),
    };

    registry.register(tritonFallback);
    registry.register(mermaidRenderer);

    assert.equal(
      registry.findRenderer('block-beta\n  columns 2\n', { language: 'mermaid' }),
      tritonFallback,
    );
    assert.equal(
      registry.findRenderer('kanban\n  Todo\n    task[Ship it]\n', { language: 'mermaid' }),
      tritonFallback,
    );

    const result = await registry.renderBlock(makeBlock('mermaid', 'block-beta\n  columns 2\n'));

    assert.equal(result.rendererId, 'triton-fallback');
    assert.match(result.svg ?? '', /data-renderer="triton-fallback"/);
  });

  it('gracefully falls back to Triton when native Mermaid rejects invalid syntax', async () => {
    const registry = new DiagramRendererRegistry();
    const mermaidRenderer = createMermaidRenderer({
      parse: async () => {
        throw new Error('Parse error on line 2');
      },
    });
    const tritonRenderer = createTritonRenderer(() => '<svg data-renderer="triton"></svg>');

    registry.register(tritonRenderer);
    registry.register(mermaidRenderer);

    const result = await registry.renderBlock(makeBlock('mermaid', 'not-a-valid-diagram\n  A -->\n'));

    assert.equal(result.ok, true);
    assert.equal(result.rendererId, 'triton');
    assert.match(result.svg ?? '', /data-renderer="triton"/);
  });

  it('returns the first failure when both Mermaid and Triton fail', async () => {
    const registry = new DiagramRendererRegistry();
    const mermaidRenderer = createMermaidRenderer({
      parse: async () => {
        throw new Error('Parse error on line 2');
      },
    });
    const tritonRenderer = createTritonRenderer(() => undefined);

    registry.register(tritonRenderer);
    registry.register(mermaidRenderer);

    const result = await registry.renderBlock(makeBlock('mermaid', 'not-a-valid-diagram\n  A -->\n'));

    assert.equal(result.ok, false);
    assert.equal(result.rendererId, 'mermaid');
    assert.match(result.errorMessage ?? '', /Mermaid syntax error: Parse error on line 2/);
  });
});
