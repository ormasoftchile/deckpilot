import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { readFileSync } from 'node:fs';

// Mirror the viewer: surface the root extension package.json version so the
// editor and the marketplace extension stay visibly in sync. (Some viewer
// source we import may reference this define.)
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
      // Workspace package — resolve to source for HMR/typecheck (same as viewer).
      '@deckpilot/core': path.resolve(__dirname, '../../packages/core/src'),
      // Import the CURRENT viewer render pipeline verbatim (DeckViewer + lib/*).
      // Phase 0 embeds the viewer render directly; Phase 2 extracts @deckpilot/preview.
      '@viewer': path.resolve(__dirname, '../viewer/src'),
      // Reuse the EXISTING extension completion provider logic without editing
      // the extension. The file imports only @deckpilot/core (browser-safe).
      // Phase 1 moves this into @deckpilot/language.
      '@extension-providers': path.resolve(
        __dirname,
        '../../packages/extension/src/providers',
      ),
      // Node built-ins used transitively by @deckpilot/core + the viewer render.
      // Reuse the viewer's browser stubs verbatim so behavior matches the viewer.
      fs: path.resolve(__dirname, '../viewer/src/stubs/fs.ts'),
      path: path.resolve(__dirname, '../viewer/src/stubs/path.ts'),
      'gray-matter': path.resolve(__dirname, '../viewer/src/stubs/gray-matter.ts'),
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        // Split the heavy chunks so the gzip budget breakdown is legible:
        // monaco (the thing under test) is isolated from reveal + app code.
        manualChunks: {
          monaco: ['monaco-editor'],
          reveal: ['reveal.js'],
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },
  // Monaco ships its worker via a `?worker` import (see src/lib/monacoSetup.ts).
  // Vite handles the worker build natively; no extra plugin needed. We only
  // wire the base editor worker (deck-markdown is a custom Monarch language
  // with no language service worker), which keeps the bundle trimmed.
  worker: {
    format: 'es',
  },
  server: {
    port: 5174,
    open: false,
    fs: {
      // Allow Vite to serve workspace-root files so @deckpilot/core, the viewer
      // source, and the extension provider load via /@fs/... in dev mode.
      allow: [path.resolve(__dirname, '../..')],
    },
  },
});
