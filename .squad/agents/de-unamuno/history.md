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


