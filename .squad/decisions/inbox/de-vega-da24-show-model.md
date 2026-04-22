# DA-24 — Show Resolved Deck Model: Virtual Document Pattern

**Author:** De Vega  
**Date:** 2026-06-12  
**Status:** ✅ Implemented

## Decision

To display a read-only, syntax-highlighted JSON view of the merged `Deck` model without touching the filesystem, we use VS Code's `TextDocumentContentProvider` API on a custom URI scheme (`deckpilot-model:`).

## Virtual Document Pattern Used

```
vscode.workspace.registerTextDocumentContentProvider('deckpilot-model', provider)
```

1. **Provider class** (`DeckModelContentProvider`) holds a `Map<string, string>` keyed by URI path.
2. **On command invocation:** parse deck → JSON-serialize → call `provider.update(uri, json)` → `onDidChange.fire(uri)`.
3. **Open the document:** `vscode.workspace.openTextDocument(uri)` — VS Code calls `provideTextDocumentContent(uri)` which reads from the map.
4. **Set language:** `vscode.languages.setTextDocumentLanguage(doc, 'json')` after open — required because virtual docs default to `plaintext`.
5. **Open in editor:** `vscode.window.showTextDocument(doc, { preview: true })`.

## Why Not Write to Disk?

- Virtual documents are faster, don't pollute the project directory, and are immediately discardable.
- Consistent with VS Code authoring conventions (e.g., git diff views, TypeScript declaration previews).

## JSON Safety

Circular references are caught with a `seen` Set in the replacer function. Functions are stripped (`return undefined`). This keeps the output valid JSON regardless of what the `Deck` model accumulates.

## Limitations

- The document re-uses the same URI per filename — calling the command twice on the same file updates the existing tab (via `onDidChange`), rather than opening a second tab. This is intentional.
- No auto-refresh on file save; the command must be re-invoked manually.
