// Bundles the deckpilot-mermaid VS Code extension into dist/extension.js.
// The renderer lazy-loads Mermaid and JSDOM at runtime on first diagram render.

import { build, context } from 'esbuild';

const watch = process.argv.includes('--watch');
const production = process.argv.includes('--production');

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  platform: 'node',
  format: 'cjs',
  target: 'node20',
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
