// Bundles the VS Code extension entry into a single dist/extension.js.
// - `vscode` is provided by the host and must stay external.
// - `@deckpilot/core` is workspace-linked; esbuild follows the package
//   exports and inlines it.
// - Webview assets (CSS/JS in packages/extension/src/webview/assets/) are
//   loaded by the host via vscode.Uri.joinPath and are NOT bundled.
import { build, context } from 'esbuild';

const watch = process.argv.includes('--watch');
const production = process.argv.includes('--production');

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: ['packages/extension/src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  external: ['vscode'],
  sourcemap: production ? false : 'linked',
  minify: production,
  treeShaking: true,
  logLevel: 'info',
};

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log('[esbuild] watching…');
} else {
  await build(options);
}
