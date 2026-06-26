import * as vscode from 'vscode';
import type { DeckpilotDiagramAPI } from '@deckpilot/core/renderer/diagramRenderer';
import { MermaidFallbackRenderer } from './mermaidFallbackRenderer';
import { TritonDiagramRenderer } from './tritonAdapter';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const deckpilotExt = vscode.extensions.getExtension<DeckpilotDiagramAPI>('focus-space.executable-talk');

  if (!deckpilotExt) {
    // Deckpilot not installed — nothing to register.
    return;
  }

  const api = await deckpilotExt.activate();

  if (!api || typeof api.registerDiagramRenderer !== 'function') {
    console.warn(
      '[deckpilot-triton] Deckpilot does not export a diagram API. ' +
      'Upgrade deckpilot to enable diagram rendering.'
    );
    return;
  }

  const adapter = new TritonDiagramRenderer(context.extensionUri);
  const fallbackRenderer = new MermaidFallbackRenderer();
  const registration = api.registerDiagramRenderer(adapter);
  const fallbackRegistration = api.registerDiagramRenderer(fallbackRenderer);
  context.subscriptions.push(registration, fallbackRegistration);

  console.log('[deckpilot-triton] Triton and Mermaid fallback diagram renderers registered.');
}

export function deactivate(): void {}
