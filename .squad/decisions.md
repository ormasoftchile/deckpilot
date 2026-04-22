# Squad Decisions

## Active Decisions

### Dual Authoring Model — Architecture & Decomposition

**Proposed by:** Cervantes (2026-04-22)  
**Status:** ✅ Phase 1 Complete (2026-06-12) — 788 passing, 0 failing  
**PRD:** Dual Authoring Model (Mode A: Inline, Mode B: Sidecar)

The parser pipeline is already format-agnostic. The entire dual authoring feature lives in the parser layer + a new sidecar loader. Conductor and Webview layers are unchanged.

**New components:**
1. **SidecarLoader** (`src/parser/sidecarLoader.ts`) — reads/parses `.deck.yaml`, returns typed sidecar object
2. **SlideIdParser** (`src/parser/slideIdParser.ts`) — assigns stable IDs to slides via two-phase extraction
3. **MergeEngine** (`src/parser/mergeEngine.ts`) — applies sidecar metadata onto parsed deck (precedence: inline > sidecar > defaults)
4. **SidecarValidator** (`src/parser/deckValidator.ts`) — checks for unknown IDs, duplicates, malformed YAML
5. **SidecarActionMapper** (`src/parser/sidecarActionMapper.ts`) — maps raw `SidecarAction[]` to `Action[]`

**Model changes shipped:**
- `Slide` gains `id?: string`, `idExplicit?: boolean`, `cues?: string[]`, `duration?: string`, `sidecarActions?: SidecarAction[]`
- `DeckMetadata` gains `title?: string`, `theme?: string`
- `src/models/sidecar.ts` — new: `SidecarFile`, `SidecarSlide`, `SidecarAction`, `SidecarDeck`, `SidecarRecording`, `SidecarExport`

**Merge precedence (enforced):** inline frontmatter > sidecar YAML > global defaults. Pure immutable functions; inputs never mutated.

**Phase 3 decision:** "Reusable metadata templates" and "multi-file deck imports" are deferred. Phase 1 + 2 ship all user value.

See decision inbox file `cervantes-dual-authoring-decomp.md` for complete 25-item work breakdown (DA-01 through DA-25).

---

### Dual Authoring Model — Slide ID System (DA-01, DA-02, DA-11, DA-14)

**Authors:** Cervantes (DA-01, DA-02), De Unamuno (DA-11), Delibes (DA-14)  
**Status:** ✅ Implemented

**Two-phase ID extraction:** Phase 1 strips `<!-- id: xxx -->` comments inside `parseSlideContent` (so they never reach the renderer). Phase 2 runs `generateSlideId` + `resolveUniqueIds` after the outer `parseSlides` loop has merged any pending YAML frontmatter.

**Priority order:**
1. `<!-- id: xxx -->` HTML comment — highest author intent; sets `idExplicit = true`
2. YAML frontmatter `id:` field — sets `idExplicit = true`
3. First heading slug — `# Getting Started` → `getting-started`
4. `slide-{index}` positional fallback — always available

**Deduplication:** `resolveUniqueIds` uses a two-pass algorithm. First pass pre-registers all explicit IDs. Second pass deduplicates only auto-generated IDs (appends `-2`, `-3`). Explicit duplicate IDs are intentionally preserved as-is — `validateSlideIds` surfaces them as errors.

**Duplicate detection rules:**

| Slide A `idExplicit` | Slide B `idExplicit` | Result |
|---|---|---|
| true | true | Error diagnostic |
| true | false | Error diagnostic |
| false | true | Error diagnostic |
| false | false | Silent auto-suffix by `resolveUniqueIds` |

**Bug fixed (DA-14):** Original `resolveUniqueIds` did not respect `idExplicit` — two slides with `<!-- id: setup -->` would silently produce `['setup', 'setup-2']`. Fixed with two-pass algorithm.

**Diagnostics anchored to line 0** — `Slide` has no source position today. Future PR to add `lineStart?: number` to `Slide` will improve precision.

---

### Dual Authoring Model — SidecarLoader Contract (DA-03, DA-04, DA-15)

**Authors:** De Unamuno (DA-03), Cervantes (DA-04), Delibes (DA-15)  
**Status:** ✅ Implemented

**File naming:** `src/parser/sidecarLoader.ts` — discovery (`resolveSidecarPath`, `sidecarExists`) and YAML parsing (`loadSidecar`) in one file, consistent with the SidecarLoader component name in the architecture.

