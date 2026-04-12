/**
 * Unit tests for cross-platform window bounds detection.
 * Covers: getWindowBoundsDarwin, getWindowBoundsLinux, getWindowBoundsWindows,
 * and the getWindowBounds platform dispatch.
 *
 * Mocking strategy: mutate require('child_process') and require('fs') exports
 * at runtime. CommonJS module caching means RecorderOrchestrator sees the same
 * stubs. Platform dispatch is verified by replacing private methods on the
 * orchestrator instance before calling the dispatcher.
 */

import { expect } from 'chai';
import { EventEmitter } from 'events';
import type * as cpTypes from 'child_process';
import type * as fsTypes from 'fs';
import {
  RecorderOrchestrator,
  RecorderConfig,
} from '../../../src/recording/recorderOrchestrator';

// Access the real module.exports objects so mutations are visible to all
// __importStar wrappers that share the same require.cache entry.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cpMod = require('child_process') as typeof cpTypes;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fsMod = require('fs') as typeof fsTypes;

// ─── types ────────────────────────────────────────────────────────────────────

type WindowBounds = { x: number; y: number; width: number; height: number; screenIndex?: number };
type ExecFileCb = (error: Error | null, stdout: string, stderr: string) => void;

// ─── fixtures ─────────────────────────────────────────────────────────────────

const EMPTY_CONFIG: RecorderConfig = {
  startCommand: '',
  stopCommand: '',
  outputDir: '',
  outputExtension: 'mp4',
};

interface LogChannel {
  appendLine(msg: string): void;
  lines: string[];
}

function makeChannel(): LogChannel {
  const lines: string[] = [];
  return { lines, appendLine: (msg: string) => lines.push(msg) };
}

function makeOrchestrator(): { orchestrator: RecorderOrchestrator; channel: LogChannel } {
  const channel = makeChannel();
  return {
    orchestrator: new RecorderOrchestrator(EMPTY_CONFIG, channel as any),
    channel,
  };
}

/**
 * Build a fake ChildProcess for Darwin (spawn-based) tests.
 * All events fire in the next tick so the code has time to attach listeners.
 */
function fakeDarwinProcess(opts: {
  stdout?: string;
  stderr?: string;
  closeCode?: number;
  errorEvent?: Error;
}): cpTypes.ChildProcess {
  const proc = new EventEmitter() as any;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.stdin = { write: () => {}, end: () => {} };
  proc.kill = () => {};

  process.nextTick(() => {
    if (opts.errorEvent) {
      proc.emit('error', opts.errorEvent);
      return;
    }
    if (opts.stdout !== undefined) {
      proc.stdout.emit('data', Buffer.from(opts.stdout));
    }
    if (opts.stderr !== undefined) {
      proc.stderr.emit('data', Buffer.from(opts.stderr));
    }
    proc.emit('close', opts.closeCode ?? 0);
  });

  return proc as cpTypes.ChildProcess;
}

// ─── save / restore child_process stubs ───────────────────────────────────────

const origSpawn        = cpMod.spawn;
const origExecFile     = cpMod.execFile;
const origExecFileSync = cpMod.execFileSync;

afterEach(() => {
  (cpMod as any).spawn        = origSpawn;
  (cpMod as any).execFile     = origExecFile;
  (cpMod as any).execFileSync = origExecFileSync;
});

// ─── getWindowBoundsDarwin ────────────────────────────────────────────────────

