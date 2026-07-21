/**
 * Monaco bootstrap for the Deckpilot editor spike.
 *
 * Responsibilities:
 *  1. Wire Monaco's web worker for Vite (the #1 integration risk). We import
 *     ONLY the base editor worker via Vite's `?worker` suffix. `deck-markdown`
 *     is a custom Monarch language with no language-service worker, so no
 *     ts/json/html/css workers are bundled — this is the deliberate trim.
 *  2. Register the `deck-markdown` language + Monarch tokenizer.
 *  3. Register ONE completion provider backed by the REAL `ACTION_SCHEMAS`
 *     (via the existing extension provider logic — see completionAdapter.ts).
 *
 * Trimmed entry point: importing from `monaco-editor/esm/vs/editor/editor.api`
 * (NOT the package root) pulls the editor + Monarch + completion API without
 * the full basic-languages bundle.
 */
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import { deckMarkdownLanguage, deckMarkdownConfiguration } from './deckMonarch';
import { createDeckCompletionProvider } from './completionAdapter';

export const DECK_LANGUAGE_ID = 'deck-markdown';

let configured = false;

/**
 * Idempotently configure Monaco (workers + language + providers) and return the
 * shared monaco namespace. Safe to call from every component mount.
 */
export function configureMonaco(): typeof monaco {
  if (configured) {
    return monaco;
  }
  configured = true;

  // The one line that makes-or-breaks Monaco-in-Vite: tell Monaco how to spawn
  // its worker. A single base editor worker, same-origin, no CDN, no eval.
  (self as typeof globalThis & { MonacoEnvironment?: monaco.Environment }).MonacoEnvironment = {
    getWorker(): Worker {
      return new EditorWorker();
    },
  };

  monaco.languages.register({
    id: DECK_LANGUAGE_ID,
    extensions: ['.deck.md'],
    aliases: ['Deck Markdown', 'deck-markdown'],
  });
  monaco.languages.setMonarchTokensProvider(DECK_LANGUAGE_ID, deckMarkdownLanguage);
  monaco.languages.setLanguageConfiguration(DECK_LANGUAGE_ID, deckMarkdownConfiguration);
  monaco.languages.registerCompletionItemProvider(
    DECK_LANGUAGE_ID,
    createDeckCompletionProvider(monaco),
  );

  return monaco;
}
