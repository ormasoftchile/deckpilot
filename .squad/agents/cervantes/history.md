# Project Context

- **Owner:** ormasoftchile
- **Project:** executable-talk — VS Code extension (v0.8.1) that transforms .deck.md Markdown files into interactive executable presentations with live code demos
- **Stack:** TypeScript 5.x strict, VS Code Extension API 1.85+, gray-matter (YAML frontmatter), markdown-it, @vscode/test-electron, Mocha
- **Architecture:** Three layers — Webview (Presentation UI) ↔ Conductor (Orchestration) ↔ VS Code API. Webview communicates only via postMessage.
- **Key files:** src/extension.ts, src/conductor/Conductor.ts, src/conductor/StateStack.ts, src/actions/ActionRegistry.ts, src/parser/DeckParser.ts, src/webview/WebviewProvider.ts
- **Action types:** file.open, editor.highlight, terminal.run (trust required), debug.start (trust required), sequence
- **Improvement focus areas:** visual/theming support, presentation rendering, video recording, subtitle production, general automation
- **Created:** 2026-04-11

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### 2025-07-23 — DA-01: Slide id Field

- **Slide interface lives in:** `src/models/slide.ts` — single canonical definition, imported throughout via `src/models/index.ts`
- **Factory function:** `createSlide()` in the same file — does not need to set `id` since the field is optional; callers that parse IDs (DA-02) will set it after construction
- **Webview is safe:** `messages.ts` never passes `Slide` objects wholesale. `SlideChangedMessage` and `DeckLoadedMessage` carry individual fields only. No protocol change required for the id field.
- **`SlideFrontmatter`** has `[key: string]: unknown` catch-all so frontmatter `id:` keys already flow through — parsing them is DA-02's job
- **Test count at DA-01:** 574 unit tests, all passing

### 2025-07-23 — DA-02: Slide ID Parser

- **Slide parsing pipeline lives in:** `src/parser/slideParser.ts` — `parseSlides()` splits on `---`, then calls `parseSlideContent()` per block, then resolves uniqueness
- **ID extraction split into two phases:** (1) `extractIdComment()` runs inside `parseSlideContent` to strip `<!-- id: xxx -->` before markdown rendering; (2) `generateSlideId()` runs in `parseSlides` after pending-frontmatter merging, so per-slide YAML blocks (bare `notes: …\nid: …` between delimiters) are visible when the id is assigned
- **Why the split matters:** `parseSlideContent` returns before `pendingFrontmatter` is merged, so any frontmatter-based id must be resolved in the outer `parseSlides` loop after the merge, not inside `parseSlideContent`
- **Priority order implemented:** HTML comment > frontmatter `id:` > first heading slug > `slide-{index}` fallback
- **Uniqueness:** `resolveUniqueIds()` appends `-2`, `-3`, … for duplicates; skips empty ids gracefully
- **checkpointParser.ts is the pattern** for this kind of comment-extraction — follow it for future per-slide metadata comments
- **Test file:** `test/unit/parser/slideIdParser.test.ts` — 44 tests covering unit (slugify, extractIdComment, generateSlideId, resolveUniqueIds) and integration (parseSlides)
- **Decision written to:** `.squad/decisions/inbox/cervantes-da02-slide-id-parsing.md`


- **Recording architecture:** RecordingController (pure TS, no vscode dep) → RecordingState (Conductor-owned wrapper) → Conductor.startRecording() which creates RecorderOrchestrator for external screen capture. RecorderOrchestrator supports template variables `{{outputPath}}`, `{{sessionId}}`, `{{windowX/Y/Width/Height}}` in the user-configured `startCommand`.
- **Windows already works:** `getWindowBoundsWindows()` uses PowerShell + `GetForegroundWindow()` / `GetWindowRect()`. macOS returns `undefined` (not implemented).
- **VS Code has NO window geometry API.** `vscode.window.state` only gives `focused: boolean`. No bounds, no position. Confirmed as of 2025 — not on the roadmap.
- **macOS process name is "Code"** (not "Electron"). Verified via CGWindowListCopyWindowInfo. VS Code Insiders is "Code - Insiders".
- **Multiple VS Code windows share one PID.** Must use window title matching (title contains workspace folder name) to disambiguate.
- **CGWindowList via `swift -e` is the recommended macOS approach.** Returns bounds, window ID, z-order. Inline Swift script (~30 lines), no compilation. Requires Screen Recording permission on Catalina+ for window titles.
- **Retina scaling gotcha:** CGWindowList bounds are in logical points. ffmpeg AVFoundation captures in physical pixels. Must multiply by display scale factor (obtainable from `CGDisplayPixelsWide / CGDisplayBounds.width`).
- **ffmpeg macOS region capture:** `-f avfoundation -i "Capture screen 0" -vf "crop=W:H:X:Y"` with coordinates in physical pixels. Width/height must be even for h264.
- **Decision written to:** `.squad/decisions/inbox/cervantes-recording-window-detection.md`

