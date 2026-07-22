import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { readFileSync } from 'node:fs';

// Single source of truth: the root extension package.json version is what
// users see in the marketplace; the viewer surfaces the same string so the
// two stay visibly in sync.
const rootPkg = JSON.parse(
  readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8'),
) as { version: string };

export default defineConfig({
  define: {
    __DECKPILOT_VERSION__: JSON.stringify(rootPkg.version),
  },
  plugins: [react()],
  resolve: {
    alias: {
      // Workspace package — resolve to source for HMR/typecheck
      '@deckpilot/core': path.resolve(__dirname, '../../packages/core/src'),
      // Deck-rendering surface — resolve to source for HMR/typecheck
      '@deckpilot/preview': path.resolve(__dirname, '../../packages/preview/src'),
      // Node built-ins used transitively by @deckpilot/core (sidecarLoader, envFileLoader).
      // In the browser these are stubbed to no-op — sidecars are fetched over HTTP instead.
      fs: path.resolve(__dirname, 'src/stubs/fs.ts'),
      path: path.resolve(__dirname, 'src/stubs/path.ts'),
      // gray-matter relies on Node Buffer; provide a minimal frontmatter-only stub.
      'gray-matter': path.resolve(__dirname, 'src/stubs/gray-matter.ts'),
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          reveal: ['reveal.js'],
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },
  server: {
    port: 5173,
    open: false,
    fs: {
      // Allow Vite to serve files from the workspace root so `@deckpilot/core`
      // source (in ../../packages/core) can be loaded via /@fs/... in dev mode.
      allow: [path.resolve(__dirname, '../..')],
    },
  },
});
