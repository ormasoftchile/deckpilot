# Squad Decisions

## Active Decisions

### Dual Authoring Model — Architecture & Decomposition

**Proposed by:** Cervantes (2026-04-22)  
**Status:** Proposed  
**PRD:** Dual Authoring Model (Mode A: Inline, Mode B: Sidecar)

The parser pipeline is already format-agnostic. The entire dual authoring feature lives in the parser layer + a new sidecar loader. Conductor and Webview layers are unchanged.

**New components:**
1. **SidecarLoader** — reads/parses `.deck.yaml`, returns typed sidecar object
2. **SlideIdResolver** — assigns stable IDs to slides, matches sidecar refs
3. **MergeEngine** — applies sidecar metadata onto parsed deck (precedence: inline > sidecar > defaults)
4. **SidecarValidator** — checks for unknown IDs, duplicates, malformed values

**Model changes needed:**
- `Slide` gains `id?: string` field (stable slide ID)
- `DeckMetadata` gains optional `recording`, `export`, `environment` sections
- `Slide` gains optional `cues: string[]`, `duration?: string`, `timingHint?: string`

**Merge precedence:** inline frontmatter > sidecar YAML > global defaults

**Phase 3 decision:** "Reusable metadata templates" and "multi-file deck imports" are deferred. Phase 1 + 2 ship all user value.

**Recommended First PR:** DA-01 + DA-02 + DA-14 (Slide ID support). ~150 lines production, ~200 lines tests. Zero risk to existing decks.

See decision inbox file `cervantes-dual-authoring-decomp.md` for complete 25-item work breakdown (DA-01 through DA-25).

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