describe('RecorderOrchestrator — getWindowBoundsDarwin()', () => {
  it('happy path: window on single screen → screen-relative coords and screenIndex 0', async () => {
    // New output format: "winX,winY,winW,winH|seX,seY,nsW,nsH;"
    (cpMod as any).spawn = () => fakeDarwinProcess({ stdout: '100,200,1440,900|0,0,1920,1080;\n' });
    const { orchestrator } = makeOrchestrator();
    const result = await (orchestrator as any).getWindowBoundsDarwin() as WindowBounds | undefined;
    expect(result).to.deep.equal({ x: 100, y: 200, width: 1440, height: 900, screenIndex: 0 });
  });

  it('happy path: legacy output (no screen data) falls back to global coords with screenIndex 0', async () => {
    (cpMod as any).spawn = () => fakeDarwinProcess({ stdout: '100,200,1440,900\n' });
    const { orchestrator } = makeOrchestrator();
    const result = await (orchestrator as any).getWindowBoundsDarwin() as WindowBounds | undefined;
    expect(result).to.deep.equal({ x: 100, y: 200, width: 1440, height: 900, screenIndex: 0 });
  });

  it('multi-screen: window on secondary screen → screen-relative coords and screenIndex 1', async () => {
    // Main screen: 0,0,1920,1080. Secondary screen starts at global x=1920.
    // Window at global 2020,100 (100px into secondary screen).
    (cpMod as any).spawn = () => fakeDarwinProcess({ stdout: '2020,100,1440,900|0,0,1920,1080;1920,0,2560,1440;\n' });
    const { orchestrator } = makeOrchestrator();
    const result = await (orchestrator as any).getWindowBoundsDarwin() as WindowBounds | undefined;
    expect(result?.screenIndex).to.equal(1);
    expect(result?.x).to.equal(100);   // 2020 - 1920
    expect(result?.y).to.equal(100);   // 100  - 0
    expect(result?.width).to.equal(1440);
    expect(result?.height).to.equal(900);
  });

  it('rounds odd width and height up to nearest even number', async () => {
    (cpMod as any).spawn = () => fakeDarwinProcess({ stdout: '100,200,1441,901|0,0,1920,1080;\n' });
    const { orchestrator } = makeOrchestrator();
    const result = await (orchestrator as any).getWindowBoundsDarwin() as WindowBounds | undefined;
    expect(result?.x).to.equal(100);
    expect(result?.y).to.equal(200);
    expect(result?.width).to.equal(1442);
    expect(result?.height).to.equal(902);
  });

  it('returns undefined when osascript reports "error:no_process"', async () => {
    (cpMod as any).spawn = () => fakeDarwinProcess({ stdout: 'error:no_process\n' });
    const { orchestrator } = makeOrchestrator();
    const result = await (orchestrator as any).getWindowBoundsDarwin();
    expect(result).to.be.undefined;
  });

  it('returns undefined and logs when osascript exits with non-zero code', async () => {
    (cpMod as any).spawn = () =>
      fakeDarwinProcess({ stdout: '', stderr: 'Not authorized', closeCode: 1 });
    const { orchestrator, channel } = makeOrchestrator();
    const result = await (orchestrator as any).getWindowBoundsDarwin();
    expect(result).to.be.undefined;
    expect(channel.lines.some(l => l.includes('[Recorder] osascript error'))).to.be.true;
  });

  it('returns undefined and logs gracefully when osascript is not found (ENOENT)', async () => {
    const err = Object.assign(new Error('spawn osascript ENOENT'), { code: 'ENOENT' });
    (cpMod as any).spawn = () => fakeDarwinProcess({ errorEvent: err });
    const { orchestrator, channel } = makeOrchestrator();
    const result = await (orchestrator as any).getWindowBoundsDarwin();
    expect(result).to.be.undefined;
    expect(channel.lines.some(l => l.includes('[Recorder] osascript spawn error'))).to.be.true;
  });

  it('returns undefined when osascript outputs garbage', async () => {
    (cpMod as any).spawn = () => fakeDarwinProcess({ stdout: 'not_valid_output_at_all\n' });
    const { orchestrator, channel } = makeOrchestrator();
    const result = await (orchestrator as any).getWindowBoundsDarwin();
    expect(result).to.be.undefined;
    expect(channel.lines.some(l => l.includes('Unexpected osascript output'))).to.be.true;
  });

  it('uses stdin pipe mode — spawns osascript with ["-"] (no temp files)', async () => {
    let capturedCmd = '';
    let capturedArgs: string[] = [];
    (cpMod as any).spawn = (cmd: string, args: string[]) => {
      capturedCmd = cmd;
      capturedArgs = args;
      return fakeDarwinProcess({ stdout: '0,30,1920,900\n' });
    };
    const { orchestrator } = makeOrchestrator();
    await (orchestrator as any).getWindowBoundsDarwin();
    expect(capturedCmd).to.equal('osascript');
    expect(capturedArgs).to.deep.equal(['-']);
  });
});

// ─── getWindowBoundsLinux ─────────────────────────────────────────────────────

