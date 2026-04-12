import { defineConfig } from 'vite';
import path from 'path';
import fs from 'fs';

const workspaceRoot = path.resolve(__dirname, '../..');

export default defineConfig({
  resolve: {
    alias: {
      vscode: path.resolve(__dirname, 'src/stubs/vscode.ts'),
      child_process: path.resolve(__dirname, 'src/stubs/child_process.ts'),
      path: path.resolve(__dirname, 'src/stubs/path.ts'),
      'gray-matter': path.resolve(__dirname, 'src/stubs/gray-matter.ts'),
    },
  },
  plugins: [
    {
      // All imports from renderDirectiveParser.ts are TypeScript interfaces/types.
      // esbuild strips them, but Vite dev server (native ESM) still tries to resolve
      // the named exports at link time, causing "does not provide an export named X".
      // Fix: in any file that imports from renderDirectiveParser, rewrite those imports
      // to use `import type` so esbuild treats them as erased.
      name: 'fix-type-only-reexports',
      transform(code, id) {
        if (!id.includes('/src/renderer/')) return null;
        // Rewrite: import { Foo, Bar } from './renderDirectiveParser'
        // to:      import type { Foo, Bar } from './renderDirectiveParser'
        return code.replace(
          /\bimport\s*\{([^}]+)\}\s*from\s*(['"])\.\/renderDirectiveParser\2/g,
          (_m, names: string, q: string) => `import type {${names}} from ${q}./renderDirectiveParser${q}`
        );
      },
    },
    {
      name: 'deck-api',
      configureServer(server) {
        // Serve file contents for the parser
        server.middlewares.use('/api/file', (req, res) => {
          const url = new URL(req.url!, `http://localhost`);
          const filePath = url.searchParams.get('path');
          if (!filePath) {
            res.statusCode = 400;
            res.end('Missing path parameter');
            return;
          }
          // Security: only allow files within the workspace root
          const resolved = path.resolve(workspaceRoot, filePath);
          if (!resolved.startsWith(workspaceRoot + path.sep) && resolved !== workspaceRoot) {
            res.statusCode = 403;
            res.end('Forbidden');
            return;
          }
          try {
            const content = fs.readFileSync(resolved, 'utf-8');
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.end(content);
          } catch {
            res.statusCode = 404;
            res.end('File not found');
          }
        });

        // List all .deck.md files in the workspace
        server.middlewares.use('/api/decks', (_req, res) => {
          const decks: string[] = [];
          function walk(dir: string, rel: string) {
            let entries: fs.Dirent[];
            try {
              entries = fs.readdirSync(dir, { withFileTypes: true });
            } catch {
              return;
            }
            for (const entry of entries) {
              if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'out') continue;
              const fullPath = path.join(dir, entry.name);
              const relPath = path.join(rel, entry.name);
              if (entry.isDirectory()) {
                walk(fullPath, relPath);
              } else if (entry.name.endsWith('.deck.md')) {
                decks.push(relPath);
              }
            }
          }
          walk(workspaceRoot, '');
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(decks));
        });
      },
    },
  ],
  // Serve presentation.css and presentation.js from their source location
  publicDir: false,
  server: {
    fs: {
      allow: [workspaceRoot],
    },
  },
});
