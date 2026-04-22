# Project Context

- **Owner:** ormasoftchile
- **Project:** executable-talk — VS Code extension (v0.8.1) that transforms .deck.md Markdown files into interactive executable presentations with live code demos
- **Stack:** TypeScript 5.x strict mode, VS Code Extension API 1.85+, ffmpeg (via `child_process`), macOS AVFoundation, gray-matter, markdown-it, @vscode/test-electron, Mocha
- **Architecture:** Three layers — Webview (Presentation UI) ↔ Conductor (Orchestration) ↔ VS Code API. Webview communicates only via postMessage.
- **Key files for Cercas:** `src/recording/recorderOrchestrator.ts` (primary ownership), `src/models/recording.ts` (types reference), `src/recording/index.ts` (exports)
- **Created:** 2026-04-11

## Recording Architecture Summary

### Pure-TypeScript event layer (`src/recording/`)
| File | Role |
|---|---|
| `recordingController.ts` | Session lifecycle, `relativeTimeMs`, pause/resume, retake markers. No vscode imports. |
| `recordingTimeline.ts` | Ordered in-memory event storage. |
| `recordingEventFactory.ts` | Typed factories for all 16 `RecordingEventType` values. |
| `segmentBuilder.ts` | Derives cue-aligned `RecordingSegment[]` from event stream. |
| `autoPilot.ts` | Timed execution plan for hands-free screen capture. |
| `cueParser.ts` | Extracts `VoiceOverCue[]` from slide content. |
| `recordingSerializer.ts` | Exports sessions to JSON, Markdown, SRT. |
| `voiceOverScriptGenerator.ts` | Narration script output. |
| `captionsScaffoldGenerator.ts` | SRT/caption scaffold output. |

### VS Code / process layer
| File | Role |
|---|---|
| `recorderOrchestrator.ts` | **Cercas' primary file.** Spawns external recorder via `child_process.spawn()`. Reads `executableTalk.recording.*` settings. Interpolates `{{outputPath}}`, `{{sessionId}}`, `{{windowX/Y/Width/Height}}`. Graceful stop via `stdin.write('q')`. |

### RecorderConfig (from VS Code settings)
```typescript
{ startCommand: string; stopCommand: string; outputDir: string; outputExtension: string }
```

### Template variable reference
| Variable | Status |
|---|---|
| `{{outputPath}}` | ✅ Implemented |
| `{{sessionId}}` | ✅ Implemented |
| `{{windowX}}` | ✅ Implemented (Windows only) |
| `{{windowY}}` | ✅ Implemented (Windows only) |
| `{{windowWidth}}` | ✅ Implemented (Windows only) |
| `{{windowHeight}}` | ✅ Implemented (Windows only) |
| macOS `getWindowBoundsdarwin()` | ❌ Not implemented — Cercas' primary deliverable |

### Windows reference implementation
Located in `RecorderOrchestrator.getWindowBoundsWindows()`: writes a temporary PowerShell script to `os.tmpdir()`, calls `GetForegroundWindow()` + `GetWindowRect()` via P/Invoke, parses `x,y,width,height` from stdout.

### Graceful stop pattern
ffmpeg receives `'q'` on stdin → waits up to 5 seconds for clean exit → falls back to `stopCommand` or `process.kill()`.

### Primary OS target
macOS (Darwin) — development environment. Linux/Windows secondary. ffmpeg is expected to be installed by the user.

## Learnings

### 2026-06-11 — Window Detection Deep-Dive & Recommended Approach

**What was investigated:**
- Read full `RecorderOrchestrator` implementation: Windows path works (`GetForegroundWindow` via inline PowerShell). macOS/Linux `getWindowBounds()` returns `undefined` → falls back to hardcoded `0,0,1920,1080`.
- Tested all proposed macOS approaches on the development machine (macOS, 2 VS Code windows open simultaneously).

**What works — macOS:**
`osascript -` (stdin pipe, no temp files) querying `window 1` of the VS Code process via System Events. Verified output `0,30,1920,987` with 2 windows open — returns the frontmost (presenting) window correctly.

Key AppleScript pattern:
```applescript
tell process n  -- iterate {"Code","Code - Insiders","Cursor","VSCodium"}
  set pos to position of window 1
  set sz to size of window 1
  return x & "," & y & "," & w & "," & h
end tell
```

