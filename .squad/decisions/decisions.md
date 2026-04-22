# Team Decisions

> Canonical decision log. Maintained by Scribe. Agents read this file for shared context.  
> Inbox files are merged here and deleted. Do not edit directly — drop decisions into `.squad/decisions/inbox/`.

---

### 2025-07-24: onEnterActions Timing — Acknowledgment-Based Render Wait

**By:** Cervantes  
**Status:** Implemented  

**What:** When navigating to a slide with `onEnterActions`, actions now wait for an explicit `slideRendered` acknowledgment from the webview before executing. Previously, actions fired before the slide was rendered/visible.

**Why:** Fixed backwards user experience where terminal commands ran before the slide text explaining them appeared. Fixed with acknowledgment-based approach (Option A) rather than a fixed delay — reliable regardless of render complexity, no fragile timing assumptions.

**Implementation:**
- `messages.ts` — added `SlideRenderedMessage` to protocol
- `messageHandler.ts` — added type guard and dispatcher case
- `webviewProvider.ts` — added `onSlideRendered` callback
- `presentation.js` — sends `slideRendered` at end of `handleSlideChanged()`
- `conductor.ts` — added `pendingSlideRender` field, `waitForSlideRender()`, `handleSlideRendered()`, modified `goToSlide()` to await render; 2-second safety timeout

**Trade-offs:** Latency minimal (sub-millisecond round-trip). Reliability high — explicit ack beats timing heuristics. Timeout is generous (2s); in practice render takes <50ms.

**Test baseline:** 857 passing, 0 failing.

---

### 2026-06-12: `<pre>` Added to Fragment-Eligible Elements

**By:** De Unamuno  
**Status:** Implemented  
**Requested by:** Rodrigo  

**What:** Added `<pre>` (code block) to the fragment-eligible set in `src/parser/fragmentProcessor.ts`. Code blocks now animate as fragment steps, revealing after preceding explanatory text.

**Why:** Before this fix, `<pre>` blocks appeared immediately visible while surrounding `<p>` text was a fragment step, causing reverse reveal order: code appeared before its explanation.

**Implementation:**
- `src/parser/fragmentProcessor.ts` — added `<pre>` replacement block in `tagEligibleElements()` (Phase 1), and `pre` to Phase 2 regex alternation group: `(<(?:li|p|h[2-6]|blockquote|table|div|pre)\b[^>]*?)`
- Updated header comments and docstring to document `<pre>` eligibility
- `test/unit/parser/fragmentProcessor.test.ts` — 5 new tests in `processFragments — pre (code blocks)` describe block
- SRT snapshots regenerated: `showcase.srt`, `showcase-web.srt`, `sidecar-demo.srt`

**Known limitation:** If `<pre>` has an existing `class=` attribute, Phase 2 regex does not trigger class-merge logic → duplicate `class=` attribute. In practice, markdown-it puts language class on `<code>`, not `<pre>`, so this does not arise in normal authoring. Same limitation applies to all non-slide-group elements.

**Test baseline:** 867 passing, 0 failing (was 831 before this fix).
