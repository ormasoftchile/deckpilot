import * as assert from 'node:assert/strict';
import { applyTritonTheme, TritonDiagramRenderer, resolveTritonTheme, stripBackgroundRect, extractFrontmatterTheme } from '../../src/tritonAdapter';

/**
 * Unit tests for TritonDiagramRenderer.
 *
 * These run in plain Node — no VS Code API is needed.
 *
 * Tests that require a live Triton render are skipped unless the vendored
 * dist is present at apps/deckpilot-triton/dist/vendor/triton/.
 * Run `npm run vendor-triton` first in those cases.
 */

describe('TritonDiagramRenderer — canRender()', () => {
  const adapter = new TritonDiagramRenderer({ fsPath: __dirname } as never);

  it('returns true for mermaid', () => {
    assert.ok(adapter.canRender('graph TD\n  A --> B\n', { language: 'mermaid' }));
  });

  it('returns false for graphviz', () => {
    assert.ok(!adapter.canRender('digraph { a -> b }', { language: 'graphviz' }));
  });

  it('returns false for empty string', () => {
    assert.ok(!adapter.canRender('graph TD\n  A --> B\n', { language: '' }));
  });

  it('accepts explicit triton fences', () => {
    assert.ok(adapter.canRender('row\n  cell\n    title: Test\n', { language: 'triton' }));
  });

  it('returns false for Triton-unsupported Mermaid native types', () => {
    assert.ok(!adapter.canRender('packet-beta\n  title TCP Segment Header\n', { language: 'mermaid' }));
    assert.ok(!adapter.canRender('xychart-beta\n  title "Monthly Revenue"\n', { language: 'mermaid' }));
    assert.ok(!adapter.canRender('block-beta\n  columns 2\n', { language: 'mermaid' }));
    assert.ok(!adapter.canRender('kanban\n  Todo\n    task[Ship it]\n', { language: 'mermaid' }));
  });

  it('ignores Mermaid frontmatter when detecting the diagram type', () => {
    assert.ok(adapter.canRender('---\ntheme: dark\n---\ntimeline\n  title History\n', { language: 'mermaid' }));
  });
});

describe('resolveTritonTheme()', () => {
  it('passes through current Triton preset names', () => {
    assert.equal(resolveTritonTheme('default'), 'default');
    assert.equal(resolveTritonTheme('executive'), 'executive');
    assert.equal(resolveTritonTheme('minimal'), 'minimal');
    assert.equal(resolveTritonTheme('consulting'), 'consulting');
    assert.equal(resolveTritonTheme('showcase'), 'showcase');
  });

  it('maps Deckpilot and legacy hints to Triton presets', () => {
    assert.equal(resolveTritonTheme('dark'), 'midnight');
    assert.equal(resolveTritonTheme('light'), 'default');
    assert.equal(resolveTritonTheme('contrast'), 'showcase');
    assert.equal(resolveTritonTheme('midnight'), 'midnight');
    assert.equal(resolveTritonTheme('blueprint'), 'consulting');
    assert.equal(resolveTritonTheme('editorial'), 'minimal');
    assert.equal(resolveTritonTheme('auto'), 'midnight');
  });

  it('falls back to midnight for missing or unknown values', () => {
    assert.equal(resolveTritonTheme(), 'midnight');
    assert.equal(resolveTritonTheme('sepia'), 'midnight');
  });
});

describe('applyTritonTheme()', () => {
  it('prepends frontmatter when the source has none', () => {
    assert.equal(
      applyTritonTheme('graph TD\n  A --> B\n', 'executive'),
      '---\ntheme: executive\n---\ngraph TD\n  A --> B\n',
    );
  });

  it('overrides an existing frontmatter theme in place', () => {
    assert.equal(
      applyTritonTheme('---\ntheme: default\n---\ngraph TD\n  A --> B\n', 'executive'),
      '---\ntheme: executive\n---\ngraph TD\n  A --> B\n',
    );
  });

  it('adds a theme field to existing frontmatter', () => {
    assert.equal(
      applyTritonTheme('---\nconfig:\n  spacing: compact\n---\ngraph TD\n  A --> B\n', 'executive'),
      '---\nconfig:\n  spacing: compact\ntheme: executive\n---\ngraph TD\n  A --> B\n',
    );
  });

  it('preserves an existing type field when adding theme', () => {
    assert.equal(
      applyTritonTheme('---\ntype: poster\n---\nrow\n  cell\n    title: Test', 'midnight'),
      '---\ntype: poster\ntheme: midnight\n---\nrow\n  cell\n    title: Test',
    );
  });
});

