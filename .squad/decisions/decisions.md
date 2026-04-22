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

---

### 2026-06-12: Showcase-Full Dual Authoring Example

**By:** De Unamuno  
**Status:** Implemented  
**Requested by:** Rodrigo  

**What:** Created canonical reference for dual authoring model with two new files:
- `examples/showcase-full.deck.md` — clean Markdown (content only, no action blocks, no voice cues, no notes in frontmatter)
- `examples/showcase-full.deck.yaml` — all operational metadata

**Why:** Establish clear separation of concerns: Markdown contains content; sidecar contains operational, narrative, and navigation metadata. Minimizes cognitive load for authors and enables tighter file diffing.

**Model Extensions** (non-breaking):

1. **`SidecarSlide.notes?: string`** — Speaker notes per-slide. Merge engine maps to `Slide.speakerNotes` (inline wins over sidecar).
2. **`SidecarDeck.basePath?: string`** — Mirrors `DeckMetadata.basePath`. Allows decks with no inline frontmatter to resolve relative file references via sidecar.
3. **`SidecarScene` + `SidecarFile.scenes?: SidecarScene[]`** — Navigation metadata (name + slide ID string). Typed and documented; merge wiring is a future DA item.

**Authoring Conventions:**
- `<!-- id: slug -->` comments — stay in Markdown (author intent signal)
- Layout directives (`:::center`, `:::columns`) — stay in Markdown (visual logic, not operational)
- `render:file` / `render:diff` links — stay in Markdown (content, always current)
- `action` fenced blocks — move to sidecar (operational, not content)
- `<!-- voice: ... -->` cues — move to sidecar as `cues[]` (narration metadata)
- `notes:` in separator — move to sidecar (speaker state, not audience content)
- `scenes:`, `basePath:`, `title:` — move to sidecar `deck:` (operational config)

**Field Name Decision:** `command` vs `cmd`
- Sidecar reads `cmd` and renames to `command` in params
- `command` written directly in YAML also works (via `buildParams` `...rest`)
- Showcase-full uses `command` (consistent with inline action block syntax)
- Existing `sidecar-demo.deck.yaml` uses `cmd`
- Both are valid and supported; recommend documenting both in authoring guide

**Test baseline:** 877 passing, 0 failing.

---

### 2026-06-12: Sidecar Command Routing

**By:** De Unamuno  
**Status:** ✅ Implemented

**What:** All deck-related commands now work when triggered from either `.deck.md` or `.deck.yaml` files.

**Why:** Deck commands previously only worked when active editor was `.deck.md`. Users editing the sidecar had to switch back to the `.deck.md` to trigger commands — poor UX. The relationship is deterministic: `foo.deck.yaml` always pairs with `foo.deck.md` in the same directory.

**Implementation Strategy:**

1. **Created `resolveDeckUri(editor)` helper** in `src/extension.ts`:
   - Takes `vscode.TextEditor | undefined`
   - Returns `.deck.md` URI if active file is `.deck.md` (unchanged behavior)
   - Returns derived `.deck.md` URI if active file is `.deck.yaml` AND paired `.deck.md` exists
   - Returns `undefined` if no active editor, file is neither type, or paired `.deck.md` missing

2. **Updated command handlers** to use `resolveDeckUri()`:
   - `executableTalk.openPresentation` — opens deck from sidecar
   - `executableTalk.validateDeck` — validates from sidecar
   - `deckpilot.extractMetadataToSidecar` — regenerates sidecar when triggered from existing `.deck.yaml`
   - `deckpilot.showResolvedDeckModel` — shows model when triggered from sidecar

3. **Error message strategy:**
   - Distinguishes between "no paired .deck.md file" (triggered from `.deck.yaml`) vs "open a .deck.md or .deck.yaml file first" (no deck-related file active)
   - Clear, actionable guidance for each failure mode

**Why Not Use VS Code `when` Clauses?**

No `package.json` changes were needed. Commands have no `when` clauses restricting them to `.deck.md` files — all restrictions were in command handlers. Adding `when` clauses would require regex filters but would only control command palette visibility, not command behavior. Handler-level routing is both simpler and more flexible.

**Trade-offs:**

✅ **Benefits:**
- Seamless UX: Users can trigger deck commands from either file without switching editors
- Consistent with dual authoring model: Sidecar files are first-class deck artifacts, not auxiliary
- No redundant logic: Single `resolveDeckUri` function encapsulates all file-resolution logic
- Clear error messaging: Users immediately understand what's missing (the paired `.deck.md`)

⚠️ **Limitations:**
- Synchronous file check: `fs.existsSync` in `resolveDeckUri` — but consistent with existing patterns and fast for single-file checks
- No support for detached sidecars: If `.deck.yaml` exists without `.deck.md`, commands fail gracefully with clear error (by design)

**Alternatives Considered:**
1. Duplicate command set → Rejected: Code duplication, confusing command palette, more keybindings
2. Quick Pick "Which file?" → Rejected: Unnecessary friction
3. Always prefer `.deck.md` if both open → Rejected: Violates principle of least surprise

**Related Work:**
- **DA-03:** `sidecarLoader.ts` established `resolveSidecarPath()` pattern
- **DA-06:** `parseDeck()` made async to auto-load sidecar
- **DA-23:** `extractMetadataToSidecar` command — regeneration use case

**Future Considerations:**
- Workspace Trust: Commands may eventually need trust checks — this routing layer is trust-agnostic
- Multi-root workspaces: `resolveDeckUri` already compatible (absolute paths)
- Virtual file systems: Would need `vscode.workspace.fs.stat()` instead of `fs.existsSync` if required

**Testing:**
- ✅ All 877 unit tests passing (no regressions)
- ✅ TypeScript strict mode ✅
- ✅ Manual verification pending: Open `.deck.yaml`, trigger "Start Presentation" from command palette

**Rollout Notes:**
- No breaking changes: Existing behavior for `.deck.md` files unchanged
- No config changes: No user-facing settings or keybindings modified
- No activation changes: Extension activation events remain the same

