/**
 * Completion adapter — bridges Monaco's CompletionItemProvider to the REAL
 * `ActionCompletionProvider` from the VS Code extension.
 *
 * IMPORTANT: this is a THIN adapter. All completion *logic* (schema lookups,
 * action-block gating, param suggestions) lives in the extension provider,
 * which is imported verbatim via the `@extension-providers` alias. We only:
 *   1. present Monaco's ITextModel as the provider's duck-typed `document`,
 *   2. translate Monaco's 1-based Position to the provider's 0-based position,
 *   3. map returned items back to Monaco CompletionItems (kind + range).
 *
 * Reuse boundary: the extension provider only fires inside ```action fenced
 * blocks and the frontmatter scenes/env blocks. It does NOT (yet) complete
 * inline `[label](action:...)` links — that would be NEW logic and belongs to
 * a future `@deckpilot/language` package, not this spike. See the decision
 * note for the flagged discrepancy.
 */
import type * as MonacoNS from 'monaco-editor/esm/vs/editor/editor.api';
import { ActionCompletionProvider } from '@extension-providers/actionCompletionProvider';

/** vscode.CompletionItemKind numbers the extension provider emits. */
const VSCODE_KIND = {
  Property: 9,
  Value: 12,
  Snippet: 14,
  File: 16,
} as const;

function mapKind(
  monaco: typeof MonacoNS,
  vscodeKind: number,
): MonacoNS.languages.CompletionItemKind {
  const K = monaco.languages.CompletionItemKind;
  switch (vscodeKind) {
    case VSCODE_KIND.Property:
      return K.Property;
    case VSCODE_KIND.Value:
      return K.Value;
    case VSCODE_KIND.Snippet:
      return K.Snippet;
    case VSCODE_KIND.File:
      return K.File;
    default:
      return K.Text;
  }
}

export function createDeckCompletionProvider(
  monaco: typeof MonacoNS,
): MonacoNS.languages.CompletionItemProvider {
  const provider = new ActionCompletionProvider();

  return {
    triggerCharacters: [...provider.triggerCharacters, ' ', '('],

    provideCompletionItems(model, position): MonacoNS.languages.CompletionList {
      // Present Monaco's model as the provider's duck-typed document.
      // The provider is 0-based for lines; Monaco is 1-based.
      const document = {
        lineCount: model.getLineCount(),
        lineAt(line: number): { text: string } {
          return { text: model.getLineContent(line + 1) };
        },
        getText(): string {
          return model.getValue();
        },
      };

      const pos = { line: position.lineNumber - 1, character: position.column - 1 };

      const rawItems = provider.provideCompletionItems(document, pos, undefined, undefined);
      if (!rawItems || rawItems.length === 0) {
        return { suggestions: [] };
      }

      // Default replace range: the word Monaco thinks we're editing.
      const word = model.getWordUntilPosition(position);
      const defaultRange = new monaco.Range(
        position.lineNumber,
        word.startColumn,
        position.lineNumber,
        word.endColumn,
      );

      const suggestions: MonacoNS.languages.CompletionItem[] = rawItems.map((item) => {
        const range = item.range
          ? new monaco.Range(
              item.range.startLine + 1,
              item.range.startChar + 1,
              item.range.endLine + 1,
              item.range.endChar + 1,
            )
          : defaultRange;

        return {
          label: item.label,
          kind: mapKind(monaco, item.kind),
          detail: item.detail,
          documentation: item.documentation,
          insertText: item.insertText ?? item.label,
          sortText: item.sortText,
          filterText: item.label,
          range,
        };
      });

      return { suggestions };
    },
  };
}
