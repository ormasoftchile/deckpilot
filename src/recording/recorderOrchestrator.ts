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
import * as os from 'os';
import * as fs from 'fs';
import { RecorderMetadata } from '../models/recording';

export interface RecorderConfig {
  startCommand: string;
  stopCommand: string;
  outputDir: string;
  outputExtension: string;
  /** avfoundation / directshow screen device identifier, e.g. "0:none" or "1" */
  screenDevice: string;
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
    screenDevice: config.get<string>('screenDevice', '0:none'),
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

      this.outputChannel.appendLine(
        `[Recorder] Spawning: ${this.resolvedStartCmd}`,
      );

      // Spawn via shell so the process runs in the user's shell context.
      // On macOS this ensures TCC screen-recording permission is evaluated
      // against the shell (which inherits the user session) rather than
      // Code Helper (Plugin) directly.  The shell execs into ffmpeg, so
      // stdin still reaches the recorder process for graceful quit.
      this.process = cp.spawn(this.resolvedStartCmd, [], {
        shell: true,
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
      .replace(/\{\{sessionId\}\}/g, sessionId)
      .replace(/\{\{screenDevice\}\}/g, this.config.screenDevice);

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
  private async getWindowBounds(): Promise<{ x: number; y: number; width: number; height: number } | undefined> {
    if (process.platform === 'win32') {
      return this.getWindowBoundsWindows();
    }
    if (process.platform === 'darwin') {
      return this.getWindowBoundsMac();
    }
    return undefined;
  }

  /**
   * Get the VS Code window bounds on macOS using osascript.
   */
  private getWindowBoundsMac(): Promise<{ x: number; y: number; width: number; height: number } | undefined> {
    return new Promise((resolve) => {
      const script = [
        'tell application "System Events"',
        '  tell process "Code"',
        '    set {px, py} to position of window 1',
        '    set {pw, ph} to size of window 1',
        '  end tell',
        'end tell',
        'return (px as string) & "," & (py as string) & "," & (pw as string) & "," & (ph as string)',
      ].join('\n');

      cp.exec(
        `osascript -e '${script.replace(/'/g, "'\"'\"'")}'`,
        { timeout: 5000 },
        (err, stdout) => {
          if (err) {
            this.outputChannel.appendLine(`[Recorder] macOS window bounds error: ${err.message}`);
            resolve(undefined);
            return;
          }
          const parts = stdout.trim().split(',').map(Number);
          if (parts.length === 4 && parts.every(n => !isNaN(n)) && parts[2] > 0 && parts[3] > 0) {
            resolve({ x: parts[0], y: parts[1], width: parts[2], height: parts[3] });
          } else {
            this.outputChannel.appendLine(`[Recorder] Unexpected macOS bounds output: ${stdout.trim()}`);
            resolve(undefined);
          }
        },
      );
    });
  }

  /**
   * Get the VS Code window bounds on Windows using a PowerShell script.
   * Finds the foreground window and reads its rect.
   */
  private getWindowBoundsWindows(): Promise<{ x: number; y: number; width: number; height: number } | undefined> {
    return new Promise((resolve) => {
      const script = [
        'Add-Type @"',
        'using System;',
        'using System.Runtime.InteropServices;',
        'public class WinRect {',
        '  [DllImport("user32.dll")]',
        '  public static extern IntPtr GetForegroundWindow();',
        '  [DllImport("user32.dll")]',
        '  [return: MarshalAs(UnmanagedType.Bool)]',
        '  public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);',
        '  [StructLayout(LayoutKind.Sequential)]',
        '  public struct RECT { public int Left, Top, Right, Bottom; }',
        '}',
        '"@',
        '$hwnd = [WinRect]::GetForegroundWindow()',
        '$rect = New-Object WinRect+RECT',
        '[WinRect]::GetWindowRect($hwnd, [ref]$rect) | Out-Null',
        '$w = $rect.Right - $rect.Left',
        '$h = $rect.Bottom - $rect.Top',
        'Write-Output "$($rect.Left),$($rect.Top),$w,$h"',
      ].join('\n');

      const tmpFile = path.join(os.tmpdir(), 'et-window-bounds.ps1');
      fs.writeFileSync(tmpFile, script, 'utf-8');

      cp.exec(
        `powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpFile}"`,
        { timeout: 5000 },
        (err, stdout) => {
          if (err) {
            this.outputChannel.appendLine(`[Recorder] Window bounds error: ${err.message}`);
            resolve(undefined);
            return;
          }

          const parts = stdout.trim().split(',').map(Number);
          if (parts.length === 4 && parts.every(n => !isNaN(n)) && parts[2] > 0 && parts[3] > 0) {
            resolve({ x: parts[0], y: parts[1], width: parts[2], height: parts[3] });
          } else {
            this.outputChannel.appendLine(`[Recorder] Unexpected bounds output: ${stdout.trim()}`);
            resolve(undefined);
          }
        },
      );
    });
  }
}

