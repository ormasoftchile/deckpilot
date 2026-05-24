/**
 * collectWatchPaths — derive the set of files whose changes should trigger a
 * preview refresh: sidecar, env file, optional `content:` import, and every
 * `render:file` / `render:diff` path referenced from any slide body.
 *
 * Paths are returned as absolute, normalized strings. Missing/unresolvable
 * references are skipped (the watcher attaches anyway and will fire if/when
 * the file appears).
 */

import * as path from 'path';
import type { Deck } from '@deckpilot/core/models/deck';
import { parseRenderDirectives } from '@deckpilot/core/renderer/renderDirectiveParser';

export function collectWatchPaths(deck: Deck): string[] {
  const deckPath = deck.filePath;
  const deckDir = path.dirname(deckPath);
  const out = new Set<string>();

  // Sidecar + env file follow the deck.md naming convention.
  if (deckPath.endsWith('.deck.md')) {
    out.add(deckPath.replace(/\.deck\.md$/, '.deck.yaml'));
    out.add(deckPath.replace(/\.deck\.md$/, '.deck.env'));
  }

  // content: import — wrapper's body is replaced by the imported file's body.
  const contentImport = typeof deck.metadata?.content === 'string'
    ? deck.metadata.content.trim()
    : '';
  if (contentImport) {
    const resolved = path.isAbsolute(contentImport)
      ? contentImport
      : path.resolve(deckDir, contentImport);
    out.add(resolved);
  }

  // render:file / render:diff path params, re-parsed from each slide body.
  for (const slide of deck.slides) {
    if (!slide.renderDirectives || slide.renderDirectives.length === 0) {
      continue;
    }
    const directives = parseRenderDirectives(slide.content, slide.index);
    for (const d of directives) {
      if (d.type === 'file' && typeof d.params.path === 'string') {
        out.add(resolveDeckRelative(deckDir, d.params.path));
      } else if (d.type === 'diff') {
        // Note: `before`/`after` are git refs (e.g. HEAD~1), not file paths.
        const candidates = [d.params.path, d.params.left, d.params.right];
        for (const c of candidates) {
          if (typeof c === 'string') {
            out.add(resolveDeckRelative(deckDir, c));
          }
        }
      }
      // render:command intentionally not watched — it isn't executed in preview.
    }
  }

  return [...out];
}

function resolveDeckRelative(deckDir: string, p: string): string {
  return path.isAbsolute(p) ? path.normalize(p) : path.resolve(deckDir, p);
}
