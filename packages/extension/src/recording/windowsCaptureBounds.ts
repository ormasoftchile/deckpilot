export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function buildWindowsBoundsScript(windowHandle?: string): string {
  const handleExpression = windowHandle && /^\d+$/.test(windowHandle) && windowHandle !== '0'
    ? `[IntPtr]${windowHandle}`
    : '[WinCaptureBounds]::GetForegroundWindow()';

  return [
    'Add-Type @"',
    'using System;',
    'using System.Runtime.InteropServices;',
    'public static class WinCaptureBounds {',
    '  public const int DWMWA_EXTENDED_FRAME_BOUNDS = 9;',
    '  public const int SM_XVIRTUALSCREEN = 76;',
    '  public const int SM_YVIRTUALSCREEN = 77;',
    '  public const int SM_CXVIRTUALSCREEN = 78;',
    '  public const int SM_CYVIRTUALSCREEN = 79;',
    '  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();',
    '  [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr value);',
    '  [DllImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)]',
    '  public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);',
    '  [DllImport("user32.dll")] public static extern int GetSystemMetrics(int index);',
    '  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(',
    '    IntPtr hWnd, int attribute, out RECT value, int size);',
    '  [StructLayout(LayoutKind.Sequential)]',
    '  public struct RECT { public int Left, Top, Right, Bottom; }',
    '}',
    '"@',
    '[WinCaptureBounds]::SetThreadDpiAwarenessContext([IntPtr](-4)) | Out-Null',
    `$hwnd = ${handleExpression}`,
    'if ($hwnd -eq [IntPtr]::Zero) { throw "No foreground window" }',
    '$rect = New-Object WinCaptureBounds+RECT',
    '$result = [WinCaptureBounds]::DwmGetWindowAttribute(',
    '  $hwnd, [WinCaptureBounds]::DWMWA_EXTENDED_FRAME_BOUNDS, [ref]$rect,',
    '  [Runtime.InteropServices.Marshal]::SizeOf($rect))',
    'if ($result -ne 0) {',
    '  if (-not [WinCaptureBounds]::GetWindowRect($hwnd, [ref]$rect)) {',
    '    throw "Could not read foreground window bounds"',
    '  }',
    '}',
    '$virtualX = [WinCaptureBounds]::GetSystemMetrics([WinCaptureBounds]::SM_XVIRTUALSCREEN)',
    '$virtualY = [WinCaptureBounds]::GetSystemMetrics([WinCaptureBounds]::SM_YVIRTUALSCREEN)',
    '$virtualRight = $virtualX + [WinCaptureBounds]::GetSystemMetrics([WinCaptureBounds]::SM_CXVIRTUALSCREEN)',
    '$virtualBottom = $virtualY + [WinCaptureBounds]::GetSystemMetrics([WinCaptureBounds]::SM_CYVIRTUALSCREEN)',
    '$left = [Math]::Max($rect.Left, $virtualX)',
    '$top = [Math]::Max($rect.Top, $virtualY)',
    '$right = [Math]::Min($rect.Right, $virtualRight)',
    '$bottom = [Math]::Min($rect.Bottom, $virtualBottom)',
    '$width = $right - $left',
    '$height = $bottom - $top',
    'if ($width -le 0 -or $height -le 0) { throw "Foreground window is outside the virtual desktop" }',
    'Write-Output "$left,$top,$width,$height"',
  ].join('\n');
}

export function parseWindowsBounds(output: string): WindowBounds | undefined {
  const parts = output.trim().split(',').map(Number);
  if (parts.length !== 4 || parts.some(value => !Number.isInteger(value))) {
    return undefined;
  }
  const [x, y, width, height] = parts;
  return width > 0 && height > 0 ? { x, y, width, height } : undefined;
}

export function resolveWindowPlaceholders(
  command: string,
  bounds: WindowBounds | undefined,
): string {
  if (!/\{\{window(X|Y|Width|Height)\}\}/.test(command)) {
    return command;
  }
  if (!bounds) {
    throw new Error('Could not detect physical foreground window bounds; refusing desktop capture fallback.');
  }
  return command
    .replace(/\{\{windowX\}\}/g, String(bounds.x))
    .replace(/\{\{windowY\}\}/g, String(bounds.y))
    .replace(/\{\{windowWidth\}\}/g, String(bounds.width))
    .replace(/\{\{windowHeight\}\}/g, String(bounds.height));
}