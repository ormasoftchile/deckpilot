# Session Log: `<pre>` Fragment Eligibility Fix

**Timestamp:** 2026-06-12T00:00:00Z  
**Agent:** De Unamuno  
**Focus:** Add `<pre>` (code block) to fragment-eligible elements in `fragmentProcessor.ts`

---

## What Was Done

**Problem:** `<pre>` elements were not in the fragment-eligible set. On slides with code blocks followed by explanatory text, the code block appeared immediately visible while the explanatory paragraph was a fragment step. This reversed the intended reveal order — code appeared before its explanation.

**Fix:** Added `<pre>` to `tagEligibleElements()` in `src/parser/fragmentProcessor.ts`:
- Phase 1: Added `<pre>` replacement block between `li` and `render-block` sections.
- Phase 2: Added `pre` to the lazy regex alternation group: `(<(?:li|p|h[2-6]|blockquote|table|div|pre)\b[^>]*?)`.
- Updated file header comments and `tagEligibleElements()` docstring to include `<pre>`.

**Tests added** (5 new tests in `processFragments — pre (code blocks)` describe block):
1. Bare `<pre>` becomes a fragment step.
2. `<pre>` after `<p>` fragments AFTER the paragraph (correct reveal order).
3. `<pre>` with data attributes works correctly.
4. Multiple `<pre>` blocks each become separate fragment steps.
5. Uses fade animation by default.

**SRT snapshots regenerated** (3 files, using `UPDATE_SNAPSHOTS=1`):
- `test/fixtures/srt-snapshots/showcase.srt`
- `test/fixtures/srt-snapshots/showcase-web.srt`
- `test/fixtures/srt-snapshots/sidecar-demo.srt`

---

## Known Limitation Documented

If a `<pre>` tag has an existing `class=` attribute (e.g., `<pre class="foo">`), Phase 1 inserts `__frag` immediately after the tag name. Phase 2's lazy regex does not trigger the class-merge logic, producing a duplicate `class=` attribute.

In practice, markdown-it always places the language class on `<code>`, not `<pre>`, so this edge case does not arise in normal deck authoring. Consistent with the same limitation for all other non-slide-group elements.

---

## Outcome

- **Test baseline:** 867 passing, 0 failing (was 831 before this session).
- **Requested by:** Rodrigo
- **Decision filed:** `.squad/decisions/inbox/de-unamuno-pre-fragment.md`