**Invoke from TypeScript:** `cp.spawn('osascript', ['-'])` with script written to stdin. No temp files. No npm packages. 5-second timeout via `setTimeout` + `proc.kill()`.

**Why `window 1` is reliable:** Recording is always triggered from within the presenting VS Code window (user clicks a command/button inside VS Code). At that moment, the presenting window IS the active/frontmost window. Sub-millisecond between trigger and osascript call — no race condition in practice.

**Accessibility permissions gotcha:** `System Events` requires the calling app to have Accessibility access (System Preferences → Privacy → Accessibility). If not granted, osascript returns an error. Graceful fallback: log to output channel, return `undefined`, use full-screen fallback.

**Linux:** `xdotool getactivewindow getwindowgeometry --shell` — same active-window-at-trigger-time principle. Graceful degradation if xdotool absent.

**What was rejected:**
- `active-win` npm package: native binary, ~3MB bundle weight — unnecessary when osascript is built-in
- Swift `CGWindowListCopyWindowInfo` one-liner: ~200ms compile overhead per call, PID correlation complexity
- CGWindowList filtered by process PID: requires walking process tree (2+ extra `ps` calls); osascript `window 1` is direct
- `yabai`: optional install, not universally available

**Integration scope:** One file: `src/recording/recorderOrchestrator.ts`. Add `getWindowBoundsMacOS()` and `getWindowBoundsLinux()` private methods, update `getWindowBounds()` dispatch to include `darwin` and `linux` branches. De Unamuno's pipeline unchanged — `{{windowX/Y/Width/Height}}` template vars already wired.

**ffmpeg command template for macOS users:**
```
ffmpeg -f avfoundation -capture_cursor 1 -r 30 -i "1:" -vf "crop={{windowWidth}}:{{windowHeight}}:{{windowX}}:{{windowY}}" -pix_fmt yuv420p -preset ultrafast -y {{outputPath}}
```

**Decision document:** `.squad/decisions/inbox/cercas-window-detection-approach.md`

---

## 2026-06-12 — Cross-platform `getWindowBounds` Implemented

### What was implemented

`src/recording/recorderOrchestrator.ts` — replaced the partial `getWindowBounds()` / `getWindowBoundsWindows()` with a full three-platform dispatch and three private methods.

**`getWindowBoundsDarwin()` (macOS):**
- `cp.spawn('osascript', ['-'])` with the AppleScript written to stdin. Zero temp files.
- AppleScript queries `System Events` for `{"Code", "Code - Insiders", "Cursor", "VSCodium"}`, takes `item 1` (frontmost process), reads `position` and `size` of `window 1`.
- 5-second kill timeout guards against hanging.
- **Scale factor decision:** Returns raw logical (point) coordinates from AppleScript. No Retina multiplication applied. The ffmpeg `avfoundation` + `crop` filter command template uses logical coordinates and works correctly on macOS (verified in prior session). If a user runs a 2× framegrab, they must handle scaling in their own command template.

**`getWindowBoundsLinux()` (Linux):**
- Primary: `xdotool getactivewindow` → name check → `xdotool getwindowgeometry --shell`. Falls back to `xdotool search --name "Visual Studio Code"` if active window is not VS Code.
- Fallback: `wmctrl -l -G` parsed for VS Code window title.
- Graceful degradation: if neither tool is available, logs to outputChannel and returns `undefined`.

**`getWindowBoundsWindows()` (Windows) — improved:**
- Eliminated temp `.ps1` file entirely. Uses `cp.execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command', psScript])`.
- Replaced `GetForegroundWindow()` with `Get-Process | Where-Object { Name in @('Code',...) } | Where-Object { MainWindowHandle -ne 0 }` — finds VS Code specifically, not just whatever window has focus.
- `Add-Type -TypeDefinition '...'` uses a PS single-quoted string so `[DllImport("user32.dll")]` double quotes require no escaping.
- `GetWindowRect` returns physical pixel coordinates (VS Code is DPI-aware; no scale factor needed).

**All platforms:** Width and height rounded up to nearest even number (h264 requirement).

**Imports removed:** `import * as os from 'os'` and `import * as fs from 'fs'` — both were only used by the old temp-file Windows approach.