**Path convention:** `demo.deck.md` → `demo.deck.yaml`. `resolveSidecarPath` throws (not silent fallback) on non-`.deck.md` input — programming error, fail loudly.

**`loadSidecar` behavior contract:**

| Condition | Result |
|---|---|
| No `.deck.yaml` exists | `null` — not an error |
| Empty / whitespace YAML | `{}` — valid empty sidecar |
| YAML syntax error | `null` (best-effort); `validateSidecarSchema` surfaces diagnostics |
| Top-level not a mapping | `null`; diagnostic surfaced separately |
| Slide entry missing `id` | `Error` thrown with index and filename |

**`SidecarSlide.id` is required** — without an ID, a sidecar slide entry has no merge target. All other top-level fields are optional (partial sidecars are valid).

**Node `fs` (not `vscode.workspace.fs`)** — sidecar files are always real disk files; virtual FS handling not needed. Consistent with `EnvFileLoader` pattern.

---

### Dual Authoring Model — Merge Engine Contracts (DA-05, DA-06, DA-07, DA-09, DA-16)

**Authors:** Cervantes (DA-05, DA-06, DA-09), De Unamuno (DA-07), Delibes (DA-16)  
**Status:** ✅ Implemented

**`parseDeck` made async (DA-06):** Was synchronous. Made async to accommodate `await loadSidecar()`. Three call-site `await`s added: `extension.ts`, `conductor.ts`, `srtSnapshots.test.ts`.

**`sidecarActions` separation (DA-05):** Raw `SidecarAction[]` stored on `slide.sidecarActions`. DA-07 maps them to `onEnterActions` via `mapSidecarActions()`. Keeping them separate prevented mixing unresolved sidecar actions with resolved `Action[]` objects in the merge engine.

**Action mapper (DA-07):** `src/parser/sidecarActionMapper.ts` — pure function, no vscode imports, no executor imports. Field normalization: `cmd→command` (terminal.run), `file→path` (file.open, editor.highlight). Unknown types: `console.warn` + skip, never throw. Trust enforcement falls through to existing `executeAction()` check in Conductor — zero special handling in the mapper.

**`onEnterActions` precedence:** Sidecar actions populate `onEnterActions` only when `onEnterActions.length === 0`. Inline actions always win.

**`DeckMetadata.theme` placement (DA-05):** Added directly on `DeckMetadata`, not on `PresentationOptions`. `PresentationOptions.theme` is a `'dark'|'light'` rendering hint; `DeckMetadata.theme` is the authoring-level token from sidecar. Two distinct layers.

**Sidecar errors are non-fatal (DA-06):** Surfaced as `[sidecar]` warnings; deck still loads from inline content.

**Deck metadata propagation verified (DA-09):** `title` and `theme` from sidecar flow through `mergeSidecarDeckMetadata` → `parseDeck` → `createDeck` → `Conductor.handleReady` → `DeckLoadedMessage`. Webview rendering not yet wired (De Vega, later phase).

---

### Dual Authoring Model — Validation Layer (DA-10, DA-11, DA-12, DA-17)

**Authors:** De Unamuno (DA-10, DA-11, DA-12), Delibes (DA-17)  
**Status:** ✅ Implemented

**Three validator functions in `src/parser/deckValidator.ts`:**

1. `validateSlideIds(slides)` — detects duplicate explicit IDs; returns `SlideDiagnosticResult[]` with `Error` severity
2. `validateSidecarSlideIds(slides, sidecar)` — detects sidecar entries referencing unknown slide IDs; returns `Warning` (unknown ID is silently skipped at merge; deck loads correctly)
3. `validateSidecarSchema(rawContent)` — detects malformed YAML, wrong top-level type, unknown top-level keys, missing slide `id`s

**`SlideDiagnosticResult[]` not `vscode.Diagnostic[]`** — parser layer stays vscode-free. Consistent with `actionDiagnosticProvider.ts` pattern. `extension.ts` is responsible for conversion.

**Lenient `loadSidecar` vs strict `validateSidecarSchema`:** `loadSidecar` returns best-effort parse (allows merge even with schema warnings). `validateSidecarSchema` provides full authoring feedback. Two distinct responsibilities.

