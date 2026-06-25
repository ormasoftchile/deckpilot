// Bundles the deckpilot-triton VS Code extension into dist/extension.js.
//
// Triton is NOT inlined here — its ESM dist uses import.meta.url for font
// resolution, which breaks in a CJS bundle. Instead, Triton is vendored as
// a separate ESM island under dist/vendor/triton/ and loaded at runtime via
// dynamic import(). Run `npm run vendor-triton` to populate that directory.

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
