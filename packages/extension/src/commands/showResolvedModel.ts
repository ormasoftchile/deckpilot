import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { parseDeck } from '@deckpilot/core/parser';

const SCHEME = 'deckpilot-model';

/**
 * Serialize an arbitrary value to indented JSON, handling circular references
 * by replacing them with the string '[Circular]' and stripping function values.
 *
 * Extracted as a pure function so it can be unit-tested without VS Code.
 */
export function serializeDeck(value: unknown): string {
    const seen = new Set<unknown>();
    return JSON.stringify(value, (_key, v) => {
        if (typeof v === 'function') {
            return undefined;
        }
        if (typeof v === 'object' && v !== null) {
            if (seen.has(v)) {
                return '[Circular]';
            }
            seen.add(v);
        }
        return v;
    }, 2);
}

// Stores the latest serialized JSON per virtual document path
const contentStore = new Map<string, string>();

export class DeckModelContentProvider implements vscode.TextDocumentContentProvider {
    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    readonly onDidChange = this._onDidChange.event;

    provideTextDocumentContent(uri: vscode.Uri): string {
        return contentStore.get(uri.path) ?? '';
    }

    update(uri: vscode.Uri, content: string): void {
        contentStore.set(uri.path, content);
        this._onDidChange.fire(uri);
    }

    dispose(): void {
        this._onDidChange.dispose();
    }
}

export async function showResolvedDeckModel(provider: DeckModelContentProvider): Promise<void> {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
        void vscode.window.showErrorMessage('Open a .deck.md or .deck.yaml file first to inspect its resolved model.');
        return;
    }

    let filePath = editor.document.uri.fsPath;

    // If triggered from a .deck.yaml sidecar, derive the .deck.md path
    if (filePath.endsWith('.deck.yaml')) {
        const deckMdPath = filePath.replace(/\.deck\.yaml$/, '.deck.md');
        
        // Use the .deck.md path for parsing (which will also load the sidecar)
        if (!fs.existsSync(deckMdPath)) {
            void vscode.window.showErrorMessage(
                'No paired .deck.md file found. Create a .deck.md file alongside this sidecar.'
            );
            return;
        }
        
        filePath = deckMdPath;
    } else if (!filePath.endsWith('.deck.md')) {
        void vscode.window.showErrorMessage('Active file is not a .deck.md or .deck.yaml file.');
        return;
    }

    // Load the .deck.md content
    const deckDoc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
    const content = deckDoc.getText();

    let result;
    try {
        result = await parseDeck(content, filePath);
    } catch (err) {
        void vscode.window.showErrorMessage(
            `Failed to parse deck: ${err instanceof Error ? err.message : String(err)}`
        );
        return;
    }

    if (result.error || !result.deck) {
        void vscode.window.showErrorMessage(`Deck parse error: ${result.error ?? 'Unknown error'}`);
        return;
    }

    let json: string;
    try {
        json = serializeDeck(result.deck);
    } catch (err) {
        void vscode.window.showErrorMessage(
            `Failed to serialize deck model: ${err instanceof Error ? err.message : String(err)}`
        );
        return;
    }

    const docName = `${path.basename(filePath)}.json`;
    const uri = vscode.Uri.parse(`${SCHEME}:${docName}`);

    provider.update(uri, json);

    const doc = await vscode.workspace.openTextDocument(uri);
    const activeDoc = await vscode.languages.setTextDocumentLanguage(doc, 'json');
    await vscode.window.showTextDocument(activeDoc, { preview: true });
}
