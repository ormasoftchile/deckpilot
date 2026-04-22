# DA-20: Nested Merge Strategy for recording/export in DeckMetadata

**Author:** De Unamuno  
**Date:** 2026-04-22  
**Task:** DA-20 — Recording/Export Merge into DeckMetadata

## What was decided

### 1. DeckMetadata carries inline type declarations (no sidecar import)

`DeckMetadata.recording` and `DeckMetadata.export` are declared with their own inline types rather than importing `SidecarRecording`/`SidecarExport` from `src/models/sidecar.ts`. This was explicitly called for in the task brief to keep the core deck model free of sidecar-layer dependencies.

The shapes are structural mirrors — if `SidecarRecording` gains a new field in the future, `DeckMetadata.recording` will need a parallel update. This is an acceptable trade-off: the sidecar model is the source of truth for authoring; `DeckMetadata` is the consumed runtime shape.

### 2. Spread-based field-by-field merge

The merge uses `{ ...sidecarSection, ...(inlineSection ?? {}) }` rather than explicit field-by-field conditionals.

**Why spread over explicit conditionals:**
- Less code, less chance of missing a field when `SidecarRecording`/`SidecarExport` gain new fields in future tasks (e.g., DA-21 env types)
- Correct for this pipeline: YAML parsing and frontmatter parsing both omit absent keys — they never produce `{ key: undefined }` objects. So `inlineSection` only contains fields that were actually authored, and its spread correctly overwrites only those fields.
- The explicit conditional pattern (`if (field !== undefined && merged.field === undefined)`) used for scalar fields (title, theme) remains preferable for top-level scalars because it's readable. For nested objects with 5-6 fields, spread is the idiomatic choice.

**Caveat documented:** If TypeScript code explicitly sets a nested field to `undefined` (e.g., `metadata.recording = { outputDir: undefined }`), the spread would overwrite the sidecar's value with `undefined`. This is not a realistic risk in the current pipeline but worth knowing.

### 3. Early-return guard restructured

The original `if (!sidecar.deck) { return metadata; }` guard was restructured to `if (!sidecar.deck && !sidecar.recording && !sidecar.export) { return metadata; }`.

This preserves the optimisation (no copy when nothing to merge) while allowing `recording`/`export` sections to merge even when a sidecar file has no `deck:` section — which is a valid and common authoring pattern (e.g., a sidecar that only configures recording settings without overriding deck title/theme).

### 4. No-op tests still pass with same reference identity

Existing tests assert `result === metadata` (same reference) for no-op inputs (`{}`, `{ slides: [] }`). The restructured guard still returns `metadata` directly for these inputs because neither `recording` nor `export` is present in those sidecars. The contract is preserved.