describe('RecorderOrchestrator — getWindowBoundsLinux()', () => {
  /**
   * Build an execFileSync stub keyed by "cmd:args[0]".
   * Values can be a return string or an Error to throw.
   */
  function makeExecFileSyncStub(
    responses: Record<string, string | Error>,
  ): typeof cpMod.execFileSync {
    return ((cmd: string, args: string[]) => {
      const key = `${cmd}:${(args as string[])[0]}`;
      const val = responses[key];
      if (val instanceof Error) { throw val; }
      if (val !== undefined) { return val; }
      throw new Error(`Unexpected execFileSync call: ${cmd} ${(args as string[]).join(' ')}`);
    }) as unknown as typeof cpMod.execFileSync;
  }

  it('happy path: active window IS VS Code → returns correct bounds', async () => {
    (cpMod as any).execFileSync = makeExecFileSyncStub({
      'xdotool:getactivewindow':  '12345\n',
      'xdotool:getwindowname':    'Visual Studio Code\n',
      'xdotool:getwindowgeometry': 'X=100\nY=200\nWIDTH=1440\nHEIGHT=900\n',
    });
    const { orchestrator } = makeOrchestrator();
    const result = await (orchestrator as any).getWindowBoundsLinux() as WindowBounds | undefined;
    expect(result).to.deep.equal({ x: 100, y: 200, width: 1440, height: 900 });
  });

  it('falls back to xdotool search when active window is not VS Code', async () => {
    (cpMod as any).execFileSync = makeExecFileSyncStub({
      'xdotool:getactivewindow':   '99999\n',
      'xdotool:getwindowname':     'Firefox\n',
      'xdotool:search':            '12345\n',
      'xdotool:getwindowgeometry': 'X=0\nY=30\nWIDTH=1920\nHEIGHT=900\n',
    });
    const { orchestrator } = makeOrchestrator();
    const result = await (orchestrator as any).getWindowBoundsLinux() as WindowBounds | undefined;
    expect(result).to.deep.equal({ x: 0, y: 30, width: 1920, height: 900 });
  });

  it('returns undefined when xdotool search finds no VS Code window', async () => {
    (cpMod as any).execFileSync = makeExecFileSyncStub({
      'xdotool:getactivewindow': '99999\n',
      'xdotool:getwindowname':   'Firefox\n',
      'xdotool:search':          '\n',   // empty result after trim
    });
    const { orchestrator } = makeOrchestrator();
    const result = await (orchestrator as any).getWindowBoundsLinux();
    expect(result).to.be.undefined;
  });

  it('falls back to wmctrl when xdotool is not installed', async () => {
    const wmctrlLine = '0x01234  0 100 200 1440 900 Visual Studio Code';
    (cpMod as any).execFileSync = ((cmd: string) => {
      if (cmd === 'xdotool') { throw new Error('xdotool: not found'); }
      return wmctrlLine + '\n';
    }) as unknown as typeof cpMod.execFileSync;
    const { orchestrator } = makeOrchestrator();
    const result = await (orchestrator as any).getWindowBoundsLinux() as WindowBounds | undefined;
    expect(result).to.deep.equal({ x: 100, y: 200, width: 1440, height: 900 });
  });

  it('wmctrl happy path: skips non-VS Code windows, returns first VS Code window', async () => {
    const wmctrlOutput = [
      '0x00001  0 0 0 800 600 Some Other App',
      '0x00002  0 50 60 1440 900 Visual Studio Code',
      '0x00003  0 0 0 400 300 Another Window',
    ].join('\n') + '\n';
    (cpMod as any).execFileSync = ((cmd: string) => {
      if (cmd === 'xdotool') { throw new Error('not found'); }
      return wmctrlOutput;
    }) as unknown as typeof cpMod.execFileSync;
    const { orchestrator } = makeOrchestrator();
    const result = await (orchestrator as any).getWindowBoundsLinux() as WindowBounds | undefined;
    expect(result).to.deep.equal({ x: 50, y: 60, width: 1440, height: 900 });
  });

  it('returns undefined and logs when both xdotool and wmctrl are unavailable', async () => {
    (cpMod as any).execFileSync = (() => {
      throw new Error('command not found');
    }) as unknown as typeof cpMod.execFileSync;
    const { orchestrator, channel } = makeOrchestrator();
    const result = await (orchestrator as any).getWindowBoundsLinux();
    expect(result).to.be.undefined;
    expect(channel.lines.some(l => l.includes('wmctrl unavailable'))).to.be.true;
  });

  it('rounds odd dimensions to even numbers', async () => {
    (cpMod as any).execFileSync = makeExecFileSyncStub({
      'xdotool:getactivewindow':   '12345\n',
      'xdotool:getwindowname':     'Visual Studio Code\n',
      'xdotool:getwindowgeometry': 'X=0\nY=0\nWIDTH=1441\nHEIGHT=901\n',
    });
    const { orchestrator } = makeOrchestrator();
    const result = await (orchestrator as any).getWindowBoundsLinux() as WindowBounds | undefined;
    expect(result?.width).to.equal(1442);
    expect(result?.height).to.equal(902);
  });
});

// ─── getWindowBoundsWindows ───────────────────────────────────────────────────