**Bug fixed (DA-17):** `validateSidecarSlideIds` crashed with `TypeError: Cannot read properties of null` when called with `null` sidecar. Fixed by adding leading `!sidecar` guard before property access.

**Parallel write conflict (DA-10/11/12):** Three agents wrote to `deckValidator.ts` concurrently in Wave 4. DA-12 introduced an internal helper initially named `validateSidecarSlideIds` (single-arg), which was renamed to `validateSidecarSlideIdPresence` before landing to avoid collision. DA-10 is the canonical two-arg `validateSidecarSlideIds`. Missing `import * as yaml from 'js-yaml'` was added by Delibes in DA-15.

---

### Dual Authoring Model — Recording/Export Settings (DA-19, DA-20)

**Authors:** Cervantes (DA-19), De Unamuno (DA-20)
**Status:** ✅ Implemented

**Extended sidecar types (`SidecarRecording`, `SidecarExport`):**

`SidecarRecording` gains: `outputDir?`, `format?`, `codec?`, `framerate?: number`, `windowScope?: 'focused' | 'screen'`. `SidecarExport` gains: `outputDir?`, `srtFormat?: 'srt' | 'vtt'`, `voiceScript?: boolean`.

**Naming rationale:** `windowScope` mirrors the project lexicon (`windowX/Y/Width/Height`). `srtFormat` avoids collision with the existing `subtitles` field. `format`/`codec` remain plain `string` (not constrained union) — ffmpeg accepts dozens of values; a closed union would require constant maintenance.

**`DeckMetadata.recording` / `.export` use inline types** (not imported from `sidecar.ts`) to keep the core deck model free of sidecar-layer dependencies. The shapes are structural mirrors; if `SidecarRecording` gains new fields, `DeckMetadata.recording` needs a parallel update.

**Merge strategy:** Spread-based field-by-field merge (`{ ...sidecarSection, ...(inlineSection ?? {}) }`). YAML and frontmatter parsers never emit `{ key: undefined }`, so spread correctly overwrites only authored fields. Scalar fields (`title`, `theme`) keep the explicit conditional pattern for readability.

**Early-return guard updated:** Original `if (!sidecar.deck) { return metadata; }` extended to `if (!sidecar.deck && !sidecar.recording && !sidecar.export) { return metadata; }` — preserves the no-copy optimisation while allowing `recording`/`export` sidecars with no `deck:` section (a valid and common authoring pattern).

---

### Dual Authoring Model — Environment/Platform Overrides (DA-21, DA-22)

**Authors:** Cervantes (DA-21), De Unamuno (DA-22)
**Status:** ✅ Implemented

**`SidecarEnvironment` interface:** `{ common?: Record<string, string>; platform?: Record<'darwin' | 'linux' | 'win32', Record<string, string>> }`. Platform keys are exact `process.platform` values — no aliasing (`macos`, `windows`). `Record<string, string>` matches `process.env` semantics.

**`envMerger.ts` four-layer precedence** (lowest → highest):

| Priority | Source |
|---|---|
| 4 (base) | `process.env` — `undefined` values excluded |
| 3 | `sidecar.environment.common` — cross-platform author defaults |
| 2 | `sidecar.environment.platform[platform]` — per-OS overrides |
| 1 (highest) | `.deck.env` file — explicit user-managed values; always wins |

**Injectable platform pattern:** `resolveEnvironment(deckPath, sidecar, platform = process.platform)` — default argument is `process.platform` but injectable for tests. No `process.platform` hardcode.

**Placement:** `src/env/envMerger.ts` (not `src/parser/`) — environment-layer concern consistent with `EnvFileLoader` and `EnvResolver` placement.

**Unknown platform:** If `process.platform` is `freebsd` or any unlisted value, the platform layer is silently skipped. Common and `.deck.env` layers still apply.

**`deck.resolvedEnvironment`:** Optional `Record<string, string>` on `Deck`. If `resolveEnvironment` throws (non-fatal), field is absent. Callers guard with `deck.resolvedEnvironment ?? {}`.

**Validator updated:** `'environment'` added to `KNOWN_SIDECAR_KEYS` in `validateSidecarSchema()` — removes spurious warning for decks with an `environment:` block.

---

### Dual Authoring Model — extractMetadataToSidecar Command (DA-23)

**Author:** De Unamuno
**Status:** ✅ Implemented