describe('TritonDiagramRenderer — render()', () => {
  it('always passes an explicit midnight theme when no theme is provided', async () => {
    const adapter = new TritonDiagramRenderer({ fsPath: __dirname } as never);
    let capturedTheme: string | undefined;

    (adapter as unknown as { modulePromise: Promise<unknown> }).modulePromise = Promise.resolve({
      renderMermaid: (_text: string, options?: { theme?: string }) => {
        capturedTheme = options?.theme;
        return { svg: '<svg />', warnings: [], kind: 'known' };
      },
    });

    const result = await adapter.render('graph TD\n  A --> B\n', { language: 'mermaid' });

    assert.equal(capturedTheme, 'midnight');
    assert.equal(result.ok, true);
    assert.equal(result.svg, '<svg />');
  });

  it('prefers the fence theme over the VS Code theme hint', async () => {
    const adapter = new TritonDiagramRenderer({ fsPath: __dirname } as never);
    let capturedTheme: string | undefined;

    (adapter as unknown as { modulePromise: Promise<unknown> }).modulePromise = Promise.resolve({
      renderMermaid: (_text: string, options?: { theme?: string }) => {
        capturedTheme = options?.theme;
        return { svg: '<svg />', warnings: [], kind: 'known' };
      },
    });

    await adapter.render(
      'graph TD\n  A --> B\n',
      { language: 'mermaid', attributes: { theme: 'executive' } },
      { theme: 'dark' },
    );

    assert.equal(capturedTheme, 'executive');
  });

  it('uses the VS Code theme hint when the fence theme is auto', async () => {
    const adapter = new TritonDiagramRenderer({ fsPath: __dirname } as never);
    let capturedTheme: string | undefined;

    (adapter as unknown as { modulePromise: Promise<unknown> }).modulePromise = Promise.resolve({
      renderMermaid: (_text: string, options?: { theme?: string }) => {
        capturedTheme = options?.theme;
        return { svg: '<svg />', warnings: [], kind: 'known' };
      },
    });

    await adapter.render(
      'graph TD\n  A --> B\n',
      { language: 'mermaid', attributes: { theme: 'auto' } },
      { theme: 'dark' },
    );

    assert.equal(capturedTheme, 'midnight');
  });

  const svgWithBg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400" width="300" height="400">' +
    '<rect x="0" y="0" width="300" height="400" fill="#0d1b2a" />' +
    '<text>hi</text></svg>';

  const bgAdapter = () => {
    const adapter = new TritonDiagramRenderer({ fsPath: __dirname } as never);
    (adapter as unknown as { modulePromise: Promise<unknown> }).modulePromise = Promise.resolve({
      renderMermaid: () => ({ svg: svgWithBg, warnings: [], kind: 'known' }),
    });
    return adapter;
  };

  it('strips the background so diagrams are frameless (follow deck theme)', async () => {
    const result = await bgAdapter().render(
      'graph TD\n  A --> B\n',
      { language: 'mermaid' },
      { theme: 'dark' },
    );
    assert.equal(result.ok, true);
    assert.ok(!result.svg?.includes('#0d1b2a'), 'follow-deck diagram should have its background stripped');
  });

  it('strips the background even when an explicit fence theme is set', async () => {
    const result = await bgAdapter().render(
      'graph TD\n  A --> B\n',
      { language: 'mermaid', attributes: { theme: 'minimal' } },
      { theme: 'dark' },
    );
    assert.equal(result.ok, true);
    assert.ok(!result.svg?.includes('#0d1b2a'), 'explicitly themed diagram is still frameless');
  });

  it('strips the background even when the theme is set in the diagram frontmatter', async () => {
    const result = await bgAdapter().render(
      '---\ntheme: minimal\n---\nbullets\n  title Q3\n  Ship it\n',
      { language: 'triton' },
      { theme: 'dark' },
    );
    assert.equal(result.ok, true);
    assert.ok(!result.svg?.includes('#0d1b2a'), 'frontmatter-themed diagram is still frameless');
  });

  it('resolves the frontmatter theme (not the deck default) when no fence theme is set', async () => {
    const adapter = new TritonDiagramRenderer({ fsPath: __dirname } as never);
    let capturedTheme: string | undefined;
    (adapter as unknown as { modulePromise: Promise<unknown> }).modulePromise = Promise.resolve({
      renderMermaid: (_text: string, options?: { theme?: string }) => {
        capturedTheme = options?.theme;
        return { svg: '<svg />', warnings: [], kind: 'known' };
      },
    });

    await adapter.render(
      '---\ntheme: minimal\n---\nbullets\n  title Q3\n',
      { language: 'triton' },
      { theme: 'dark' },
    );

    assert.equal(capturedTheme, 'minimal');
  });

  it('lets an explicit fence theme override the frontmatter theme', async () => {
    const adapter = new TritonDiagramRenderer({ fsPath: __dirname } as never);
    let capturedTheme: string | undefined;
    (adapter as unknown as { modulePromise: Promise<unknown> }).modulePromise = Promise.resolve({
      renderMermaid: (_text: string, options?: { theme?: string }) => {
        capturedTheme = options?.theme;
        return { svg: '<svg />', warnings: [], kind: 'known' };
      },
    });

    await adapter.render(
      '---\ntheme: minimal\n---\nbullets\n  title Q3\n',
      { language: 'triton', attributes: { theme: 'executive' } },
      { theme: 'dark' },
    );

    assert.equal(capturedTheme, 'executive');
  });

  it('resolves the deck theme when neither fence nor frontmatter set one', async () => {
    const adapter = new TritonDiagramRenderer({ fsPath: __dirname } as never);
    let capturedTheme: string | undefined;
    (adapter as unknown as { modulePromise: Promise<unknown> }).modulePromise = Promise.resolve({
      renderMermaid: (_text: string, options?: { theme?: string }) => {
        capturedTheme = options?.theme;
        return { svg: '<svg />', warnings: [], kind: 'known' };
      },
    });

    await adapter.render(
      'bullets\n  title Q3\n',
      { language: 'triton' },
      { theme: 'bytebytego' },
    );

    assert.equal(capturedTheme, 'bytebytego');
  });
});

