import * as vscode from 'vscode';
import { pathToFileURL } from 'node:url';
import type {
  IDiagramRenderer,
  DiagramFenceInfo,
  DiagramRenderOptions,
  DiagramRenderResult,
} from '@deckpilot/core/renderer/diagramRenderer';

/**
 * Minimal shape of the Triton module we need.
 * The full type is available via @triton/core once its package.json is created.
 */
type TritonModule = {
  renderMermaid(
    text: string,
    options?: { theme?: string; format?: 'svg' },
  ): { svg?: string; warnings?: string[]; kind?: string };
};

const TRITON_THEME_PRESETS = new Set([
  'default',
  'executive',
  'minimal',
  'consulting',
  'product',
  'release',
  'ai-timeline',
  'bytebytego',
  'gitline',
  'our-timeline',
  'subject-timeline',
  'showcase',
]);

/**
 * Diagram renderer adapter for Triton.
 *
 * Triton is loaded lazily via dynamic import() from dist/vendor/triton/index.js
 * (a vendored ESM island kept outside the CJS extension bundle). The module is
 * cached after the first load so subsequent renders pay no import cost.
 *
 * `npm run build` refreshes the vendor bundle automatically; `npm run
 * vendor-triton` can be used to rebuild it directly.
 */
export class TritonDiagramRenderer implements IDiagramRenderer {
  readonly id = 'triton';
  readonly supportedFenceLanguages = ['mermaid'] as const;

  private modulePromise: Promise<TritonModule> | undefined;

  constructor(private readonly extensionUri: vscode.Uri) {}

  canRender(fence: DiagramFenceInfo): boolean {
    return (this.supportedFenceLanguages as readonly string[]).includes(fence.language);
  }

  async render(
    source: string,
    fence: DiagramFenceInfo,
    options?: DiagramRenderOptions,
  ): Promise<DiagramRenderResult> {
    const fenceTheme = fence.attributes?.theme;
    const resolvedTheme = resolveTritonTheme(
      fenceTheme && fenceTheme !== 'auto' ? fenceTheme : options?.theme,
    );
    console.log(
      '[tritonAdapter] render called for',
      fence.language,
      'source length:',
      source.length,
      'fence attrs:',
      JSON.stringify(fence.attributes ?? {}),
      'resolved theme:',
      resolvedTheme,
    );
    try {
      const triton = await this.loadTriton();
      const result = triton.renderMermaid(source, { theme: resolvedTheme, format: 'svg' });

      if (!result.svg) {
        return {
          ok: false,
          format: 'svg',
          errorMessage: `Triton render error: ${result.warnings?.join('; ') || 'Unknown Triton render failure.'}`,
          rendererId: this.id,
        };
      }

      return {
        ok: true,
        format: 'svg',
        svg: result.svg,
        warnings: result.warnings,
        rendererId: this.id,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        format: 'svg',
        errorMessage: `Triton render error: ${message}`,
        rendererId: this.id,
      };
    }
  }

  private loadTriton(): Promise<TritonModule> {
    if (!this.modulePromise) {
      // Triton is vendored as an ESM island — load it with a file:// URL so
      // Node resolves import.meta.url correctly inside the Triton dist files.
      const vendorEntry = vscode.Uri.joinPath(
        this.extensionUri,
        'dist', 'vendor', 'triton', 'index.js',
      );
      const fileUrl = pathToFileURL(vendorEntry.fsPath).href;
      this.modulePromise = import(fileUrl) as Promise<TritonModule>;
    }
    return this.modulePromise;
  }
}

/**
 * Map Deckpilot theme hints to Triton renderMermaid theme names.
 * Always return a concrete, non-empty value so every render is self-contained
 * and cannot bleed from prior module state.
 */
export function resolveTritonTheme(theme?: string): string {
  if (!theme || theme === 'auto') {
    return 'midnight';
  }

  if (TRITON_THEME_PRESETS.has(theme)) {
    return theme;
  }

  switch (theme) {
    case 'dark': return 'midnight';
    case 'light': return 'default';
    case 'contrast': return 'showcase';
    case 'midnight': return 'midnight';
    case 'blueprint': return 'consulting';
    case 'editorial': return 'minimal';
    case 'default': return 'default';
    default:
      return 'midnight';
  }
}

export function applyTritonTheme(source: string, theme: string): string {
  const normalized = source.replace(/^\uFEFF/, '');
  const frontmatterMatch = normalized.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/);

  if (!frontmatterMatch) {
    return `---\ntheme: ${theme}\n---\n${normalized}`;
  }

  const [, rawFrontmatter] = frontmatterMatch;
  const afterFrontmatter = normalized.slice(frontmatterMatch[0].length);
  const frontmatterLines = rawFrontmatter.split(/\r?\n/);
  let themeWritten = false;

  const updatedFrontmatter = frontmatterLines.map((line) => {
    if (/^\s*theme\s*:/.test(line)) {
      themeWritten = true;
      return `theme: ${theme}`;
    }
    return line;
  });

  if (!themeWritten) {
    updatedFrontmatter.push(`theme: ${theme}`);
  }

  return `---\n${updatedFrontmatter.join('\n')}\n---\n${afterFrontmatter}`;
}
