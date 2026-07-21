/**
 * EditorPane — mounts a single Monaco editor configured for `deck-markdown`.
 *
 * Monaco is mounted exactly once (empty dep array); the `onChange` callback is
 * held in a ref so parent re-renders never tear down / recreate the editor.
 * `automaticLayout` lets Monaco track the split-pane resize without a manual
 * ResizeObserver.
 */
import { useEffect, useRef } from 'react';
import type * as MonacoNS from 'monaco-editor/esm/vs/editor/editor.api';
import { configureMonaco, DECK_LANGUAGE_ID } from '../lib/monacoSetup';

interface EditorPaneProps {
  initialValue: string;
  onChange: (value: string) => void;
}

export function EditorPane({ initialValue, onChange }: EditorPaneProps): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<MonacoNS.editor.IStandaloneCodeEditor | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const monaco = configureMonaco();
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const model = monaco.editor.createModel(initialValue, DECK_LANGUAGE_ID);
    const editor = monaco.editor.create(host, {
      model,
      theme: 'vs-dark',
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 14,
      lineNumbers: 'on',
      wordWrap: 'on',
      scrollBeyondLastLine: false,
      renderWhitespace: 'boundary',
      quickSuggestions: { other: true, comments: false, strings: true },
      suggestOnTriggerCharacters: true,
      tabSize: 2,
    });
    editorRef.current = editor;

    const sub = model.onDidChangeContent(() => {
      onChangeRef.current(model.getValue());
    });

    // Emit the initial value so the preview renders on first paint.
    onChangeRef.current(model.getValue());

    return () => {
      sub.dispose();
      editor.dispose();
      model.dispose();
      editorRef.current = null;
    };
    // Mount once — initialValue is a seed, not a controlled prop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div className="dp-editor-host" ref={hostRef} />;
}
