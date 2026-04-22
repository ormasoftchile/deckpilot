# Skill: avfoundation Multi-Screen Window Capture (macOS)

## Problem

When recording a specific window with ffmpeg's `avfoundation` input device on macOS with multiple screens, you must:
1. Identify which screen (device index) the window is on
2. Capture that entire screen
3. Crop to the window using **screen-relative** coordinates

## Why `-video_size` is wrong

```
# ❌ BROKEN — -video_size clips from top-left of screen (0,0), not window position
ffmpeg -f avfoundation -video_size 1440x900 -i "1:0" -vf crop=1440:900:200:300 ...
```

`-video_size WxH` tells avfoundation to capture a WxH region starting at pixel (0,0) of the screen. A subsequent `-vf crop` at the window offset references outside that region → ffmpeg error → no output file.

## Correct pattern

```
# ✅ CORRECT — capture full screen, crop to window region
ffmpeg -f avfoundation -i "DEVICE_INDEX" \
  -vf crop=WINDOW_WIDTH:WINDOW_HEIGHT:SCREEN_RELATIVE_X:SCREEN_RELATIVE_Y \
  -r 30 -c:v libx264 -preset ultrafast -pix_fmt yuv420p output.mp4
```

## Device index mapping

- `avfoundation device 0` = `NSScreen.mainScreen` = `NSScreen.screens()[0]`
- `avfoundation device 1` = `NSScreen.screens()[1]`
- Order matches `NSScreen.screens()` order; main screen is always first

## Getting screen info via AppleScript + AppKit

```applescript
use framework "AppKit"
use scripting additions

-- Get window bounds via System Events
tell application "System Events"
  set vscodeProcs to every process whose name is "Code" or name is "Code - Insiders" or name is "Cursor" or name is "VSCodium"
  if (count of vscodeProcs) is 0 then return "error:no_process"
  set p to item 1 of vscodeProcs
  set w to window 1 of p
  set pos to position of w
  set sz to size of w
  set winData to (item 1 of pos as string) & "," & (item 2 of pos as string) & "," & (item 1 of sz as string) & "," & (item 2 of sz as string)
end tell

-- Get NSScreen list in avfoundation order (index 0 = main)
set allScreens to current application's NSScreen's screens()
set mainH to ((item 1 of allScreens)'s frame()'s size's height) as integer
set screenList to ""
repeat with s in allScreens
  set f to s's frame()
  set nsX to (f's origin's x) as integer
  set nsY to (f's origin's y) as integer
  set nsW to (f's size's width) as integer
  set nsH to (f's size's height) as integer
  -- Convert Cocoa (y-up, origin bottom-left) → System Events (y-down, origin top-left)
  set seY to mainH - nsY - nsH
  set screenList to screenList & nsX & "," & seY & "," & nsW & "," & nsH & ";"
end repeat

return winData & "|" & screenList
```

Output: `"winX,winY,winW,winH|seX0,seY0,nsW0,nsH0;seX1,seY1,nsW1,nsH1;"`

## Coordinate conversion

NSScreen uses Cocoa coordinates (y=0 at bottom of main screen). System Events (AppleScript window position) uses y=0 at top-left of main screen.

```
screenSE_Y = mainScreenHeight - nsY - nsH
```

Then screen-relative crop coordinates:
```
cropX = windowGlobalX - screenSE_X
cropY = windowGlobalY - screenSE_Y
```

## Window-to-screen matching

```typescript
// 1. Center-point containment (preferred)
const centerX = globalX + width / 2;
const centerY = globalY + height / 2;
const screenIndex = screens.findIndex(s =>
  centerX >= s.x && centerX < s.x + s.w &&
  centerY >= s.y && centerY < s.y + s.h
);

// 2. Max overlap area (fallback when center is in a gap/bezel)
if (screenIndex === -1) {
  let bestOverlap = -1;
  screens.forEach((s, i) => {
    const ox = Math.max(0, Math.min(globalX + winW, s.x + s.w) - Math.max(globalX, s.x));
    const oy = Math.max(0, Math.min(globalY + winH, s.y + s.h) - Math.max(globalY, s.y));
    const overlap = ox * oy;
    if (overlap > bestOverlap) { bestOverlap = overlap; screenIndex = i; }
  });
}
```

## h264 requirement

Width and height must be even numbers for h264 encoding:
```typescript
const toEven = (n: number) => n % 2 === 0 ? n : n + 1;
```

## Invoke via TypeScript (no temp files)

```typescript
const proc = cp.spawn('osascript', ['-'], { stdio: ['pipe', 'pipe', 'pipe'] });
proc.stdin.write(script);
proc.stdin.end();
// handle stdout/close events...
```

## Screen pixel density (Retina)

This approach uses logical (point) coordinates from NSScreen/System Events. avfoundation with the crop filter also operates in logical points on macOS. No Retina 2× multiplication needed for standard avfoundation crop capture. If capturing at physical resolution (e.g., with `-pixel_format uyvy422` or similar), multiply by the screen's `backingScaleFactor`.
