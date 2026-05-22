import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Workspace package — resolve to source for HMR/typecheck
      '@deckpilot/core': path.resolve(__dirname, '../../packages/core/src'),
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
  },
});
