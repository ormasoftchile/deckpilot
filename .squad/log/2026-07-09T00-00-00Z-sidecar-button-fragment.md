# Session Log: Sidecar Button Fragment Ordering Fix

**Timestamp:** 2026-07-09T00:00:00Z  
**Agent:** De Unamuno  
**Focus:** Fix sidecar action buttons to appear as the last fragment reveal step on a slide

---

## What Was Done

**Problem:** Sidecar action buttons (e.g. "Run: npm install") were appearing on slide entry, visible before any explanatory text or code blocks. Root causes were threefold:

1. `sidecarActionMapper.ts` set `fragment: false` on every sidecar element.
2. `buildButtonHtml()` emitted `data-no-fragment=""` when `fragment === false`, opting the `<p>` out of `processFragments`.
3. Even without `data-no-fragment`, sidecar injection happens in `parseDeck` *after* `processFragments` has already run in `parseSlideContent`, so sidecar elements could not be automatically fragmented by the existing pipeline.

**Fix — Option B (manual fragment index assignment at inject time):**

Rejected options:
- **Option A** (move sidecar injection before fragment processing): Required restructuring the async `parseDeck` / `parseSlides` pipeline — too disruptive.
- **Option C** (`__frag` sentinel before Phase 2): No available injection point between Phase 1 and Phase 2.

Chosen approach: in `injectBlockElements`, after building the block element section, scan the already-rendered HTML for the highest `data-fragment="N"` value. For each sidecar element with `fragment !== false`, emit `<p class="fragment" data-fragment="{N+1}" data-fragment-animation="fade">` via the new `buildSidecarFragmentButtonHtml()` helper. Consecutive sidecar elements each receive the next index (`N+1`, `N+2`, …).

---

## Files Changed

### `src/parser/sidecarActionMapper.ts`
- Changed `fragment: false` → `fragment: true` on all sidecar elements.

### `src/renderer/blockElementRenderer.ts`
- Added `buildSidecarFragmentButtonHtml(el, fragmentIndex)` — produces a fragment-annotated `<p>` with explicit `data-fragment` index.
- Updated `injectBlockElements` sidecar loop: scans `result` for max existing `data-fragment` index, then calls the new helper for each element with `fragment !== false`. Preserves `data-no-fragment` fallback when `fragment === false`.

### `src/parser/mergeEngine.ts`
- After merging sidecar elements into `merged.interactiveElements`, increments `merged.fragmentCount` by the count of sidecar elements with `fragment !== false`. Keeps Conductor and AutoPilot pacing correct — both use `slide.fragmentCount` to know total reveal steps.

---

## Tests Updated

- `test/unit/parser/sidecarActionMapper.test.ts`: Updated description + assertion (`fragment=false` → `fragment=true`).
- `test/unit/renderer/blockElementRenderer.test.ts`: Added `makeSidecarElement()` helper; 5 new tests covering fragment injection, consecutive index assignment, no-fragment fallback.
- SRT snapshot for `sidecar-demo` regenerated (timing adjusted: sidecar fragment step now correctly counted in total fragment count).

---

## Invariants Upheld

- Block elements (from ` ```action ` fences): unchanged — still fragmented naturally by `processFragments`.
- `data-no-fragment` on block elements: still honoured; `buildButtonHtml` path is unchanged.
- Sidecar elements with explicit `fragment: false`: still fall back to `data-no-fragment` (no regression for future use).
- `fragmentCount` updated in `mergeEngine`, not in `injectBlockElements` — render function stays pure (HTML in → HTML out); slide model remains single source of truth.

---

## Verification

Playwright test on `examples/sidecar-demo.deck.md`, Setup slide:

- Entry: "Setup" heading only ✅
- Space 1: paragraph text ✅
- Space 2: `npm install` code block ✅
- Space 3: "Run: npm install" button ✅

---

## Outcome

- **Test baseline:** 872 passing, 0 failing (was 867 before this session).
- **Requested by:** Rodrigo
- **Decision filed:** `.squad/decisions/inbox/de-unamuno-sidecar-button-fragment.md`
