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

### 2026-04-11 — Cercas added as Recording Specialist

A new specialist, **Cercas**, was onboarded to own the screen capture / window detection / ffmpeg integration layer within the recording system.

**What Cercas owns (not De Unamuno):**
- `RecorderOrchestrator.getWindowBounds()` and all platform sub-methods (`getWindowBoundsWindows()`, the new `getWindowBoundsdarwin()`)
- ffmpeg command design for macOS AVFoundation
- Template variable resolution for `{{windowX}}`, `{{windowY}}`, `{{windowWidth}}`, `{{windowHeight}}`
- macOS window coordinate detection via `osascript` / Accessibility API
- Fallback logic when window detection fails

**What De Unamuno retains:**
- `RecordingController` — session lifecycle, event timeline, pause/resume, retake markers
- `RecordingTimeline`, `RecordingEventFactory`
- `RecordingSerializer` — JSON/SRT/Markdown export
- `VoiceOverScriptGenerator`, `CaptionsScaffoldGenerator` — subtitle/narration pipeline
- `AutoPilot` — pacing for hands-free capture
- `buildSegments()` — segment derivation
- Conductor integration for recording state (webview messages, `recordingState.ts`)

**Key boundary rule:** Cercas works inside `RecorderOrchestrator` only. Any change that touches `RecordingController` internals or adds new Conductor wiring requires De Unamuno review before merge.

### 2026-04-22 — DA-03 Sidecar file discovery (sidecarLoader.ts)

**New file:** `src/parser/sidecarLoader.ts`  
**Test file:** `test/unit/parser/sidecarLoader.test.ts`  
**Exported via:** `src/parser/index.ts`

**How .deck.md files are loaded:**
- `src/extension.ts` → `parseDeck(content, filePath)` invoked from `executableTalk.openPresentation` command
- `parseDeck` is in `src/parser/deckParser.ts`, receives raw file content and absolute path
- `isValidDeckFile(path)` in `deckParser.ts` enforces `.deck.md` extension via `endsWith('.deck.md')`
- The conductor (`src/conductor/Conductor.ts`) receives the parsed `Deck` object via `openDeck()`

**Sidecar discovery pattern:**
- `resolveSidecarPath(deckMdPath)`: replaces `/\.deck\.md$/` with `.deck.yaml` — mirrors `EnvFileLoader.loadEnvFile` which does the same for `.deck.env`
- `sidecarExists(deckMdPath)`: uses `fs.promises.access` — async, matching the `Promise<boolean>` contract
- Throws a clear error on non-`.deck.md` input rather than silently returning a bad path
- Node `fs` used (not `vscode.workspace.fs`), consistent with `EnvFileLoader`

**Reference pattern (`.deck.env`):**
- `src/env/envFileLoader.ts` — `EnvFileLoader.loadEnvFile()` uses `deckFilePath.replace(/\.deck\.md$/, '.deck.env')`
- `src/extension.ts` line ~451 — `.deck.env` file watcher pattern using `vscode.workspace.createFileSystemWatcher('**/*.deck.env')`

**DA-04 note:** `sidecarLoader.ts` is deliberately named to match the "SidecarLoader" component in `decisions.md`. DA-04 will add YAML parse logic to the same file.

### 2026-04-22 — DA-08 Sidecar cues → voiceCues pipeline