**Command:** `deckpilot.extractMetadataToSidecar` — scaffolds a `.deck.yaml` from the active `.deck.md`.

**Extraction strategy:** Calls `parseDeck()` and extracts from the merged `Deck` object (not raw frontmatter). Captured fields: `deck.metadata.title`, `deck.metadata.theme`, `deck.metadata.recording`, `deck.metadata.export`; per-slide: `id` (required), `cues`, `duration`, `checkpoint`, `sidecarActions` (round-trip preservation for existing sidecars).

**Explicit exclusions:** Inline action links `[Label](action:...)`, `voiceCues` (HTML comment content), `speakerNotes` / frontmatter `notes`, `onEnterActions` (resolved form — `sidecarActions` is the correct round-trip form). Slides with no extractable metadata are omitted from `slides[]` to avoid bloat.

**Overwrite guard:** Non-modal `showWarningMessage` prompt with explicit "Overwrite" confirmation if `.deck.yaml` already exists. Dismiss aborts silently.

**Pure logic separation:** `buildSidecarContent(deck: Deck): string` is exported as a pure function with no VS Code API imports — fully unit-testable. The VS Code I/O wrapper is a thin shell handling editor validation, file existence check, invocation, write, and open.

**Serialization:** `js-yaml` `dump()` with `lineWidth: 120`. No hand-rolled YAML.

---

### Dual Authoring Model — showResolvedDeckModel Command (DA-24)

**Author:** De Vega
**Status:** ✅ Implemented

**Command:** `deckpilot.showResolvedDeckModel` — opens a read-only, JSON-highlighted virtual document showing the final merged `Deck` object. Authoring aid for debugging merge issues.

**Virtual document pattern:** `vscode.workspace.registerTextDocumentContentProvider('deckpilot-model', provider)`. `DeckModelContentProvider` holds a `Map<string, string>` keyed by URI path. On invocation: parse → JSON-serialize → `provider.update(uri, json)` → `onDidChange.fire(uri)` → `openTextDocument` → `setTextDocumentLanguage(doc, 'json')` → `showTextDocument`.

**Why virtual (not disk):** Faster, no project directory pollution, immediately discardable. Consistent with VS Code conventions (git diff views, TS declaration previews).

**JSON safety:** Circular references caught with a `seen` Set in the replacer function. Functions stripped (`return undefined`). Output guaranteed valid JSON.

**Re-use semantics:** Same URI per filename — calling the command twice updates the existing tab (via `onDidChange`), not a second tab. No auto-refresh on save; command must be re-invoked manually.

**`serializeDeck()` extracted as pure function:** Delibes found during DA-25 test authoring that JSON serialization logic was embedded in the command handler. Extracted to `buildDeckJson(deck: Deck): string` — pure, no vscode imports, unit-testable without the extension host.

---

### Dual Authoring Model — File Watcher for `.deck.yaml` (DA-13)

**Author:** De Unamuno  
**Status:** ✅ Implemented

**Pattern:** Exact structural mirror of the existing `.deck.env` watcher (`startEnvFileWatcher` / `disposeEnvFileWatcher`) in `Conductor`.

**Key difference from env watcher:** Sidecar changes trigger a **full deck reload** (`reloadDeckFromDisk`), not just env resolution. Sidecar changes can affect slide content, IDs, voice cues, and speaker notes.

**`RelativePattern` scoped to deck directory** — not a workspace-wide `**` glob. Covers only the single `.deck.yaml` sibling of the active `.deck.md`.

**Debounce:** 500ms — matches env watcher.

**Delete handled transparently:** `parseDeck` calls `sidecarExists()` → `false` → `loadSidecar()` returns `null` → merge skipped. No special-case code.

**Second watcher in `extension.ts`** — workspace-wide `**/*.deck.yaml` watcher re-triggers editor diagnostics for all open `.deck.md` documents, reusing `refreshDiagnosticsOnEnvChange` handler.

---

### Dual Authoring Model — voiceCues Pipeline Bug (DA-08)

**Author:** De Unamuno  
**Status:** ✅ Fixed

`parseCues()` in `src/recording/cueParser.ts` was ignoring `slide.cues` (populated by the merge engine from sidecar YAML). Sidecar-sourced cues never reached `buildSegments()`, `VoiceOverScriptGenerator`, or `CaptionsScaffoldGenerator`.