### 2025-07-23 — DA-04: Sidecar YAML Loader and Types

- **Sidecar types live in:** `src/models/sidecar.ts` — exported via `src/models/index.ts`. Canonical interfaces: `SidecarFile`, `SidecarSlide`, `SidecarAction`, `SidecarDeck`, `SidecarRecording`, `SidecarExport`.
- **`js-yaml` was already present** as a production dependency (`^4.1.1`) — no new dependency needed.
- **`loadSidecar(deckMdPath)`** in `sidecarLoader.ts` returns `null` on absent sidecar (not an error), throws on parse failure or missing slide `id` fields.
- **Test baseline at DA-04:** 617 passing. The 1 remaining failure is a pre-existing slideIdParser integration test (DA-02 incomplete), not caused by DA-04 changes.

- **PRD scope:** Two authoring modes (inline `.deck.md` vs `.deck.md` + `.deck.yaml` sidecar) compiling to one canonical `Deck` model.
- **Architecture impact:** Entirely contained in parser layer. Conductor and Webview are already format-agnostic — they receive a `Deck` object and don't care how it was produced. Three-layer architecture is not challenged.
- **New components needed:** SidecarLoader (parse YAML), SlideIdResolver (stable IDs), MergeEngine (inline-wins precedence merge), SidecarValidator (diagnostic rules).
- **Model changes:** `Slide` gains `id?: string`. `DeckMetadata` gains optional `recording`, `export`, `environment` sections in Phase 2.
- **Key risk:** Slide ID stability when authors reorder slides. Mitigated by explicit `<!-- id: xxx -->` or frontmatter `id:` with auto-generated fallbacks.
- **Phase 3 (templates, multi-file imports) flagged as premature** — deferred until real user demand exists.
- **Recommended first PR:** Slide ID support (DA-01 + DA-02 + DA-14) — ~150 LOC, zero risk to existing decks.
- **25 work items across P1 (18) and P2 (7).** P1 is self-contained and shippable.
- **Decision written to:** `.squad/decisions/inbox/cervantes-dual-authoring-decomp.md`

### 2025-07-23 — DA-09: Sidecar Deck Metadata Verification

- **This was a pure verification task.** DA-05 + DA-06 already completed all the work — nothing was missing.
- **`DeckMetadata`** has both `title?: string` (always present) and `theme?: string` (added by DA-05).
- **`mergeSidecarDeckMetadata()`** correctly maps `sidecar.deck.title` and `sidecar.deck.theme` with inline-wins precedence.
- **`parseDeck()`** (async since DA-06) calls `loadSidecar()` + `mergeSidecarDeckMetadata()`, so sidecar values enter the pipeline.
- **`handleReady()` in Conductor** forwards `theme: this.deck.metadata.theme` in the `sendDeckLoaded` call. `DeckLoadedMessage` has `theme?:string`.
- **Webview `handleDeckLoaded()`** does not yet consume `title` or `theme` from the payload — that rendering work belongs to De Vega in a later PR.
- **Test count at DA-09:** 724 passing, 0 failing.
- **Decision written to:** `.squad/decisions/inbox/cervantes-da09-deck-metadata.md`



- **Pure-function module:** `src/parser/mergeEngine.ts` — no file I/O, no VS Code API. Input → output only. Easily unit-tested in isolation.
- **`DeckMetadata.theme`** was absent from the model; added it as `theme?: string`. `PresentationOptions.theme` (nested, typed `'dark' | 'light'`) is distinct — deck-level sidecar theme is a broader `string` to accommodate future theme tokens.
- **`Slide` gains three new optional fields:** `cues?: string[]` (sidecar cue strings), `duration?: string` (timing hint), `sidecarActions?: SidecarAction[]` (stored unresolved; DA-07/08 wires these to the ActionRegistry).
- **Immutable merge pattern:** both functions spread inputs into new objects — callers can safely compare by reference to detect whether a merge actually changed anything.
- **Test count at DA-05:** 646 passing (27 new tests for merge engine, all green).
- **Decision written to:** `.squad/decisions/inbox/cervantes-da05-merge-engine.md`

### 2025-07-23 — DA-06: Wire Sidecar into parseDeck()

