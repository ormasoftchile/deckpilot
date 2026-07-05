import * as vscode from 'vscode';
import type { DeckpilotDiagramAPI } from '@deckpilot/core/renderer/diagramRenderer';
import { MermaidDiagramRenderer } from './mermaidRenderer';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const deckpilotExt = vscode.extensions.getExtension<DeckpilotDiagramAPI>('focus-space.executable-talk');

  if (!deckpilotExt) {
    return;
  }

  const api = await deckpilotExt.activate();

  if (!api || typeof api.registerDiagramRenderer !== 'function') {
    console.warn(
      '[deckpilot-mermaid] Deckpilot does not export a diagram API. ' +
      'Upgrade deckpilot to enable diagram rendering.',
    );
    return;
  }

  const registration = api.registerDiagramRenderer(new MermaidDiagramRenderer());
  context.subscriptions.push(registration);

  console.log('Mermaid renderer registered with Deckpilot');
}

export function deactivate(): void {}
