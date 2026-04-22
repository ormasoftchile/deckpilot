# DA-16 Findings — Merge Engine Test Audit

**Author:** Delibes  
**Date:** 2026-06-12  
**Related DA:** DA-05 (merge engine), DA-11 (duplicate ID detection), DA-12 (sidecar schema validation)

---

## 1. `onEnterActions` population is untested

**File:** `src/parser/mergeEngine.ts`  
**Lines:** 61–67

```typescript
if (sidecarSlide.actions !== undefined) {
  merged.sidecarActions = sidecarSlide.actions;          // stored raw
  if (merged.onEnterActions.length === 0) {
    merged.onEnterActions = mapSidecarActions(sidecarSlide.actions, slide.index);  // ← untested
  }
}
```

The DA-05 and DA-16 tests verify that `sidecarActions` is populated from the sidecar, but neither test suite verifies that `onEnterActions` is populated (or preserved) correctly. Specifically uncovered:

- `onEnterActions` is populated from sidecar when slide has no inline actions
- `onEnterActions` is **not** overwritten when slide already has inline `onEnterActions`

**Risk:** Medium. The `mapSidecarActions` call is a non-trivial function (from DA-07) and this path has zero regression protection.

**Recommended action:** Add two tests to `mergeEngine.test.ts` under `sidecarActions merging`:
1. `populates onEnterActions from sidecar actions when slide has none`
2. `does not overwrite existing onEnterActions when slide has inline actions`

---

## 2. `deckValidator.ts` / `deckValidator.test.ts` — untracked files with compilation errors

**Files (both untracked):**
- `src/parser/deckValidator.ts`
- `test/unit/parser/deckValidator.test.ts`

**Errors found:**

### a. `getLastValidationDiagnostics` not exported from `slideParser.ts`

`deckValidator.test.ts` line 13 imports:
```typescript
import { parseSlides, getLastValidationDiagnostics } from '../../../src/parser/slideParser';
```

`getLastValidationDiagnostics` does not exist in `slideParser.ts`. The integration test suite (DA-11/DA-12) for deckValidator cannot compile until this export is added or the import is removed.

### b. `Slide.idExplicit` missing in test's imported type

`deckValidator.test.ts` lines 225, 244, 249, 255 access `slide.idExplicit`. The field exists in `src/models/slide.ts` (line 73). The compilation error `TS2339: Property 'idExplicit' does not exist on type 'Slide'` suggests a path resolution or module cache issue rather than a genuine missing field — but it blocks compilation.

### c. ts-node compile-cache instability

When `deckValidator.ts` is present in the working directory with compilation errors, ts-node can flip between succeeding (from cache) and throwing `Exception during run` on consecutive `npm run test:unit` invocations. The merge-engine tests are always clean in isolation; the instability is entirely localised to the untracked deckValidator files.

**Recommended action for DA-11/DA-12 owner:**
1. Implement `getLastValidationDiagnostics()` in `slideParser.ts` and export it, OR remove the integration test import and use only unit-level tests.
2. Commit `deckValidator.ts` and `deckValidator.test.ts` together once they compile cleanly.

---

## 3. Minor: `validateSidecarSchema` imports `js-yaml` but `yaml` not declared as a module-level `const`

**File:** `src/parser/deckValidator.ts` line 10:
```typescript
import * as yaml from 'js-yaml';
```

This import is correct and `js-yaml` is in `dependencies`. However the ts-node error `TS2304: Cannot find name 'yaml'` at line 168 suggests the import is somehow shadowed or the file is compiled in a context where it's not visible. This may be a ts-node caching artefact rather than a real bug — worth verifying with a clean `tsc --noEmit` run.