- **`parseDeck` was synchronous** before DA-06. It now returns `Promise<ParseResult>`. The change was minimal — just the `async` keyword, `let slides`, and three `await`/call sites.
- **Two production callers touched:** `src/extension.ts` (inside an existing `async` command handler) and `src/conductor/conductor.ts` (`validateDeck` which was already `async`). Both needed only `await` prepended. No Conductor architecture changes required.
- **One test caller touched:** `test/unit/recording/srtSnapshots.test.ts` — `buildSrtForDeck` and its `it()` made `async`.
- **Sidecar errors are non-fatal:** Load/parse failures go into `sidecarWarnings[]` and surface via the existing `ParseResult.warnings` field. Deck still loads.
- **Pre-existing bugs fixed incidentally:** `deckValidator.ts` (committed in DA-10) had a duplicate `validateSidecarSlideIds` export (two functions, different arity) and a missing `yaml` import. Renamed the 1-arg internal version to `validateSidecarSlideIdPresence`. The test file also had an unused `validateSidecarSchema` import that was blocking TypeScript compilation.
- **Test count at DA-06:** 724 passing, 0 failing.
- **Decision written to:** `.squad/decisions/inbox/cervantes-da06-parsedeck-integration.md`

### 2025-07-23 — DA-19: Recording Settings in Sidecar Types

- **Types-only change:** Added 5 fields to `SidecarRecording` (`outputDir`, `format`, `codec`, `framerate`, `windowScope`) and 3 fields to `SidecarExport` (`outputDir`, `srtFormat`, `voiceScript`). Zero runtime logic.
- **`format`/`codec` stay `string`** (not union): ffmpeg accepts too many values for a closed union to be maintainable. Runtime validation is the right layer for this.
- **`windowScope`** uses `'focused' | 'screen'` union — mirrors existing `windowX/Y/Width/Height` template variable lexicon.
- **`srtFormat`** uses `'srt' | 'vtt'` union — small, stable set; closed union is appropriate here.
- **788 tests, all passing.** Commit: `c6e2042`.
- **Decision written to:** `.squad/decisions/inbox/cervantes-da19-types.md`

### 2025-07-23 — P2 Wave Plan Produced

- **Phase 2 scope:** 7 work items (DA-19 through DA-25) covering recording/export settings, environment/platform overrides, and two authoring commands.
- **DA-19 to DA-25 breakdown was missing from decisions.md** — the initial decomposition (mentioned as "25 items: 18 P1 + 7 P2") was never persisted in detail. Reconstructed from PRD description.
- **Wave structure:** 4 waves with parallelism in waves 1-3. Wave 1 (types) → Wave 2 (merge/resolution) → Wave 3 (commands) → Wave 4 (tests).
- **Key architectural decisions:**
  - `SidecarEnvironment` type with `platform` (darwin/linux/win32 → env map) and `common` sections
  - Platform injection into `envResolver.ts` for testability
  - "Extract Metadata" command creates `.deck.yaml` from inline metadata; action links in markdown body are NOT extracted (already inline)
  - "Show Resolved Model" uses safe JSON serializer to avoid circular refs
- **Risk R3 flagged:** Extracting action links from markdown body is hard (requires re-parsing HTML or source mapping). MVP only extracts frontmatter/structured data.
- **Decision written to:** `.squad/decisions/inbox/cervantes-p2-wave-plan.md`

### 2025-07-23 — DA-21: SidecarEnvironment Type and Validator Allowlist

- **`SidecarEnvironment`** was already present in `src/models/sidecar.ts` from a prior wave commit (DA-19 landed it as part of the P2 type wave). DA-21's actual delta was the validator allowlist.
- **`KNOWN_SIDECAR_KEYS`** in `deckValidator.ts` — added `'environment'` to prevent a spurious warning when authors write `environment:` in their `.deck.yaml`. Also updated the human-readable diagnostic message.
- **Platform key names confirmed:** `darwin`, `linux`, `win32` — exact Node.js `process.platform` values. No normalization needed at the type layer; consumers can use `process.platform` directly as the lookup key.
- **`common` section:** flat `Record<string, string>` — applies across all platforms before platform-specific overrides. Merge order (common first, platform second) is a DA-22 concern.
- **Test count at DA-21:** 788 passing, 0 failing.

### 2025-07-24 — onEnterActions Timing Bug Fix

- **Root cause:** `Conductor.goToSlide()` called `executeSlideActions()` immediately after `sendSlideChanged()`, without waiting for the webview to finish rendering. The actions fired before the slide was visible.
- **Fix pattern:** Added `slideRendered` acknowledgment message. Webview sends it at the end of `handleSlideChanged()`. Conductor awaits `waitForSlideRender()` before executing `onEnterActions`.
- **Safety timeout:** 2-second timeout in `waitForSlideRender()` prevents infinite blocking if webview doesn't respond.
- **Files changed:** `messages.ts`, `messageHandler.ts`, `webviewProvider.ts`, `conductor.ts`, `presentation.js`
- **Test count after fix:** 857 passing, 0 failing.