**Fixed priority chain:**
1. Inline `<!-- voice: -->` HTML comment cues (`voiceCues`) — inline wins
2. Sidecar `cues[]` — each string → `VoiceOverCue` with `source: 'frontmatter'`, no fragment association
3. Speaker notes — last resort

Fragment-level cue targeting (voice[N]) remains exclusive to inline syntax. Blank/whitespace sidecar strings are skipped.

---

### macOS Window-Scoped Recording — CGWindowList via Swift

**Proposed by:** Cervantes (Lead) (2026-04-22)  
**Status:** Proposed  
**Scope:** RecorderOrchestrator — macOS `getWindowBounds()` implementation

Recording on macOS currently falls back to full-desktop capture because `getWindowBounds()` returns `undefined`. On large monitors, this is useless.

**Approach:** Spawn `swift -e '<CGWindowList script>'` to query CoreGraphics:
1. Filters windows by owner name containing "Code", layer 0
2. Matches title against workspace name
3. Returns JSON with `{ x, y, width, height, scaleFactor }`
4. Graceful fallback to `undefined` on permission errors or missing swift binary

**Process name reliability:** VS Code appears as `"Code"` in CGWindowList (Electron rebrands). Insiders as `"Code - Insiders"`. This is reliable.

**Retina/HiDPI:** CGWindowList bounds are in logical points. ffmpeg's AVFoundation captures in physical pixels. Scale factor must be applied.

**Multi-monitor:** For MVP, document that window-scoped recording targets display containing window (AVFoundation device selection per display index). Future enhancement: return correct display index.

**ffmpeg macOS command template:**
```
ffmpeg -f avfoundation -capture_cursor 1 -framerate 30 -i "Capture screen 0" -vf "crop={{windowWidth}}:{{windowHeight}}:{{windowX}}:{{windowY}}" -c:v libx264 -preset ultrafast -pix_fmt yuv420p {{outputPath}}
```

**Template variables:** Existing `{{windowX}}`, `{{windowY}}`, `{{windowWidth}}`, `{{windowHeight}}` already wired. Only implementation needed.

**User directive (2026-04-11):** Region recording ONLY. Full-screen recording explicitly rejected — must never be used as fallback.

See decision inbox files: `cervantes-recording-window-detection.md` (architecture), `cercas-window-detection-approach.md` (technical approach), `cercas-window-detection-impl.md` (implementation notes).

---

### Domain Boundary: De Unamuno / Cercas

**Date:** 2026-04-11  
**Proposed by:** De Unamuno  
**Status:** Active

Recording system in `src/recording/` spans orchestration (De Unamuno) and OS capture mechanics (Cercas).

**De Unamuno owns:**
- `RecordingController`, `RecordingTimeline`, `RecordingEventFactory`, `buildSegments()`, `AutoPilot`, `RecordingSerializer`, `VoiceOverScriptGenerator`, `CaptionsScaffoldGenerator`
- Conductor-side `recordingState.ts`
- Webview recording messages
- `terminal.run`, `debug.start` executors

**Cercas owns:**
- `RecorderOrchestrator.getWindowBounds()` — platform dispatch
- `RecorderOrchestrator.getWindowBoundsDarwin()` — macOS implementation
- `RecorderOrchestrator.getWindowBoundsLinux()` — Linux implementation
- `RecorderOrchestrator.interpolate()` — `{{windowX/Y/Width/Height}}` resolution
- ffmpeg command design for all platforms
- Platform fallback logic (undefined → full-screen graceful degradation)

**Key rules:**
1. Cercas works inside `RecorderOrchestrator` only
2. Graceful degradation non-negotiable — return `undefined` on failure, never throw
3. No vscode imports in pure-TypeScript layer
4. Integration test coverage for new platform branches

---

### Window Detection Test Coverage

**Author:** Delibes  
**Date:** 2026-04-22  
**Test file:** `test/unit/recording/windowDetection.test.ts`  
**Status:** ✅ Implemented — 25 tests, all passing

**Coverage:**
- macOS (`getWindowBoundsDarwin`) — 7 tests: happy path, odd dimension rounding, errors, osascript not installed
- Linux (`getWindowBoundsLinux`) — 7 tests: xdotool, wmctrl fallback, both unavailable
- Windows (`getWindowBoundsWindows`) — 7 tests: PowerShell inline (no temp files), errors
- Platform dispatch (`getWindowBounds`) — 4 tests: darwin, linux, win32, unknown platform