describe('RecorderOrchestrator — getWindowBoundsWindows()', () => {
  function stubExecFile(err: Error | null, stdout: string): void {
    (cpMod as any).execFile = (
      _cmd: string,
      _args: string[],
      _opts: unknown,
      cb: ExecFileCb,
    ) => {
      process.nextTick(() => cb(err, stdout, ''));
    };
  }

  it('happy path: PowerShell returns "x,y,w,h" → correct bounds', async () => {
    stubExecFile(null, '100,200,1920,1080\n');
    const { orchestrator } = makeOrchestrator();
    const result = await (orchestrator as any).getWindowBoundsWindows() as WindowBounds | undefined;
    expect(result).to.deep.equal({ x: 100, y: 200, width: 1920, height: 1080 });
  });

  it('returns undefined when PowerShell exits with error (no VS Code process found)', async () => {
    stubExecFile(new Error('Command failed: exit code 1'), '');
    const { orchestrator } = makeOrchestrator();
    const result = await (orchestrator as any).getWindowBoundsWindows();
    expect(result).to.be.undefined;
  });

  it('returns undefined and logs to outputChannel when PowerShell exits with error', async () => {
    stubExecFile(new Error('Command failed: powershell timeout'), '');
    const { orchestrator, channel } = makeOrchestrator();
    const result = await (orchestrator as any).getWindowBoundsWindows();
    expect(result).to.be.undefined;
    expect(channel.lines.some(l => l.includes('[Recorder] Window bounds error'))).to.be.true;
  });

  it('rounds odd dimensions to even numbers', async () => {
    stubExecFile(null, '0,0,1921,1081\n');
    const { orchestrator } = makeOrchestrator();
    const result = await (orchestrator as any).getWindowBoundsWindows() as WindowBounds | undefined;
    expect(result?.width).to.equal(1922);
    expect(result?.height).to.equal(1082);
  });

  it('uses inline -Command flag — no -File flag (no temp files written)', async () => {
    let capturedArgs: string[] = [];
    (cpMod as any).execFile = (
      _cmd: string,
      args: string[],
      _opts: unknown,
      cb: ExecFileCb,
    ) => {
      capturedArgs = args;
      process.nextTick(() => cb(null, '0,0,1920,1080\n', ''));
    };
    const { orchestrator } = makeOrchestrator();
    await (orchestrator as any).getWindowBoundsWindows();
    expect(capturedArgs).to.include('-Command');
    expect(capturedArgs).to.not.include('-File');
  });

  it('does not call fs.writeFileSync (old temp-file approach is gone)', async () => {
    stubExecFile(null, '0,0,1920,1080\n');
    let writeFileSyncCalled = false;
    const origWriteFileSync = fsMod.writeFileSync;
    (fsMod as any).writeFileSync = () => { writeFileSyncCalled = true; };
    const { orchestrator } = makeOrchestrator();
    try {
      await (orchestrator as any).getWindowBoundsWindows();
    } finally {
      (fsMod as any).writeFileSync = origWriteFileSync;
    }
    expect(writeFileSyncCalled).to.be.false;
  });

  it('returns undefined and logs when PowerShell outputs garbage', async () => {
    stubExecFile(null, 'not_valid_output\n');
    const { orchestrator, channel } = makeOrchestrator();
    const result = await (orchestrator as any).getWindowBoundsWindows();
    expect(result).to.be.undefined;
    expect(channel.lines.some(l => l.includes('Unexpected bounds output'))).to.be.true;
  });
});

// ─── getWindowBounds — platform dispatch ─────────────────────────────────────

describe('RecorderOrchestrator — getWindowBounds() platform dispatch', () => {
  const origPlatform = process.platform;

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: origPlatform, configurable: true });
  });

  function setPlatform(p: NodeJS.Platform | string): void {
    Object.defineProperty(process, 'platform', { value: p, configurable: true });
  }

  it('routes to getWindowBoundsDarwin() on darwin', async () => {
    setPlatform('darwin');
    const { orchestrator } = makeOrchestrator();
    let called = false;
    (orchestrator as any).getWindowBoundsDarwin = async () => { called = true; return undefined; };
    await (orchestrator as any).getWindowBounds();
    expect(called).to.be.true;
  });

  it('routes to getWindowBoundsLinux() on linux', async () => {
    setPlatform('linux');
    const { orchestrator } = makeOrchestrator();
    let called = false;
    (orchestrator as any).getWindowBoundsLinux = async () => { called = true; return undefined; };
    await (orchestrator as any).getWindowBounds();
    expect(called).to.be.true;
  });

  it('routes to getWindowBoundsWindows() on win32', async () => {
    setPlatform('win32');
    const { orchestrator } = makeOrchestrator();
    let called = false;
    (orchestrator as any).getWindowBoundsWindows = async () => { called = true; return undefined; };
    await (orchestrator as any).getWindowBounds();
    expect(called).to.be.true;
  });

  it('returns undefined for unknown platforms (e.g. freebsd)', async () => {
    setPlatform('freebsd');
    const { orchestrator } = makeOrchestrator();
    const result = await (orchestrator as any).getWindowBounds();
    expect(result).to.be.undefined;
  });
});
