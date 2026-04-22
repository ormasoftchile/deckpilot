import * as vscode from 'vscode';
import * as path from 'path';
import { parseDeck } from '../parser';

const SCHEME = 'deckpilot-model';

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

    if (!editor || !editor.document.fileName.endsWith('.deck.md')) {
        void vscode.window.showErrorMessage('Open a .deck.md file first to inspect its resolved model.');
        return;
    }

    const filePath = editor.document.uri.fsPath;
    const content = editor.document.getText();

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

    const seen = new Set<unknown>();
    let json: string;
    try {
        json = JSON.stringify(result.deck, (_key, value) => {
            if (typeof value === 'function') {
                return undefined;
            }
            if (typeof value === 'object' && value !== null) {
                if (seen.has(value)) {
                    return '[Circular]';
                }
                seen.add(value);
            }
            return value;
        }, 2);
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
