/**
 * vendor-triton.mjs — builds a self-contained Triton ESM island.
 *
 * Triton cannot be inlined into the CJS extension bundle (import.meta.url
 * usage). Instead we bundle only the Mermaid-facing Triton entry points into
 * dist/vendor/triton/index.js and load that file lazily via dynamic import().
 *
 * We deliberately shim @resvg/resvg-js during vendoring: Deckpilot only asks
 * Triton for SVG output, but Triton's Mermaid entry point statically references
 * its PNG path. The shim keeps the bundle self-contained without dragging in
 * native .node bindings that cannot be embedded by esbuild.
 *
 * Source: resolved from node_modules/@triton/core (when installed) or from the
 * sibling triton project directly for local development.
 *
 * Usage:
 *   npm run vendor-triton
 */

import { build } from 'esbuild';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Resolve source: prefer installed package locations, fall back to sibling project
const appNodeModulesSource = resolve(__dirname, '..', 'node_modules', '@triton', 'core', 'dist');
const workspaceNodeModulesSource = resolve(__dirname, '..', '..', '..', 'node_modules', '@triton', 'core', 'dist');
const siblingSource = resolve(__dirname, '..', '..', '..', '..', 'triton', 'packages', 'core', 'dist');

const candidateSources = [appNodeModulesSource, workspaceNodeModulesSource, siblingSource];
const source = candidateSources.find((candidate) => existsSync(candidate));

if (!source) {
  console.error('[vendor-triton] Could not find Triton dist at:');
  console.error('  ' + appNodeModulesSource);
  console.error('  ' + workspaceNodeModulesSource);
  console.error('  ' + siblingSource);
  console.error('Build Triton first: cd /path/to/triton && pnpm build');
  process.exit(1);
}

const dest = resolve(__dirname, '..', 'dist', 'vendor', 'triton');
const entryPoint = resolve(source, 'index.js');

const resvgShimPlugin = {
  name: 'resvg-shim',
  setup(pluginBuild) {
    pluginBuild.onResolve(
      { filter: /^@resvg\/resvg-js$/ },
      () => ({ path: '@resvg/resvg-js', namespace: 'resvg-shim' }),
    );
    pluginBuild.onLoad(
      { filter: /.*/, namespace: 'resvg-shim' },
      () => ({
        contents: `
          export class Resvg {
            constructor() {
              throw new Error('PNG rendering is unavailable in the Deckpilot Triton vendor bundle.');
            }
          }
        `,
        loader: 'js',
      }),
    );
  },
};

await rm(dest, { recursive: true, force: true });
await mkdir(dest, { recursive: true });
await build({
  stdin: {
    contents: `
      import { compileSync, renderSync } from ${JSON.stringify(entryPoint)};

      const THEME_ALIASES = {
        dark: 'midnight',
        light: 'default',
        contrast: 'showcase',
        auto: 'midnight',
        midnight: 'showcase',
        blueprint: 'consulting',
        editorial: 'minimal',
      };

      function resolveThemeName(theme) {
        if (!theme) {
          return undefined;
        }
        return THEME_ALIASES[theme] ?? theme;
      }

      function injectTheme(text, theme) {
        const resolvedTheme = resolveThemeName(theme);
        if (!resolvedTheme) {
          return text;
        }
        return text.startsWith('---\\n')
          ? text.replace(/^---\\n([\\s\\S]*?)\\n---\\n?/, (_match, frontmatter) => {
              const lines = frontmatter.split(/\\r?\\n/);
              let replaced = false;
              const next = lines.map((line) => {
                if (/^\\s*theme\\s*:/.test(line)) {
                  replaced = true;
                  return 'theme: ' + resolvedTheme;
                }
                return line;
              });
              if (!replaced) {
                next.push('theme: ' + resolvedTheme);
              }
              return '---\\n' + next.join('\\n') + '\\n---\\n';
            })
          : '---\\ntheme: ' + resolvedTheme + '\\n---\\n' + text;
      }

      function detectDiagramType(text) {
        const result = compileSync(text);
        return result.ok ? 'known' : 'unknown';
      }

      function renderMermaid(text, options = {}) {
        const themedText = injectTheme(text, options.theme ?? 'midnight');
        const result = renderSync(themedText, undefined, options.format ?? 'svg');
        if (!result.ok) {
          return { svg: undefined, warnings: [result.error.message], kind: 'unknown' };
        }
        return { svg: result.value, warnings: [], kind: 'known' };
      }

      export { compileSync, renderSync, detectDiagramType, renderMermaid };
    `,
    resolveDir: resolve(__dirname, '..'),
    sourcefile: 'vendor-triton-entry.mjs',
    loader: 'js',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  outfile: resolve(dest, 'index.js'),
  logLevel: 'info',
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
  plugins: [resvgShimPlugin],
});
await writeFile(
  resolve(dest, 'package.json'),
  JSON.stringify({ type: 'module' }, null, 2) + '\n',
  'utf8',
);

console.log('[vendor-triton] Bundled Triton Mermaid runtime →', resolve(dest, 'index.js'));