**Task:** Wire `slide.cues` (sidecar string array, populated by DA-05's `mergeSidecarIntoSlides`) into the recording voice/subtitle pipeline.

**What was found:**
- `slide.voiceCues?: Array<{fragmentIndex?, text}>` — HTML comment cues, pre-extracted by `slideParser.ts` from `<!-- voice: -->` syntax
- `slide.cues?: string[]` — sidecar-sourced cue strings, merged by `mergeEngine.ts` (DA-05)
- These are **two distinct fields** — `cues` was completely ignored by `parseCues()` before this task
- The pipeline chain: `parseCues(slides)` → `buildSegments()` → `VoiceOverScriptGenerator` / `CaptionsScaffoldGenerator`
- The Webview does NOT use `cues` — presenter view uses `speakerNotes` only

**What was done:**
- Updated `parseCues()` in `src/recording/cueParser.ts` to implement the full priority chain:
  1. Inline HTML comment cues (`slide.voiceCues` / `<!-- voice: -->`) — highest priority
  2. Sidecar cues (`slide.cues[]`) → each maps to `VoiceOverCue` with `source: 'frontmatter'`, no fragmentIndex
  3. Speaker notes — last resort
- Blank/whitespace-only sidecar strings are silently skipped
- Added 7 new tests to `cueParser.test.ts` covering all sidecar wiring scenarios (21 total, all passing)
- Added explanatory comment to `DeckLoadedMessage` in `messages.ts` noting cues stay in the recording pipeline
- DA-05's sidecar merge work required zero changes — it already populated `slide.cues` correctly

**Key boundary:** `slide.cues` are slide-level only (no fragment association). Fragment-level cue targeting remains exclusively the `<!-- voice[N]: -->` comment syntax.

**Pre-existing test suite issue:** `src/parser/deckValidator.ts` (untracked, from prior incomplete work) has compilation errors that block `npm run test:unit`. Used `TS_NODE_TRANSPILE_ONLY=true` to verify recording tests pass. This is not a DA-08 regression.


### 2026-04-22 — DA-10 Unknown sidecar slide ID validation

**New function:** `validateSidecarSlideIds(slides: Slide[], sidecar: SidecarFile)` in `src/parser/deckValidator.ts`  
**Exported via:** `src/parser/index.ts`  
**Test coverage:** 22 new tests in `test/unit/parser/deckValidator.test.ts`

**What it does:**
- Checks that every `id` in `sidecar.slides[]` matches a slide `id` in the parsed `Slide[]` array
- Unknown IDs → `Warning` severity (not Error — unmatched sidecar entries are silently ignored at merge time; this is a diagnostic aid, not a blocker)
- Message: `"Sidecar references unknown slide id 'xxx' — no matching slide found in deck"`
- Range anchored to line 0 (sidecar entries carry no line-position info yet)

**Parallel-agent coordination:**
- DA-11 had already created `deckValidator.ts` with `validateSlideIds()` (duplicate ID detection)
- DA-12 was also running in parallel and added `validateSidecarSchema()` + `validateSidecarSlideIdPresence()` to the same file. DA-12 also added `validateSidecarSchema` tests to `deckValidator.test.ts` but did not update the test's import line — I fixed that.
- DA-12 renamed the single-arg internal function to `validateSidecarSlideIdPresence` to avoid collision with DA-10's two-arg `validateSidecarSlideIds`. The stash/pop during conflict resolution revealed this.

**Pattern:** Always check for parallel-agent edits before assuming a file is in the committed state. Even untracked files may have been modified by a stash cycle.

### 2026-04-22 — DA-13 Sidecar file watcher (.deck.yaml live reload)

**Changed files:** `src/conductor/conductor.ts`, `src/extension.ts`

**Pattern used:** Exact mirror of the `.deck.env` watcher in Conductor.
- `startSidecarFileWatcher(deck)` — scoped `RelativePattern` to deck directory, `*.deck.yaml` glob, 500ms debounce, all three events (change/create/delete) routed to same `onChange` handler
- `disposeSidecarFileWatcher()` — clears debounce timer, calls `dispose()` on watcher object, nulls both references
- `reloadDeckFromDisk(filePath)` — reads `.deck.md` with `fs.promises.readFile`, calls `parseDeck()` (which auto-loads `.deck.yaml` since DA-06), then calls `openDeck()` with the new deck
- Watcher pushed to `this.disposables` for extension deactivation cleanup
- `disposeSidecarFileWatcher()` called in `close()` alongside `disposeEnvFileWatcher()`

**Key difference from env watcher:** Env watcher only re-resolves env variables and sends `envStatusChanged`. Sidecar watcher does a full deck reload (`openDeck()`) because sidecar changes affect slide content, cues, speaker notes, and slide IDs — not just env resolution.

**Graceful degradation on delete:** `parseDeck()` calls `sidecarExists()` first. If sidecar is deleted, `loadSidecar()` returns null, merge engine skips the merge, deck renders from inline frontmatter alone. Zero special-case code needed.

**extension.ts:** Added `**/*.deck.yaml` `FileSystemWatcher` for diagnostics refresh — reuses `refreshDiagnosticsOnEnvChange` handler and is added to `context.subscriptions`.

**Test suite:** 745 tests, all passing. No regressions.

### 2026-04-22 — DA-11 Duplicate explicit slide ID validation

**New field:** `idExplicit?: boolean` on `Slide` model (`src/models/slide.ts`)  
**Updated:** `src/parser/slideParser.ts` — sets `idExplicit`, calls `validateSlideIds`, exposes `getLastValidationDiagnostics()`  
**Exported via:** `src/parser/index.ts` (already committed by parallel setup work)  
**Test coverage:** 21 new tests in `test/unit/parser/deckValidator.test.ts`

**What `idExplicit` means:**
- `true` — author explicitly declared the ID via `<!-- id: xxx -->` comment or frontmatter `id:` field
- `undefined`/`false` — ID was auto-derived (heading slug or `slide-N` positional fallback)

**How the validator runs:**
- `validateSlideIds(slides)` is called inside `parseSlides()` BEFORE `resolveUniqueIds()` — uniquification renames duplicates in place, so detection must happen first
- A diagnostic is emitted only when at least one side of a collision has `idExplicit === true` (pure auto-generated duplicates are already handled silently)
- All ranges anchor to line 0 — `Slide` carries no source-position tracking yet

**Parallel-agent context:**
- `deckValidator.ts` and the test file were already committed by prior agents (DA-10, DA-12 setup)
- The model and slideParser changes were the remaining missing implementation
- `git stash` operations during this session accidentally truncated `sidecarLoader.test.ts` to its committed state (117 lines); the uncommitted loadSidecar tests (lines 118+) were lost and require a separate DA-04 follow-up

### 2026-04-22 — DA-07 Sidecar actions → ActionRegistry elements

**New file:** `src/parser/sidecarActionMapper.ts`  
**Modified:** `src/parser/mergeEngine.ts`, `src/parser/index.ts`  
**Test files:** `test/unit/parser/sidecarActionMapper.test.ts` (18 tests), `test/unit/parser/mergeEngine.test.ts` (+5 tests)

**What was done:**
- Created `mapSidecarActions(sidecarActions, slideIndex)` — pure function, no VS Code API, no I/O
- Field-name normalisation at map time:
  - `terminal.run`: `SidecarAction.cmd` → `TerminalRunParams.command`
  - `file.open` / `editor.highlight`: `SidecarAction.file` → params `path`
  - `debug.start` / all others: all index-signature fields pass through unchanged
- Unknown action types: `console.warn` and skip, never throw
- `mergeEngine.mergeSidecarIntoSlides()` now calls `mapSidecarActions` and assigns the result to `merged.onEnterActions` — only when `onEnterActions.length === 0` (inline takes precedence)
- `sidecarActions` field remains on the slide for reference/debugging
- Trust enforcement requires zero special handling: `terminal.run` and `debug.start` are already in `TRUSTED_ACTION_TYPES` checked by `conductor.executeAction()` at dispatch time

**Architecture note:** The mapper is a pure utility in the parser layer. It doesn't import from `src/actions/` (no executor classes, no registry) — only from `src/models/action.ts` for `createAction` and `ActionType`. This keeps the parser free of executor-layer dependencies.

**Pre-existing test-suite issue (not a regression):** Multiple uncommitted in-progress changes in the working tree (`deckParser.ts` DA-06 wiring, partial `sidecarLoader.test.ts`) cause `noUnusedLocals` failures when running the full `npm run test:unit`. The DA-07 additions compile cleanly (`tsc --noEmit` passes) and all 261 tests in the exercised suites pass.

### 2026-04-22 — DA-20: Recording/Export merge into DeckMetadata

**Changed files:** `src/models/deck.ts`, `src/parser/mergeEngine.ts`, `test/unit/parser/mergeEngine.test.ts`

**What was done:**
- Added `recording?` and `export?` nested types to `DeckMetadata` in `src/models/deck.ts`. Shapes mirror `SidecarRecording`/`SidecarExport` but are declared inline — no import from `src/models/sidecar.ts`, keeping the core model free of sidecar dependencies.
- Extended `mergeSidecarDeckMetadata()` with field-by-field merge for both sections: `{ ...sidecarSection, ...inlineSection }` — sidecar as base, inline overwrites per-field. Works correctly because TypeScript optional fields absent from an object don't appear in spreads.
- Restructured the early-return guard from `if (!sidecar.deck)` to `if (!sidecar.deck && !sidecar.recording && !sidecar.export)` — previously `recording` and `export` were unreachable when `deck` was absent from the sidecar.
- Added 11 new tests (recording + export apply, inline wins per field, sidecar fills gaps, immutability, combined).
- All 799 tests passing.

**Key design note:** The spread merge strategy (`{ ...sidecar, ...inline }`) is safe as long as inline fields are genuinely absent (not explicitly set to `undefined`) when not authored. YAML parsing and frontmatter parsing both omit keys for absent fields — they do not set them to `undefined` explicitly. Explicit `undefined` assignments in TypeScript code would break the precedence, but this is not a realistic concern in the parser pipeline.

### 2026-04-22 — DA-12: Malformed sidecar YAML → editor diagnostics

**New function:** `validateSidecarSchema(sidecarContent: string): SlideDiagnosticResult[]` in `src/parser/deckValidator.ts`  
**Modified:** `src/parser/sidecarLoader.ts` (loadSidecar no longer throws), `test/unit/parser/sidecarLoader.test.ts` (6 tests updated)  
**Exported via:** `src/parser/index.ts`

**What was done:**
- `validateSidecarSchema` takes raw YAML string and returns `SlideDiagnosticResult[]` (not `vscode.Diagnostic[]`) — consistent with existing deckValidator pattern; extension.ts lifts to vscode.Diagnostic at call site
- Three checks in order: (1) YAML syntax error → Error with js-yaml `mark.line` line number; (2) unknown top-level keys → Warning (permissive schema); (3) missing slide id fields → Error
- Helper `yamlErrorLine(err)` extracts 0-based line from `YAMLException.mark.line` safely
- `loadSidecar` refactored: returns `null` on YAML parse failure or non-mapping top-level; no longer throws on schema violations (missing ids now handled by validateSidecarSchema not loadSidecar)
- 6 sidecarLoader tests updated from `expect-throw` to `expect-null/non-null` contracts

**Parallel task note:** DA-10 was committed concurrently and incorporated my `validateSidecarSchema` implementation and test stubs into its commit (`new file` for deckValidator.ts). DA-06 added graceful sidecar error handling in `parseDeck()` (try/catch converting throws to warnings). DA-12 supersedes both: `loadSidecar` no longer throws at all, and `validateSidecarSchema` is the canonical diagnostic channel.

**Key architectural decision preserved:** `deckValidator.ts` has NO vscode import. All validation runs outside the extension host. Extension.ts lifts `SlideDiagnosticResult` → `vscode.Diagnostic` when wiring up a DiagnosticCollection for `.deck.yaml` files (future DA task).



### 2026-06-12 — pre elements added to fragment-eligible set

**Bug:** `<pre>` (code block) elements were not in the fragment-eligible set in `tagEligibleElements()`. On slides with both explanatory text and a code block, the `<pre>` appeared immediately on slide entry (before pressing space), while the `<p>` text revealing after — backwards reveal order.

**Fix:** Added `<pre>` to `tagEligibleElements()` in `src/parser/fragmentProcessor.ts` (between the `li` block and the `render-block` div block), and added `pre` to the Phase 2 regex alternation group so the `__frag` sentinel is consumed and replaced with real fragment attributes.

**Key implementation notes:**
- Phase 1 inserts `__frag` right after the tag name: `<pre __frag="fade">`. Any existing class on `<pre>` would end up in the `post` capture group in Phase 2, not the `pre` group — so the existing class-merge logic would NOT fire. This is a known limitation for all non-slide-group elements but is not a real-world issue: markdown-it always puts the language class on `<code>`, not `<pre>`. 
- Three SRT snapshots were affected and regenerated (`showcase`, `showcase-web`, `sidecar-demo`) — timing shifted because fragment counts increased for slides with code blocks.
- 5 new tests added to `test/unit/parser/fragmentProcessor.test.ts` covering: bare pre, reveal-after-paragraph ordering, data attributes, multiple pre blocks, fade animation default.
- Test baseline: 831 → 867 passing (+5 new tests, +3 snapshot regenerations counted separately), 0 failing.



**New file:** `src/commands/extractMetadata.ts`  
**New test file:** `test/unit/commands/extractMetadata.test.ts` (17 tests)  
**Modified:** `src/extension.ts`, `package.json`

**What was done:**
- Implemented `buildSidecarContent(deck: Deck): string` as a pure function (no VS Code API) — produces YAML via `js-yaml dump()`.
- Implemented `extractMetadataToSidecar(): Promise<void>` as the VS Code command handler — validates active editor, checks .deck.md extension, guards against overwrite with `showWarningMessage`, calls `parseDeck()`, calls `buildSidecarContent()`, writes file with `fs.writeFileSync`, opens in editor.
- Registered as `deckpilot.extractMetadataToSidecar` via the existing pattern in `extension.ts` alongside `deckpilot.showResolvedDeckModel`.

**What IS exported to the sidecar:**
- `deck.title`, `deck.theme` → `deck:` section (only if present)
- `deck.metadata.recording` → `recording:` section (only if non-empty)
- `deck.metadata.export` → `export:` section (only if non-empty)
- Per-slide: `id`, `cues`, `duration`, `checkpoint`, `sidecarActions` (as `actions:`) — only when at least one of these is non-empty

**What is NOT exported:**
- Inline action links from markdown body (`[Label](action:...)`) — R3 scope exclusion
- Slides with no exportable metadata (no cues, no duration, no checkpoint, no sidecarActions)
- Slides without an `id` (no merge target without an id)

**Key design decision:** `sidecarActions` on a slide come from the EXISTING sidecar (DA-07). Re-exporting them is round-trip preservation, not markdown body extraction. R3's "do not extract action links from markdown body" applies to inline links only.

**Test baseline:** 814 → 831 passing (+17 tests), 0 failing.

**New file:** `src/env/envMerger.ts`  
**Modified:** `src/env/index.ts`, `src/models/deck.ts`, `src/parser/deckParser.ts`  
**Test file:** `test/unit/env/envMerger.test.ts` (15 tests)

**What was done:**
- Implemented `resolveEnvironment(deckPath, sidecar, platform?)` as an async pure function in the `src/env/` layer
- Precedence chain (lowest → highest): `process.env` → `sidecar.environment.common` → `sidecar.environment.platform[platform]` → `.deck.env` file values
- Platform parameter defaults to `process.platform` but is injectable for tests — no hardcoded `process.platform` in the resolution logic
- Added `resolvedEnvironment?: Record<string, string>` to the `Deck` interface in `src/models/deck.ts`
- Wired into `parseDeck()` after sidecar load; wrapped in try/catch (non-fatal — deck still loads if env resolution fails)
- Retained `loadedSidecar` reference outside the sidecar try/catch block so it's available to `resolveEnvironment`
- Exported from `src/env/index.ts`

**Key design choices:**
- `resolveEnvironment` lives in `src/env/` (not `src/parser/`) — it is environment-layer logic, not parsing logic
- Uses `EnvFileLoader` internally to load `.deck.env` — consistent with the rest of the env pipeline
- `SidecarFile | null` parameter (not `SidecarFile | undefined`) — matches `loadSidecar` return type contract
- Platform values are limited to `'darwin' | 'linux' | 'win32'` in the sidecar type — unknown platforms (e.g. `freebsd`) silently skip the platform layer without error

**Pre-existing test baseline:** 799 tests. After DA-22: 814 passing, 0 failing (+15 new tests).

### 2026-07-09 — Sidecar button fragment ordering fix

**Problem:** Sidecar action buttons (source='sidecar', e.g. "Run: npm install") appeared **on slide entry** instead of as the last reveal step, because `fragment: false` caused `buildButtonHtml` to emit `data-no-fragment` and sidecar injection happens AFTER `processFragments` has already run.

**Pipeline clarification (important for future work):**
- `parseSlideContent()` runs `injectBlockElementsFromParsed()` BEFORE `processFragments()` — so **block** elements get proper fragment indices during parse.
- `mergeSidecarIntoSlides()` runs AFTER all slides are parsed, so sidecar elements are added to `slide.interactiveElements` post-parse, post-fragment.
- `injectBlockElements(slide.html, slide)` is called at render time (Conductor, WebviewProvider, web host) — it appends sidecar elements to already-fragmented HTML. The block-element placeholder regex is a no-op at this point (placeholders already replaced).

**Fix chosen: Option B — Manual fragment index assignment**

Changed three files:
1. **`src/parser/sidecarActionMapper.ts`**: `fragment: false` → `fragment: true` to declare intent.
2. **`src/renderer/blockElementRenderer.ts`**: Added `buildSidecarFragmentButtonHtml(el, fragmentIndex)` helper. In `injectBlockElements`, for sidecar elements with `fragment !== false`, scan the rendered HTML for the max `data-fragment="N"` value, then inject `<p class="fragment" data-fragment="{N+1}" data-fragment-animation="fade">`. Elements with `fragment === false` still use the legacy `data-no-fragment` path.
3. **`src/parser/mergeEngine.ts`**: After adding sidecar elements, increments `merged.fragmentCount` by the number of fragmenting sidecar elements so the Conductor and AutoPilot track the correct total.

**Tests updated:**
- `sidecarActionMapper.test.ts`: updated description + assertion (`fragment=false` → `fragment=true`)
- `blockElementRenderer.test.ts`: added `makeSidecarElement()` helper + 5 new tests covering fragment injection, consecutive indexing, fallback to `data-no-fragment`
- SRT snapshot updated (timing shifted because sidecar fragment step now counts toward fragment total, changing AutoPilot pacing)

**Playwright verification:** Confirmed correct reveal order on Setup slide of `sidecar-demo.deck.md`:
- Entry: heading only
- Space 1: paragraph text
- Space 2: code block
- Space 3: "Run: npm install" button

**Final test count:** 872 passing, 0 failing (was 867 before this session). Compile: clean.

### 2026-06-12 — Showcase-full sidecar example (model extensions)

**Task:** Create `examples/showcase-full.deck.md` and `examples/showcase-full.deck.yaml` as the canonical reference for the full dual authoring model.

**Model extensions made (non-breaking):**

1. **`SidecarSlide.notes?: string`** — Speaker notes can now be declared in the sidecar under a slide entry. `mergeEngine.ts` maps this to `Slide.speakerNotes` with standard sidecar precedence (inline wins).

2. **`SidecarDeck.basePath?: string`** — Deck-level basePath mirrored from `DeckMetadata.basePath`. Allows sidecar-only decks to resolve relative file references without frontmatter.

3. **`SidecarScene` interface** — New type: `{ name: string; slide: string }`. Sidecar scenes reference slides by their string ID (not the 1-based index used by inline `SceneDefinition`). Added as `SidecarFile.scenes?: SidecarScene[]`.

**Key distinction:** Inline `SceneDefinition.slide` is `number` (1-based). `SidecarScene.slide` is `string` (ID). The merge engine does not yet resolve sidecar scenes to indices — that is a future DA item.

**Field name clarification for terminal.run:** The sidecar mapper reads `cmd` → renames to `command` in params. However, `command` in YAML also works because it passes through `...rest` in `buildParams`. The showcase-full example uses `command` (consistent with inline action blocks). The reference sidecar-demo uses `cmd`. Both are valid.

**What `notes:` in sidecar maps to:** `Slide.speakerNotes` — this is the field the webview presenter panel reads. `SlideFrontmatter.notes` is the raw frontmatter field, mapped to `speakerNotes` by the parser. The merge engine follows the same mapping.
