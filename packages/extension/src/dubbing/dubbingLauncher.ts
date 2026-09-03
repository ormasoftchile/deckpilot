import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { execFile } from 'child_process';
import {
  NarrationArtifacts,
  resolveDubbingExecutable,
  validateNarrationArtifacts,
} from './dubbingDiscovery';

export async function launchNarration(
  artifacts: NarrationArtifacts,
  baseDirectory: string,
): Promise<boolean> {
  const artifactError = await validateNarrationArtifacts(artifacts);
  if (artifactError) {
    await vscode.window.showErrorMessage(`Cannot record narration: ${artifactError}`);
    return false;
  }

  const executable = await requireDubbingExecutable(baseDirectory);
  if (!executable) {
    return false;
  }

  const terminal = vscode.window.createTerminal({
    name: 'Deckpilot Narration',
    cwd: path.dirname(artifacts.srtPath),
    shellPath: executable,
    shellArgs: [artifacts.srtPath, artifacts.videoPath],
  });
  terminal.show(false);
  return true;
}

export async function recordNarrationProject(
  srtPath: string,
  baseDirectory: string,
): Promise<boolean> {
  try {
    const srt = await fs.promises.stat(srtPath);
    if (!srt.isFile() || srt.size === 0) {
      throw new Error('The narration cue file is empty.');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await vscode.window.showErrorMessage(`Cannot record narration: ${message}`);
    return false;
  }

  const executable = await requireDubbingExecutable(baseDirectory);
  if (!executable) {
    return false;
  }

  const terminal = vscode.window.createTerminal({
    name: 'Deckpilot Narration',
    cwd: path.dirname(srtPath),
    shellPath: executable,
    shellArgs: [srtPath],
  });
  const closed = new Promise<number | undefined>(resolve => {
    const disposable = vscode.window.onDidCloseTerminal(closedTerminal => {
      if (closedTerminal === terminal) {
        disposable.dispose();
        resolve(closedTerminal.exitStatus?.code);
      }
    });
  });
  terminal.show(false);
  const exitCode = await closed;
  return exitCode === undefined || exitCode === 0;
}

export async function prepareNarrationProject(
  srtPath: string,
  baseDirectory: string,
): Promise<void> {
  await runDubbingCommand(['--prepare', srtPath], baseDirectory);
}

export async function resyncNarrationProject(
  srtPath: string,
  baseDirectory: string,
): Promise<void> {
  await runDubbingCommand(['--resync', srtPath], baseDirectory);
}

export async function assembleNarrationProject(
  srtPath: string,
  videoPath: string,
  baseDirectory: string,
): Promise<string> {
  await runDubbingCommand(['--assemble', srtPath, videoPath], baseDirectory);
  const projectName = path.basename(srtPath, path.extname(srtPath));
  return path.join(path.dirname(srtPath), 'output', `${projectName}-dubbed.mp4`);
}

async function requireDubbingExecutable(baseDirectory: string): Promise<string | undefined> {
  const configured = vscode.workspace
    .getConfiguration('deckPilot.dubbing')
    .get<string>('executable', 'srt-dubber');
  const executable = resolveDubbingExecutable(configured, baseDirectory);
  if (executable) {
    return executable;
  }

  const choice = await vscode.window.showErrorMessage(
    `Could not find srt-dubber (${configured}). Add it to PATH or configure deckPilot.dubbing.executable.`,
    'Open Settings',
  );
  if (choice === 'Open Settings') {
    await vscode.commands.executeCommand(
      'workbench.action.openSettings',
      'deckPilot.dubbing.executable',
    );
  }
  return undefined;
}

async function runDubbingCommand(args: string[], baseDirectory: string): Promise<string> {
  const executable = await requireDubbingExecutable(baseDirectory);
  if (!executable) {
    throw new Error('srt-dubber is not available.');
  }

  return new Promise<string>((resolve, reject) => {
    execFile(
      executable,
      args,
      { cwd: baseDirectory, windowsHide: true, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr.trim() || error.message));
          return;
        }
        resolve(stdout.trim());
      },
    );
  });
}