describe('extractFrontmatterTheme()', () => {
  it('reads a theme from leading frontmatter', () => {
    assert.equal(extractFrontmatterTheme('---\ntheme: minimal\n---\nbullets\n'), 'minimal');
  });

  it('strips surrounding quotes', () => {
    assert.equal(extractFrontmatterTheme('---\ntheme: "showcase"\n---\nbullets\n'), 'showcase');
  });

  it('returns undefined when there is no frontmatter', () => {
    assert.equal(extractFrontmatterTheme('bullets\n  title Q3\n'), undefined);
  });

  it('returns undefined when frontmatter has no theme key', () => {
    assert.equal(extractFrontmatterTheme('---\ntype: poster\n---\nrow\n'), undefined);
  });

  it('picks up a theme among other frontmatter keys', () => {
    assert.equal(extractFrontmatterTheme('---\ntype: poster\ntheme: consulting\n---\nrow\n'), 'consulting');
  });
});

describe('stripBackgroundRect()', () => {
  const svgWith = (viewBox: string, bgRect: string, rest = '') =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="100" height="100">\n${bgRect}${rest}</svg>`;

  it('removes the full-viewport background rect', () => {
    const svg = svgWith(
      '0 0 300 400',
      '  <rect x="0" y="0" width="300" height="400" fill="#0d1b2a" />\n',
    );
    const out = stripBackgroundRect(svg);
    assert.ok(!out.includes('#0d1b2a'), 'background rect should be removed');
  });

  it('handles negative origins and decimal dimensions', () => {
    const svg = svgWith(
      '-4 -4 300.5 400',
      '  <rect x="-4" y="-4" width="300.5" height="400" fill="#123456" />\n',
    );
    const out = stripBackgroundRect(svg);
    assert.ok(!out.includes('#123456'), 'decimal/negative background rect should be removed');
  });

  it('keeps content rects that do not match the viewBox', () => {
    const svg = svgWith(
      '0 0 300 400',
      '  <rect x="0" y="0" width="300" height="400" fill="#0d1b2a" />\n',
      '  <rect x="10" y="10" width="120" height="40" fill="#abcdef" stroke="#fff" stroke-width="1" />\n',
    );
    const out = stripBackgroundRect(svg);
    assert.ok(!out.includes('#0d1b2a'), 'background rect removed');
    assert.ok(out.includes('#abcdef'), 'content rect kept');
  });

  it('returns the SVG unchanged when there is no viewBox', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="#000" /></svg>';
    assert.equal(stripBackgroundRect(svg), svg);
  });

  it('leaves the SVG untouched when no background rect matches', () => {
    const svg = svgWith(
      '0 0 300 400',
      '  <rect x="10" y="10" width="120" height="40" fill="#abcdef" />\n',
    );
    assert.equal(stripBackgroundRect(svg), svg);
  });
});