### Template variable table updated

| Variable | Status |
|---|---|
| `{{outputPath}}` | ✅ Implemented |
| `{{sessionId}}` | ✅ Implemented |
| `{{windowX}}` | ✅ All platforms |
| `{{windowY}}` | ✅ All platforms |
| `{{windowWidth}}` | ✅ All platforms |
| `{{windowHeight}}` | ✅ All platforms |

### Verification
- `npx tsc --noEmit` — 0 errors
- `npm run test:unit` — 472 passing

**Decision document:** `.squad/decisions/inbox/cercas-window-detection-impl.md`

---

## 2026-06-13 — Multi-Screen avfoundation Fix: `{{screenDevice}}` Template Variable

### Problem solved
User got only an SRT file and no video. Root cause: broken ffmpeg command template using `-video_size WxH -i "1:0"` which is invalid for avfoundation — `-video_size` restricts capture to a WxH region starting at screen origin (0,0), not the window position. The subsequent `-vf crop` then tries to crop at the window offset from that already-wrong capture, producing an ffmpeg error on startup.

### What was changed

**`src/recording/recorderOrchestrator.ts`:**

1. **`getWindowBoundsDarwin()` rewritten** — now returns `{ x, y, width, height, screenIndex }` where:
   - `x`, `y` are **screen-relative** (not global). Computed by: window global position (from System Events) minus screen origin (from NSScreen AppKit).
   - `screenIndex` is the avfoundation device index (0 = NSScreen.mainScreen = avfoundation device 0).
   - Combined AppleScript uses `use framework "AppKit"` + `use scripting additions` in a single `osascript -` call. Returns `"winX,winY,winW,winH|seX0,seY0,nsW0,nsH0;seX1,seY1,nsW1,nsH1;"`.
   - NSScreen→System Events coordinate conversion: `seY = mainH - nsY - nsH` (Cocoa y-up → SE y-down).
   - Window-to-screen matching: center-point containment test first, falls back to max-overlap heuristic.

2. **`getWindowBounds()` return type extended** — added `screenIndex?: number`.

3. **`interpolate()` updated** — regex now also matches `\{\{screenDevice\}\}`. When bounds are resolved, `{{screenDevice}}` → `String(bounds.screenIndex ?? 0)`. Fallback (no bounds) → `'0'`. Logged in output channel.

**`package.json`:** Updated `executableTalk.recording.startCommand` description to list all template variables including `{{screenDevice}}` with the correct macOS example command.

**`~/Library/Application Support/Code/User/settings.json`:** Fixed the user's broken command — removed `-video_size`, changed `-i "1:0"` to `-i "{{screenDevice}}"`.

**`test/unit/recording/windowDetection.test.ts`:**
- Extended `WindowBounds` type to include `screenIndex?: number`.
- Updated "happy path" test to use new pipe-separated output format and assert `screenIndex: 0`.
- Added "legacy output fallback" test (no `|` separator → global coords, screenIndex 0).
- Added "multi-screen" test: window at global 2020,100 on secondary screen (1920,0,2560,1440) → screenIndex=1, x=100, y=100.

### Correct ffmpeg command
```
/opt/homebrew/bin/ffmpeg -f avfoundation -i "{{screenDevice}}" -vf crop={{windowWidth}}:{{windowHeight}}:{{windowX}}:{{windowY}} -r 30 -c:v libx264 -preset ultrafast -pix_fmt yuv420p {{outputPath}}
```

Key: full screen is captured by avfoundation device `{{screenDevice}}`, then `crop` cuts to the window region using screen-relative coordinates.

### Verification
- `npm run compile` — 0 errors
- `npm run test:unit` — 499 passing (3 new Darwin tests added)

### Template variable table updated

| Variable | Status |
|---|---|
| `{{outputPath}}` | ✅ Implemented |
| `{{sessionId}}` | ✅ Implemented |
| `{{windowX}}` | ✅ All platforms (screen-relative on macOS) |
| `{{windowY}}` | ✅ All platforms (screen-relative on macOS) |
| `{{windowWidth}}` | ✅ All platforms |
| `{{windowHeight}}` | ✅ All platforms |
| `{{screenDevice}}` | ✅ macOS (avfoundation device index); 0 on all other platforms |
