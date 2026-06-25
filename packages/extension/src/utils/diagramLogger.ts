import * as vscode from 'vscode';

const DIAGRAM_CHANNEL_NAME = 'Deckpilot Diagrams';

let diagramChannel: vscode.OutputChannel | undefined;
let diagramChannelRegistered = false;

function ensureDiagramChannel(): vscode.OutputChannel {
  if (!diagramChannel) {
    diagramChannel = vscode.window.createOutputChannel(DIAGRAM_CHANNEL_NAME);
  }

  return diagramChannel;
}

export function initializeDiagramLogger(context: vscode.ExtensionContext): vscode.OutputChannel {
  const channel = ensureDiagramChannel();
  if (!diagramChannelRegistered) {
    context.subscriptions.push(channel);
    diagramChannelRegistered = true;
  }

  return channel;
}

export function diagramLog(message: string): void {
  ensureDiagramChannel().appendLine(message);
}

