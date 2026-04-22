# DA-21 — Environment/Platform Override Types

**Author:** Cervantes  
**Date:** 2025-07-23  
**Status:** ✅ Done — 788 tests passing, committed `eec862e`

## What Was Done

1. **`SidecarEnvironment` interface** added to `src/models/sidecar.ts` (confirmed already present from DA-19 wave; `environment` field wired onto `SidecarFile`).
2. **`KNOWN_SIDECAR_KEYS`** in `src/parser/deckValidator.ts` updated — `'environment'` added to the Set so `validateSidecarSchema()` no longer emits a spurious warning for decks that declare an `environment:` block.
3. **Diagnostic message** updated to list `environment` in the "expected one of:" hint string.

## Design Decisions

### Platform Key Names

Keys are `darwin`, `linux`, `win32` — exact values returned by Node.js `process.platform`. No aliasing (e.g., `macos`, `windows`). Rationale: consumers read the platform directly from `process.platform` and use it as a lookup key with no translation layer. Aliasing would require a mapping table and introduce a new failure mode.

### `common` vs `platform`

`common` applies environment variables shared across all platforms. `platform` applies per-OS overrides. Merge semantics (common-first, platform-second, platform wins on collision) are a DA-22 concern — this DA only establishes the types.

### Validator is Permissive

`validateSidecarSchema` treats unknown keys as `Warning`, not `Error`. Adding `environment` to the allowlist simply removes the warning for a now-known key. The approach stays permissive: authors can still add experimental keys without blocking deck load.

### `Record<string, string>` not `Record<string, unknown>`

Environment variables are always string→string. `Record<string, string>` is the correct type and matches `process.env` semantics. Consumers do not need to coerce values.

## What Was Not Added

- Merge/resolution logic — that is DA-22 (`envResolver.ts`).
- Validation of `environment` sub-keys (e.g., unknown platform names) — low value, deferred.
