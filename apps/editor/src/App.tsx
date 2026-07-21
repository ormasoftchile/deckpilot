/**
 * App — the split-pane editor shell.
 *
 *   ┌──────────────────────────────────────────────┐
 *   │ toolbar                                        │
 *   ├───────────────────────┬────────────────────────┤
 *   │ Monaco (deck-markdown) │ live deck preview      │
 *   │  left                  │  (viewer DeckViewer)   │
 *   └───────────────────────┴────────────────────────┘
 *
 * Edits are debounced ~250ms before re-parsing, then the preview updates IN
 * PLACE — `PreviewPane` hosts ONE persistent Reveal instance and syncs new
 * content onto it (no teardown, no remount), so typing never flashes.
 */
import { useCallback, useRef, useState } from 'react';
import { EditorPane } from './components/EditorPane';
import { PreviewPane } from './components/PreviewPane';

const DEBOUNCE_MS = 250;

const STARTER_DECK = `---
title: Editor Spike
author: De Vega
slideBreak: heading
---

# Deckpilot Editor Spike

A **live preview** powered by the *real* viewer render pipeline.

- Type in the left pane — the right pane re-renders after you pause.
- Inline action links are highlighted: [Open README](action:file.open?path=README.md)
- Fenced diagrams work too (\`\`\`mermaid / \`\`\`triton / \`\`\`diagram:*).

---

## Real completions

Put your cursor inside the \`action\` block below, add a new line, and type
\`type: \` — completions come straight from the shared **ACTION_SCHEMAS**.

\`\`\`action
type: terminal.run
command: echo "hello from deckpilot"
\`\`\`
`;

export function App(): JSX.Element {
  const [text, setText] = useState<string>(STARTER_DECK);
  const timerRef = useRef<number | undefined>(undefined);

  const handleChange = useCallback((value: string) => {
    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      setText(value);
    }, DEBOUNCE_MS);
  }, []);

  return (
    <div className="dp-app">
      <header className="dp-toolbar">
        <span className="dp-brand">Deckpilot&nbsp;Editor</span>
        <span className="dp-tag">spike · v{__DECKPILOT_VERSION__}</span>
      </header>
      <div className="dp-split">
        <section className="dp-pane dp-pane-editor" aria-label="Deck source">
          <EditorPane initialValue={STARTER_DECK} onChange={handleChange} />
        </section>
        <section className="dp-pane dp-pane-preview" aria-label="Live preview">
          <PreviewPane text={text} />
        </section>
      </div>
    </div>
  );
}
