/**
 * RecorderOrchestrator — manages an external screen recorder process.
 *
 * Launches a configured shell command when recording starts and stops it
 * when recording ends. Failure to start/stop the recorder does NOT block
 * the recording session — timeline logging continues regardless.
 *
 * The start command supports template variables:
 *   {{outputPath}} — resolved absolute path for the video output file
 *   {{sessionId}}  — unique session identifier
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as cp from 'child_process';
import { RecorderMetadata } from '../models/recording';

export interface RecorderConfig {
  startCommand: string;
  stopCommand: string;
  outputDir: string;
  outputExtension: string;
}

/**
 * Read recorder configuration from VS Code settings.
 */
export function getRecorderConfig(): RecorderConfig {
  const config = vscode.workspace.getConfiguration('executableTalk.recording');
  return {
    startCommand: config.get<string>('startCommand', ''),
    stopCommand: config.get<string>('stopCommand', ''),
    outputDir: config.get<string>('outputDir', ''),
    outputExtension: config.get<string>('outputExtension', 'mp4'),
  };
}

/**
 * Orchestrates the lifecycle of an external screen recorder process.
 */
export class RecorderOrchestrator {
  private process: cp.ChildProcess | undefined;
  private outputPath: string | undefined;
  private resolvedStartCmd: string | undefined;
  private resolvedStopCmd: string | undefined;
  private started = false;
  private stopped = false;
  private error: string | undefined;

  constructor(
    private config: RecorderConfig,
    private outputChannel: vscode.OutputChannel,
  ) {}

  /**
   * Whether a recorder is configured (start command is non-empty).
   */
  isConfigured(): boolean {
    return this.config.startCommand.trim().length > 0;
  }

