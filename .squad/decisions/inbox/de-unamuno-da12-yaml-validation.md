# DA-12: Malformed Sidecar YAML → Editor Diagnostics

**Author:** De Unamuno  
**Date:** 2026-04-22  
**Status:** ✅ Implemented  
**Commit:** `feat(parser): surface malformed sidecar YAML as editor diagnostics (DA-12)`

---

## What Was Built

`validateSidecarSchema(sidecarContent: string): SlideDiagnosticResult[]` in `src/parser/deckValidator.ts`.

Takes the raw `.deck.yaml` string and returns structured diagnostics — no VS Code imports, runs outside the extension host.

### Diagnostics produced

| Condition | Severity | Detail |
|-----------|----------|--------|
| YAML syntax error | Error | Includes js-yaml error message; line number from `YAMLException.mark.line` (0-based) |
| Top-level not a mapping (scalar or sequence) | Error | Stops further checks |
| Unknown top-level key | Warning | Lists allowed keys: `deck`, `slides`, `recording`, `export` |
| Slide entry missing `id` field | Error | `slides[N] is missing a required 'id' field` |

### `loadSidecar` contract change

`loadSidecar()` now returns `null` instead of throwing on:
- YAML syntax errors
- Top-level structure is not a mapping

Schema violations (missing slide ids) no longer cause any throw — `loadSidecar` returns the best-effort parsed object and `validateSidecarSchema` surfaces the issue as a diagnostic.

---

## Architectural Decisions

### `SlideDiagnosticResult` not `vscode.Diagnostic`

`deckValidator.ts` deliberately has NO vscode import. All validation functions are pure TypeScript that can run in any context (tests, language server, background worker). Extension.ts is responsible for converting `SlideDiagnosticResult` → `vscode.Diagnostic` when attaching to a `DiagnosticCollection`.

This is consistent with `validateSlideIds` (DA-11) and `validateSidecarSlideIds` (DA-10).

### Lenient loadSidecar vs strict validateSidecarSchema

The division of responsibility:
- `loadSidecar` = best-effort parse, returns null only when completely unreadable
- `validateSidecarSchema` = full diagnostic audit, tells the author exactly what's wrong

This allows callers to get _something_ from the file (for merging) even when it has schema issues, while still surfacing diagnostics to the editor.

---

## Next Step for Full Editor Integration

`validateSidecarSchema` is exported but not yet wired to a `vscode.DiagnosticCollection`. The connection point is `extension.ts`, where a `workspace.createFileSystemWatcher('**/*.deck.yaml')` listener should:

1. Read the `.deck.yaml` raw content
2. Call `validateSidecarSchema(rawContent)`
3. Convert each `SlideDiagnosticResult` to `vscode.Diagnostic`
4. Set on a `vscode.languages.createDiagnosticCollection('deckpilot-sidecar')`

This is a future DA task (DA-13 or similar).

---

## Test Coverage

18 new tests in `test/unit/parser/deckValidator.test.ts` under the `validateSidecarSchema() unit (DA-12)` describe block. All passing.

6 pre-existing `sidecarLoader.test.ts` tests updated from throw-expectation to null/non-null return assertions.

Full suite: **745 passing, 0 failing**.
