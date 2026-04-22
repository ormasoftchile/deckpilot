# DA-22 — Environment Override Resolution

**Author:** De Unamuno  
**Date:** 2026-06-12  
**Status:** ✅ Implemented

---

## Summary

`resolveEnvironment()` merges four environment layers into a single flat `Record<string, string>` for use at deck execution time. The resolved env is stored on `deck.resolvedEnvironment` after `parseDeck()` completes.

---

## Precedence Chain

Layers are applied lowest → highest (each layer overwrites the previous for the same key):

| Priority | Source | Notes |
|----------|--------|-------|
| 4 (base) | `process.env` | System/shell environment; `undefined` values excluded |
| 3 | `sidecar.environment.common` | Cross-platform author defaults |
| 2 | `sidecar.environment.platform[platform]` | Platform-specific overrides (`darwin`, `linux`, `win32`) |
| 1 (highest) | `.deck.env` file | Explicit user-managed values; always wins |

Example: if `NODE_ENV=development` is in `process.env`, `NODE_ENV=staging` in sidecar common, `NODE_ENV=production` in `.deck.env`, the resolved value is `production`.

---

## Injectable Platform Pattern

The resolved platform MUST NOT be hardcoded to `process.platform`. The signature is:

```typescript
export async function resolveEnvironment(
  deckPath: string,
  sidecar: SidecarFile | null,
  platform: NodeJS.Platform = process.platform,  // injectable for tests
): Promise<Record<string, string>>
```

This allows tests to assert darwin-vs-linux-vs-win32 behaviour deterministically without any process manipulation.

---

## Placement Decision

`resolveEnvironment` lives in `src/env/envMerger.ts` (not `src/parser/`). Rationale: it is an environment-layer concern that happens to be triggered from the parser. Keeping it in `src/env/` maintains the same separation as `EnvFileLoader` and `EnvResolver`.

---

## Unknown Platform Behaviour

The `SidecarEnvironment.platform` type only has keys for `darwin`, `linux`, `win32`. If `process.platform` is `freebsd` or any other value, the platform layer is silently skipped — no error, no warning. The common layer and `.deck.env` still apply normally.

---

## Deck Model Field

`resolvedEnvironment?: Record<string, string>` was added to the `Deck` interface. It is optional: if `resolveEnvironment` throws (non-fatal), the field is simply absent. Callers should guard with `deck.resolvedEnvironment ?? {}`.

---

## Integration Point

In `parseDeck()` (`src/parser/deckParser.ts`), after the sidecar is loaded, the sidecar reference is kept as `loadedSidecar` (outside the try/catch) so it can be passed to `resolveEnvironment`. The env resolution is wrapped in its own try/catch — failures surface as a missing `resolvedEnvironment` field, not as a deck load error.

---

## Test Coverage

15 unit tests in `test/unit/env/envMerger.test.ts` covering:
- Null sidecar (process.env + .deck.env only)
- Empty sidecar object
- Sidecar common layer
- Platform-specific layer for darwin / linux / win32
- Unknown platform (freebsd) → platform layer skipped
- Cross-platform key isolation (darwin key not visible on linux)
- Full four-layer precedence: `env_file > platform > common > process.env`
- Missing .deck.env file (graceful)
- Default platform parameter uses `process.platform`
