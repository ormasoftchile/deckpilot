import * as assert from 'node:assert/strict';
import { applyTritonTheme, TritonDiagramRenderer, resolveTritonTheme } from '../../src/tritonAdapter';

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
    assert.ok(adapter.canRender({ language: 'mermaid' }));
  });

  it('returns false for graphviz', () => {
    assert.ok(!adapter.canRender({ language: 'graphviz' }));
  });

  it('returns false for empty string', () => {
    assert.ok(!adapter.canRender({ language: '' }));
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
});
