# DA-15 Findings: Sidecar Loader Tests

**Author:** Delibes  
**Date:** 2026-06-12  
**Task:** DA-15 — Write sidecar loader unit tests  

---

## Issues Found During Testing

### 1. `deckValidator.ts` — Missing `yaml` import (Bug)

**File:** `src/parser/deckValidator.ts`  
**Severity:** Compilation blocker  
**Status:** Fixed by Delibes as part of DA-15 (the test suite could not compile without it)

`validateSidecarSchema()` calls `yaml.load(sidecarContent)` but the `import * as yaml from 'js-yaml'` statement was absent from the file. TypeScript compiler reported:

```
error TS2304: Cannot find name 'yaml'.
```

**Fix applied:** Added `import * as yaml from 'js-yaml';` to the top of `deckValidator.ts`.

---

### 2. `deckValidator.ts` — Duplicate `validateSidecarSlideIds` function name (Pre-existing, already resolved)

The view tool initially showed an older version of the file with two `validateSidecarSlideIds` functions. On inspection, the actual file on disk had already renamed the internal helper to `validateSidecarSlideIdPresence`. The `yaml` import was the only real outstanding issue.

---

### 3. `sidecarActionMapper.test.ts` — `sinon` not in devDependencies

**File:** `test/unit/parser/sidecarActionMapper.test.ts`  
**Severity:** Compilation blocker (missing package)  
**Status:** Fixed by Delibes — installed `sinon` and `@types/sinon` as devDependencies

`sidecarActionMapper.test.ts` imports `sinon` for `console.warn` stubbing but it was not in `package.json`. Test suite could not compile.

---

### 4. `test/unit/parser/deckValidator.test.ts` — Imports non-existent `getLastValidationDiagnostics`

**File:** `test/unit/parser/deckValidator.test.ts` line 13  
**Severity:** Would fail at runtime (not blocking because TypeScript compiler ran through it)  
**Status:** Not fixed — requires DA-11 integration implementation  

```ts
import { parseSlides, getLastValidationDiagnostics } from '../../../src/parser/slideParser';
```

`getLastValidationDiagnostics` does not exist in `slideParser.ts`. This function is referenced in the DA-11 integration section of `deckValidator.test.ts`. The implementation (storing last validation diagnostics on the parser level) has not been built yet.

**Recommendation:** Either implement `getLastValidationDiagnostics` in `slideParser.ts` (DA-11 integration path) or skip those tests with a `// TODO: DA-11` comment until the feature lands.

---

### 5. `test/unit/parser/mergeEngine.test.ts` — 2 failing tests (DA-07 wiring incomplete)

**Tests:**
- `populates onEnterActions from sidecar actions (DA-07)`
- `assigns the correct slideIndex to mapped actions`

These tests expect `mergeEngine` to populate `slide.onEnterActions` from `sidecar.slides[n].actions` via the `sidecarActionMapper`. The assertions fail because `mergeSidecarIntoSlides` returns empty `onEnterActions` arrays.

**Root cause:** The merge engine exists but the sidecar-to-action mapping integration between `mergeEngine` and `sidecarActionMapper` is not wired up. DA-07 implementation is incomplete.

**Recommendation:** Wire `mapSidecarActions()` into `mergeSidecarIntoSlides()` for the `actions` field on each slide entry.

---

## `loadSidecar` Behaviour — Documented Contract

| Scenario | Expected return |
|---|---|
| No `.deck.yaml` exists | `null` |
| `.deck.yaml` is empty | `{}` (empty object, not null) |
| `.deck.yaml` is whitespace only | `{}` |
| `.deck.yaml` is valid YAML mapping | Parsed `SidecarFile` |
| `.deck.yaml` is a YAML sequence | `Error`: "must be a YAML mapping at the top level" |
| `.deck.yaml` has invalid YAML syntax | `Error`: "Failed to parse sidecar 'X.deck.yaml': ..." |
| Slide entry missing `id` | `Error`: "Sidecar 'X.deck.yaml': slides[N] is missing a required 'id' field" |
| Slide entry has empty string `id` | Same error as missing (caught by `.trim() === ''`) |
| Unknown top-level or slide fields | Passed through silently — extensible schema |