**Mocking infrastructure:** Direct mutation of `require('child_process')`, EventEmitter-based fake processes, `Object.defineProperty` for platform mocking.

**Known gaps:** Timeout path (5-second kill), xdotool parse failure edge cases, wmctrl "found but no VS Code" log line. Low priority.

---

### avfoundation Multi-Screen Device Routing

**Author:** Cercas  
**Date:** 2026-04-22  
**Status:** ✅ Implemented

The `executableTalk.recording.startCommand` template now supports `{{screenDevice}}` variable.

**What:** `{{screenDevice}}` resolves to avfoundation device index of screen containing VS Code window. Maps to ffmpeg `-i` input selector:
```
ffmpeg -f avfoundation -i "{{screenDevice}}" -vf crop={{windowWidth}}:{{windowHeight}}:{{windowX}}:{{windowY}} ...
```

**Implementation:**
1. `getWindowBoundsDarwin()` returns screen-relative coordinates (not global)
2. Single osascript call with AppKit bridge gets window bounds + screen list in one round-trip
3. Output format: `winX,winY,winW,winH|seX0,seY0,nsW0,nsH0;seX1,seY1,nsW1,nsH1;`

**Coordinate conversion (Cocoa → System Events):**
```
seY = mainScreenHeight - nsY - nsH
```
Cocoa uses y-up (bottom-left origin), System Events uses y-down (top-left origin).

**Screen mapping:** NSScreen.screens() index 0 = main screen = avfoundation device 0. Stable macOS behavior.

**Fallback:** If screen data absent, returns global coords with `screenIndex: 0`. If osascript fails, `{{screenDevice}}` resolves to `0` (main screen).

---

### Column Layout Ratios

**Proposed:** De Vega (2026-04-11)

`.layout-columns` is hardcoded to `grid-template-columns: 1fr 1fr`. Authors need asymmetric ratios for code-heavy slides (e.g., 2:1).

**Proposal:** Extend directive syntax to `:::columns 2:1` and map to grid template values.

**Status:** Proposed | **Requires:** Frontend design, parser update, test coverage

---

### Disclosure Directive Labels — Authoring & Localization

**Proposed:** De Vega (2026-04-11)

`:::advanced` and `:::optional` labels are hardcoded English and not author-configurable.

**Proposal:** Allow `:::advanced Custom Label` syntax for label override. Consider localization in i18n future.

**Status:** Proposed | **Requires:** Parser syntax extension, CSS label consistency

---

### Onboarding Mode Centering Override

**Proposed:** De Vega (2026-04-11)

`body.mode-onboarding #slide-container` sets `align-items: flex-start`, which breaks `:::center` blocks (render left-aligned instead of centered).

**Decision needed:** Should onboarding mode preserve centered layout for `:::center` blocks? Or is left-aligned flow intentional for all onboarding content?

**Status:** Proposed | **Requires:** Design + CSS decision, test update if changed

---

### Test Verification Strategy for Layout Changes

**Proposed:** Delibes (2026-04-11)  
**Status:** ✅ Implemented

Three-tier approach: Tier 1 (pipeline string assertions) + Tier 2 (`node-html-parser` DOM assertions), reject Tier 3 (screenshot diffs).

**Accepted tiers:**
- Tier 1: String assertions on `parseSlides()` output (zero new infrastructure) ✅ Baseline implemented
- Tier 2: `node-html-parser` for DOM structural checks (adoption criteria defined)

**Rejected tier:**
- Tier 3: Visual regression / screenshot testing (cost > benefit)

**Pattern:** Any new layout directive must have corresponding `slideRenderingPipeline.test.ts` entry.

---

### Layout Rendering Baseline Tests

**Proposed:** Delibes (2026-04-11)  
**Status:** ✅ Implemented

Created `slideRenderingPipeline.test.ts` with 38 tests:
- `:::center` directive (7 tests)
- `:::columns` directive (8 tests)
- `:::advanced` disclosure (5 tests)
- `:::optional` disclosure (5 tests)
- Plain slides (3 tests)
- Multiple slides (7 tests)
- Edge cases (3 tests)

**Infrastructure:** `test/unit/helpers/vscode-mock.cjs`, updated `package.json` `test:unit` script.

**Verification:** All 38 tests green. Full suite: 472 passing.

---

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
