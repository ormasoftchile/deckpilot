import * as path from 'path';
import * as vscode from 'vscode';
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

  const configured = vscode.workspace
    .getConfiguration('deckPilot.dubbing')
    .get<string>('executable', 'srt-dubber');
  const executable = resolveDubbingExecutable(configured, baseDirectory);

  if (!executable) {
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