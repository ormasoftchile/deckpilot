# DA-11 — Duplicate Explicit Slide ID Validation

**Author:** De Unamuno  
**Date:** 2026-04-22  
**Task:** DA-11  
**Status:** ✅ Implemented

---

## What was done

Added runtime detection of duplicate explicitly-declared slide IDs to the parser pipeline.

**Files changed:**
- `src/models/slide.ts` — added `idExplicit?: boolean` to `Slide` interface
- `src/parser/slideParser.ts` — sets `idExplicit`, calls `validateSlideIds`, exposes `getLastValidationDiagnostics()`
- `src/parser/deckValidator.ts` — `validateSlideIds()` already present from setup; no changes needed
- `src/parser/index.ts` — `getLastValidationDiagnostics` + `validateSlideIds` exports already present

---

## Design decisions

### `idExplicit` field on Slide (not a separate tracking structure)

Adding `idExplicit?: boolean` directly to the `Slide` model was the most ergonomic approach. Alternatives considered:
- A separate `idSource: 'comment' | 'frontmatter' | 'heading' | 'positional'` enum — more expressive, but more fields than needed for the duplicate-detection use case
- Calling the validator before ID assignment using raw content scanning — fragile and would duplicate parser logic

`idExplicit` is set in two places:
1. `parseSlideContent()` when `commentId !== undefined` (priority 1 — HTML comment)
2. `parseSlides()` loop when `frontmatter.id` drove `generateSlideId` (priority 2 — frontmatter)

### Validator runs before `resolveUniqueIds`

`validateSlideIds` must be called before `resolveUniqueIds` because uniquification renames the second occurrence of a duplicate in place. After that call, the collision is no longer detectable from slide state alone.

### Range anchored to line 0

`Slide` carries no `lineStart`/`lineEnd` source position today. All diagnostics are anchored to line 0, character 0. Precise ranges require a future "position tracking" PR that adds `lineStart?: number` (or similar) to the model.

### Return type: `SlideDiagnosticResult[]` not `vscode.Diagnostic[]`

Consistent with the existing `DiagnosticResult` pattern in `actionDiagnosticProvider.ts` — parser layer stays vscode-free. Extension.ts maps `SlideDiagnosticResult` → `vscode.Diagnostic` using the same converter shape already wired for action diagnostics.

---

## Collision rules

| Slide A `idExplicit` | Slide B `idExplicit` | Action |
|----------------------|----------------------|--------|
| true | true | ERROR — two authors wrote the same id |
| true | false | ERROR — explicit id collides with auto-derived slug |
| false | true | ERROR — auto-derived slug collides with explicit id |
| false | false | silent — handled by `resolveUniqueIds` |

---

## Test coverage

21 tests across two suites in `test/unit/parser/deckValidator.test.ts`:

**Unit (direct):** 12 tests
- Unique explicit IDs → no diagnostics
- Duplicate auto-generated → no diagnostics
- Two explicit same ID → 1 diagnostic
- Explicit vs auto-generated collision (both orderings)
- 3-way duplicate → 2 diagnostics
- Undefined id → no crash
- Severity = Error (0)
- Source = "Deckpilot"
- Range = line 0

**Integration (via parseSlides):** 9 tests
- HTML-comment duplicate detected end-to-end
- Frontmatter duplicate detected end-to-end
- Heading-slug duplicates NOT flagged
- Diagnostics reset between calls
- `idExplicit = true` for comment IDs
- `idExplicit = true` for frontmatter IDs
- `idExplicit` falsy for heading-slug IDs
- `idExplicit` falsy for positional-fallback IDs

---

## Follow-up items

1. **Position tracking** — Add `lineStart?: number` to `Slide` so diagnostics can point to the exact `<!-- id: -->` line instead of line 0. Deferred (separate PR scope).
2. **`sidecarLoader.test.ts` loadSidecar tests** — A `git stash` during this session accidentally truncated the file to its committed state. The uncommitted `loadSidecar` validation tests (for DA-04 continuation) need to be re-added by the DA-04 owner.