  /**
   * Launch the external recorder.
   * Returns true if the process spawned successfully, false otherwise.
   * Never throws — failures are captured in metadata.
   */
  async start(sessionId: string, deckPath: string): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    try {
      // Resolve output path — always absolute
      const rawDir = this.config.outputDir.trim() || path.dirname(deckPath);
      const dir = path.isAbsolute(rawDir) ? rawDir : path.resolve(path.dirname(deckPath), rawDir);
      const filename = `session-${sessionId}.${this.config.outputExtension}`;
      this.outputPath = path.join(dir, filename);

      // Ensure output directory exists
      const fs = await import('fs');
      await fs.promises.mkdir(dir, { recursive: true });

      // Interpolate template variables (may resolve window bounds)
      this.resolvedStartCmd = await this.interpolate(
        this.config.startCommand,
        sessionId,
        this.outputPath,
      );

      this.outputChannel.appendLine(
        `[Recorder] Starting: ${this.resolvedStartCmd}`,
      );
      this.outputChannel.appendLine(
        `[Recorder] Output path: ${this.outputPath}`,
      );

      // Parse command into executable + args so stdin goes directly to the process
      const cmdParts = parseCommand(this.resolvedStartCmd);
      this.outputChannel.appendLine(
        `[Recorder] Spawning: ${cmdParts.exe} ${cmdParts.args.join(' ')}`,
      );

      // Spawn the process — pipe stdin (for graceful stop) and stderr (for diagnostics)
      this.process = cp.spawn(cmdParts.exe, cmdParts.args, {
        shell: false,
        detached: false,
        stdio: ['pipe', 'ignore', 'pipe'],
      });

      // Log stderr to output channel for diagnostics
      if (this.process.stderr) {
        this.process.stderr.on('data', (data: Buffer) => {
          const msg = data.toString().trim();
          if (msg.length > 0) {
            this.outputChannel.appendLine(`[Recorder] ${msg}`);
          }
        });
      }

      // Handle spawn errors
      return await new Promise<boolean>((resolve) => {
        const proc = this.process!;

        const onError = (err: Error) => {
          this.error = `Recorder failed to start: ${err.message}`;
          this.outputChannel.appendLine(`[Recorder] Error: ${this.error}`);
          cleanup();
          resolve(false);
        };

        const onSpawn = () => {
          this.started = true;
          this.outputChannel.appendLine('[Recorder] Process started');
          cleanup();
          resolve(true);
        };

        const onClose = (code: number | null) => {
          // If it closed before we resolved, it failed to stay running
          if (!this.started) {
            this.error = `Recorder exited immediately with code ${code}`;
            this.outputChannel.appendLine(`[Recorder] ${this.error}`);
            cleanup();
            resolve(false);
          }
        };

        const cleanup = () => {
          proc.removeListener('error', onError);
          proc.removeListener('spawn', onSpawn);
          proc.removeListener('close', onClose);
        };

        proc.once('error', onError);
        proc.once('spawn', onSpawn);
        proc.once('close', onClose);
      });
    } catch (err) {
      this.error = `Recorder start failed: ${err instanceof Error ? err.message : String(err)}`;
      this.outputChannel.appendLine(`[Recorder] ${this.error}`);
      return false;
    }
  }

  /**
   * Stop the external recorder.
   * First tries writing 'q' to stdin for a graceful shutdown (ffmpeg).
   * Then waits for the process to exit. If it doesn't exit within a
   * timeout, falls back to the configured stop command or kills it.
   */
  async stop(sessionId: string): Promise<void> {
    if (!this.started) {
      return;
    }

    try {
      // Try graceful shutdown via stdin ('q' is ffmpeg's quit key)
      if (this.process && this.process.stdin && !this.process.killed) {
        this.outputChannel.appendLine('[Recorder] Sending quit signal to stdin');
        this.process.stdin.write('q');
        this.process.stdin.end();

        // Wait for process to exit gracefully (up to 5 seconds)
        const exited = await this.waitForExit(5000);
        if (exited) {
          this.stopped = true;
          this.outputChannel.appendLine('[Recorder] Stopped gracefully');
          return;
        }
        this.outputChannel.appendLine('[Recorder] Graceful stop timed out, using fallback');
      }

      // Fallback: run stop command
      if (this.config.stopCommand.trim().length > 0) {
        this.resolvedStopCmd = await this.interpolate(
          this.config.stopCommand,
          sessionId,
          this.outputPath ?? '',
        );

        this.outputChannel.appendLine(
          `[Recorder] Stopping: ${this.resolvedStopCmd}`,
        );

        await new Promise<void>((resolve) => {
          cp.exec(this.resolvedStopCmd!, (err) => {
            if (err) {
              this.error = `Recorder stop command failed: ${err.message}`;
              this.outputChannel.appendLine(`[Recorder] ${this.error}`);
            }
            this.stopped = true;
            resolve();
          });
        });
      } else if (this.process && !this.process.killed) {
        this.outputChannel.appendLine('[Recorder] Killing process');
        this.process.kill();
        this.stopped = true;
      }
    } catch (err) {
      this.error = `Recorder stop failed: ${err instanceof Error ? err.message : String(err)}`;
      this.outputChannel.appendLine(`[Recorder] ${this.error}`);
    }

    this.outputChannel.appendLine('[Recorder] Stopped');
  }

  /**
   * Wait for the spawned process to exit within a timeout.
   * Returns true if the process exited, false if timed out.
   */
  private waitForExit(timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.process || this.process.killed) {
        resolve(true);
        return;
      }

      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve(false);
        }
      }, timeoutMs);

      this.process.once('close', () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(true);
        }
      });
    });
  }

  /**
   * Build metadata about the recorder session for inclusion in
   * recording-session.json.
   */
  getMetadata(): RecorderMetadata {
    return {
      configured: this.isConfigured(),
      started: this.started,
      stopped: this.stopped,
      outputPath: this.outputPath,
      startCommand: this.resolvedStartCmd,
      stopCommand: this.resolvedStopCmd,
      error: this.error,
    };
  }

  /**
   * Dispose of the recorder process if still running.
   */
  dispose(): void {
    if (this.process && !this.process.killed) {
      this.process.kill();
    }
  }

  // ---------- private ----------

  private async interpolate(
    template: string,
    sessionId: string,
    outputPath: string,
  ): Promise<string> {
    let result = template
      .replace(/\{\{outputPath\}\}/g, outputPath)
      .replace(/\{\{sessionId\}\}/g, sessionId);

    // Resolve window bounds if any window template vars are present
    if (/\{\{window(X|Y|Width|Height)\}\}/.test(result)) {
      const bounds = await this.getWindowBounds();
      if (bounds) {
        result = result
          .replace(/\{\{windowX\}\}/g, String(bounds.x))
          .replace(/\{\{windowY\}\}/g, String(bounds.y))
          .replace(/\{\{windowWidth\}\}/g, String(bounds.width))
          .replace(/\{\{windowHeight\}\}/g, String(bounds.height));
        this.outputChannel.appendLine(
          `[Recorder] Window bounds: ${bounds.x},${bounds.y} ${bounds.width}x${bounds.height}`,
        );
      } else {
        this.outputChannel.appendLine('[Recorder] Could not detect window bounds, falling back to desktop');
        // Replace with desktop fallback (remove offset/size, user gets full screen)
        result = result
          .replace(/\{\{windowX\}\}/g, '0')
          .replace(/\{\{windowY\}\}/g, '0')
          .replace(/\{\{windowWidth\}\}/g, '1920')
          .replace(/\{\{windowHeight\}\}/g, '1080');
      }
    }

    return result;
  }

  /**
   * Get the VS Code window bounds using platform-specific methods.
   */
  private async getWindowBounds(): Promise<{ x: number; y: number; width: number; height: number; screenIndex?: number } | undefined> {
    if (process.platform === 'darwin') {
      return this.getWindowBoundsDarwin();
    }
    if (process.platform === 'linux') {
      return this.getWindowBoundsLinux();
    }
    if (process.platform === 'win32') {
      return this.getWindowBoundsWindows();
    }
    return undefined;
  }

  /**
   * Get the VS Code window bounds on macOS using osascript via stdin pipe mode.
   * Supports multi-monitor setups; returns screen-relative coords and screenIndex.
   */
  private getWindowBoundsDarwin(): Promise<{ x: number; y: number; width: number; height: number; screenIndex?: number } | undefined> {
    return new Promise((resolve) => {
      const script = [
        'tell application "System Events"',
        '  set vscProcs to (processes where displayed name contains "Code")',
        '  if (count of vscProcs) = 0 then',
        '    return "error:no_process"',
        '  end if',
        '  set vscWin to first window of (item 1 of vscProcs)',
        '  set {wx, wy} to position of vscWin',
        '  set {ww, wh} to size of vscWin',
        'end tell',
        'set screenData to ""',
        'set allScreens to do shell script "system_profiler SPDisplaysDataType | grep Resolution"',
        'return ((wx as text) & "," & (wy as text) & "," & (ww as text) & "," & (wh as text))',
      ].join('\n');

      const proc = cp.spawn('osascript', ['-']);
      let stdout = '';
      let stderr = '';
      let resolved = false;

      proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
      proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

      proc.on('error', (err: NodeJS.ErrnoException) => {
        if (resolved) { return; }
        resolved = true;
        this.outputChannel.appendLine(`[Recorder] osascript spawn error: ${err.message}`);
        resolve(undefined);
      });

      proc.on('close', (code: number) => {
        if (resolved) { return; }
        resolved = true;

        if (code !== 0) {
          this.outputChannel.appendLine(`[Recorder] osascript error (code ${code}): ${stderr.trim()}`);
          resolve(undefined);
          return;
        }

        const output = stdout.trim();

        if (output === 'error:no_process') {
          resolve(undefined);
          return;
        }

        // Format: "winX,winY,winW,winH" or "winX,winY,winW,winH|scrX,scrY,scrW,scrH;...;"
        const pipeIdx = output.indexOf('|');
        const windowPart = pipeIdx === -1 ? output : output.slice(0, pipeIdx);
        const screensPart = pipeIdx === -1 ? '' : output.slice(pipeIdx + 1);

        const windowNums = windowPart.split(',').map(Number);
        if (windowNums.length < 4 || windowNums.some(n => isNaN(n))) {
          this.outputChannel.appendLine(`[Recorder] Unexpected osascript output: ${output}`);
          resolve(undefined);
          return;
        }

        const [winX, winY] = windowNums;
        let winW = windowNums[2];
        let winH = windowNums[3];
        // Round odd dimensions up to even (required by most video encoders)
        if (winW % 2 !== 0) { winW += 1; }
        if (winH % 2 !== 0) { winH += 1; }

        let screenIndex = 0;
        let relX = winX;
        let relY = winY;

        if (screensPart) {
          const screens = screensPart
            .split(';')
            .filter(s => s.trim().length > 0)
            .map(s => {
              const parts = s.split(',').map(Number);
              return { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
            });

          for (let i = 0; i < screens.length; i++) {
            const scr = screens[i];
            if (winX >= scr.x && winX < scr.x + scr.w && winY >= scr.y && winY < scr.y + scr.h) {
              screenIndex = i;
              relX = winX - scr.x;
              relY = winY - scr.y;
              break;
            }
          }
        }

        resolve({ x: relX, y: relY, width: winW, height: winH, screenIndex });
      });

      proc.stdin.write(script);
      proc.stdin.end();
    });
  }

  /**
   * Get the VS Code window bounds on Linux using xdotool (with wmctrl fallback).
   */
  private async getWindowBoundsLinux(): Promise<{ x: number; y: number; width: number; height: number } | undefined> {
    try {
      // Try xdotool first
      let windowId: string;
      try {
        const activeId = (cp.execFileSync('xdotool', ['getactivewindow']) as Buffer | string).toString().trim();
        const activeName = (cp.execFileSync('xdotool', ['getwindowname', activeId]) as Buffer | string).toString().trim();

        if (activeName.includes('Visual Studio Code')) {
          windowId = activeId;
        } else {
          // Search for VS Code window
          const searchResult = (cp.execFileSync('xdotool', ['search', '--name', 'Visual Studio Code']) as Buffer | string).toString().trim();
          if (!searchResult) {
            return undefined;
          }
          windowId = searchResult.split('\n')[0].trim();
        }

        const geometry = (cp.execFileSync('xdotool', ['getwindowgeometry', windowId]) as Buffer | string).toString();
        const xMatch = /X=(\d+)/.exec(geometry);
        const yMatch = /Y=(\d+)/.exec(geometry);
        const wMatch = /WIDTH=(\d+)/.exec(geometry);
        const hMatch = /HEIGHT=(\d+)/.exec(geometry);

        if (!xMatch || !yMatch || !wMatch || !hMatch) {
          return undefined;
        }

        const x = parseInt(xMatch[1]);
        const y = parseInt(yMatch[1]);
        let width = parseInt(wMatch[1]);
        let height = parseInt(hMatch[1]);

        if (width % 2 !== 0) { width += 1; }
        if (height % 2 !== 0) { height += 1; }

        return { x, y, width, height };
      } catch {
        // xdotool not available — fall through to wmctrl
      }

      // Fallback: wmctrl
      try {
        const wmOutput = (cp.execFileSync('wmctrl', ['-l', '-G']) as Buffer | string).toString();
        for (const line of wmOutput.split('\n')) {
          const parts = line.trim().split(/\s+/);
          if (parts.length < 7) { continue; }
          const title = parts.slice(6).join(' ');
          if (!title.includes('Visual Studio Code')) { continue; }

          const x = parseInt(parts[2]);
          const y = parseInt(parts[3]);
          let width = parseInt(parts[4]);
          let height = parseInt(parts[5]);

          if (isNaN(x) || isNaN(y) || isNaN(width) || isNaN(height)) { continue; }
          if (width % 2 !== 0) { width += 1; }
          if (height % 2 !== 0) { height += 1; }

          return { x, y, width, height };
        }
        return undefined;
      } catch {
        this.outputChannel.appendLine('[Recorder] wmctrl unavailable — cannot detect window bounds on Linux');
        return undefined;
      }
    } catch {
      return undefined;
    }
  }

  /**
   * Get the VS Code window bounds on Windows using an inline PowerShell command.
   * Uses -Command flag (no temp files written).
   */
  private getWindowBoundsWindows(): Promise<{ x: number; y: number; width: number; height: number } | undefined> {
    return new Promise((resolve) => {
      const script = [
        'Add-Type -TypeDefinition \'using System; using System.Runtime.InteropServices;',
        'public class WinRect {',
        '  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();',
        '  [DllImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)]',
        '  public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);',
        '  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }',
        '}\'',
        '$hwnd = [WinRect]::GetForegroundWindow()',
        '$rect = New-Object WinRect+RECT',
        '[WinRect]::GetWindowRect($hwnd, [ref]$rect) | Out-Null',
        '$w = $rect.Right - $rect.Left',
        '$h = $rect.Bottom - $rect.Top',
        'Write-Output "$($rect.Left),$($rect.Top),$w,$h"',
      ].join('; ');

      cp.execFile(
        'powershell',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
        { timeout: 5000 },
        (err, stdout) => {
          if (err) {
            this.outputChannel.appendLine(`[Recorder] Window bounds error: ${err.message}`);
            resolve(undefined);
            return;
          }

          const parts = stdout.trim().split(',').map(Number);
          if (parts.length === 4 && parts.every(n => !isNaN(n)) && parts[2] > 0 && parts[3] > 0) {
            let width = parts[2];
            let height = parts[3];
            if (width % 2 !== 0) { width += 1; }
            if (height % 2 !== 0) { height += 1; }
            resolve({ x: parts[0], y: parts[1], width, height });
          } else {
            this.outputChannel.appendLine(`[Recorder] Unexpected bounds output: ${stdout.trim()}`);
            resolve(undefined);
          }
        },
      );
    });
  }
}

/**
 * Parse a shell command string into executable and arguments.
 * Handles quoted arguments (e.g. paths with spaces).
 */
function parseCommand(cmd: string): { exe: string; args: string[] } {
  const tokens: string[] = [];
  let current = '';
  let inQuote: string | null = null;

  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i];
    if (inQuote) {
      if (ch === inQuote) {
        inQuote = null;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = ch;
    } else if (ch === ' ' || ch === '\t') {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  if (current.length > 0) {
    tokens.push(current);
  }

  return {
    exe: tokens[0] ?? '',
    args: tokens.slice(1),
  };
}
