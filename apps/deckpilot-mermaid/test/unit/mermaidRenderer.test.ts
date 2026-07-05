import * as assert from 'node:assert/strict';
import { MermaidDiagramRenderer } from '../../src/mermaidRenderer';

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

describe('MermaidDiagramRenderer', () => {
  it('exposes the expected capability metadata', () => {
    const renderer = new MermaidDiagramRenderer();

    assert.equal(renderer.id, 'mermaid');
    assert.equal(renderer.priority, 10);
    assert.deepEqual(renderer.supportedFenceLanguages, ['mermaid']);
  });

  it('renders a simple flowchart to wrapped SVG', async () => {
    const renderer = new MermaidDiagramRenderer();
    const result = await renderer.render('graph TD\n  A --> B\n', { language: 'mermaid' });

    assert.equal(result.ok, true);
    assert.equal(result.rendererId, 'mermaid');
    assert.match(result.svg ?? '', /<div class="diagram-block__mermaid">/);
    assert.match(result.svg ?? '', /<svg[\s>]/);
  });

  it('returns an error result for invalid Mermaid syntax', async () => {
    const renderer = new MermaidDiagramRenderer();
    const result = await renderer.render('not-a-valid-diagram\n  A -->', { language: 'mermaid' });

    assert.equal(result.ok, false);
    assert.equal(result.rendererId, 'mermaid');
    assert.match(result.errorMessage ?? '', /Mermaid syntax error:/);
  });

  it('prefers the fence theme attribute over diagram context theme', async () => {
    let initializeConfig: Record<string, unknown> | undefined;
    const renderer = new MermaidDiagramRenderer({
      loadJSDOM: async () => createFakeJSDOMModule(),
      loadMermaid: async () => ({
        initialize: (config) => {
          initializeConfig = config;
        },
        parse: async () => ({ diagramType: 'flowchart-v2' }),
        render: async () => ({ svg: '<svg data-renderer="mermaid"></svg>' }),
      }),
    });

    const result = await renderer.render(
      'graph TD\n  A --> B\n',
      { language: 'mermaid', attributes: { theme: 'dark' } },
      { theme: 'light' },
    );

    assert.equal(result.ok, true);
    assert.equal(initializeConfig?.theme, 'dark');
    assert.equal(initializeConfig?.darkMode, true);
    assert.equal((initializeConfig?.themeVariables as Record<string, string>)?.primaryColor, '#1e1e1e');
  });

  it('returns the webview fallback when native render times out', async () => {
    const renderer = new MermaidDiagramRenderer({
      timeoutMs: 10,
      loadJSDOM: async () => createFakeJSDOMModule(),
      loadMermaid: async () => ({
        initialize: () => undefined,
        parse: async () => ({ diagramType: 'flowchart-v2' }),
        render: async () => {
          await new Promise((resolve) => setTimeout(resolve, 40));
          return { svg: '<svg></svg>' };
        },
      }),
    });

    const result = await renderer.render(
      'graph TD\n  A --> B\n',
      { language: 'mermaid', attributes: { theme: 'auto' } },
      { theme: 'dark' },
    );

    assert.equal(result.ok, true);
    assert.equal(result.rendererId, 'mermaid');
    assert.match(result.svg ?? '', /diagram-block__mermaid-fallback/);
    assert.match(result.svg ?? '', /data-mermaid-theme="dark"/);
    assert.match((result.warnings ?? []).join(' '), /timed out/);
  });

  it('preserves unicode source when falling back to the webview renderer', async () => {
    const renderer = new MermaidDiagramRenderer({
      timeoutMs: 10,
      loadJSDOM: async () => createFakeJSDOMModule(),
      loadMermaid: async () => ({
        initialize: () => undefined,
        parse: async () => ({ diagramType: 'flowchart-v2' }),
        render: async () => {
          await new Promise((resolve) => setTimeout(resolve, 40));
          return { svg: '<svg></svg>' };
        },
      }),
    });
    const result = await renderer.render(
      'flowchart TD\n  A["Inicio 🚀"] --> B["Diseño — 日本語 Ω"]\n',
      { language: 'mermaid' },
      { theme: 'light' },
    );

    assert.equal(result.ok, true);
    assert.match(result.svg ?? '', /diagram-block__mermaid-fallback/);
    assert.match(result.svg ?? '', /data-mermaid-theme="default"/);
    assert.match(
      result.svg ?? '',
      /Zmxvd2NoYXJ0IFRECiAgQVsiSW5pY2lvIPCfmoAiXSAtLT4gQlsiRGlzZcOxbyDigJQg5pel5pys6KqeIM6pIl0K/,
    );
  });

  it('handles many diagrams sequentially without leaking global DOM state', async () => {
    const renderIds: string[] = [];
    const renderer = new MermaidDiagramRenderer({
      loadJSDOM: async () => createFakeJSDOMModule(),
      loadMermaid: async () => ({
        initialize: () => undefined,
        parse: async () => ({ diagramType: 'flowchart-v2' }),
        render: async (id: string) => {
          renderIds.push(id);
          return { svg: `<svg data-render-id="${id}"></svg>` };
        },
      }),
    });

    const results = await Promise.all(
      Array.from({ length: 24 }, (_unused, index) => renderer.render(
        `graph TD\n  A${index} --> B${index}\n`,
        { language: 'mermaid' },
      )),
    );

    assert.equal(results.length, 24);
    assert.ok(results.every((result) => result.ok));
    assert.equal(new Set(renderIds).size, 24);
    assert.equal('window' in globalThis, false);
  });

  it('recomputes auto theme between successive renders', async () => {
    const initializeThemes: string[] = [];
    const renderer = new MermaidDiagramRenderer({
      loadJSDOM: async () => createFakeJSDOMModule(),
      loadMermaid: async () => ({
        initialize: (config) => {
          initializeThemes.push(String(config.theme));
        },
        parse: async () => ({ diagramType: 'flowchart-v2' }),
        render: async () => ({ svg: '<svg data-renderer="mermaid"></svg>' }),
      }),
    });

    await renderer.render('graph TD\n  A --> B\n', { language: 'mermaid', attributes: { theme: 'auto' } }, { theme: 'dark' });
    await renderer.render('graph TD\n  B --> C\n', { language: 'mermaid', attributes: { theme: 'auto' } }, { theme: 'light' });
    await renderer.render('graph TD\n  C --> D\n', { language: 'mermaid', attributes: { theme: 'auto' } }, { theme: 'contrast' });

    assert.deepEqual(initializeThemes, ['dark', 'default', 'neutral']);
  });
});
