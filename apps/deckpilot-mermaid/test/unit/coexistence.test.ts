import * as assert from 'node:assert/strict';
import type { IDiagramRenderer } from '../../../../packages/core/src/renderer/diagramRenderer';
import { DiagramRendererRegistry } from '../../../../packages/extension/src/renderer/diagram/registry';
import { MermaidDiagramRenderer } from '../../src/mermaidRenderer';

describe('deckpilot-mermaid coexistence', () => {
  it('wins over a lower-priority mermaid fallback renderer', async () => {
    const registry = new DiagramRendererRegistry();
    const mermaidRenderer = new MermaidDiagramRenderer({
      loadJSDOM: async () => ({
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
      }),
      loadMermaid: async () => ({
        initialize: () => undefined,
        parse: async () => ({ diagramType: 'flowchart-v2' }),
        render: async () => ({ svg: '<svg data-renderer="mermaid"></svg>' }),
      }),
    });
    const tritonFallback: IDiagramRenderer = {
      id: 'triton',
      priority: 5,
      supportedFenceLanguages: ['mermaid'],
      render: () => Promise.resolve({
        ok: true,
        format: 'svg',
        svg: '<svg data-renderer="triton"></svg>',
        rendererId: 'triton',
      }),
    };

    registry.register(tritonFallback);
    registry.register(mermaidRenderer);

    assert.equal(
      registry.findRenderer('graph TD\n  A --> B\n', { language: 'mermaid' }),
      mermaidRenderer,
    );

    const result = await registry.renderBlock({
      id: 'diagram-0-0',
      slideIndex: 0,
      source: 'graph TD\n  A --> B\n',
      fence: { language: 'mermaid' },
      position: { start: 0, end: 18 },
    });

    assert.equal(result.rendererId, 'mermaid');
    assert.equal(result.svg, '<div class="diagram-block__mermaid"><svg data-renderer="mermaid"></svg></div>');
  });
});
