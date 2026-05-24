/**
 * PreviewProvider — opens a side-panel webview that re-renders a .deck.md as
 * the author types. Pure render path: no executors, no state stack, no trust
 * checks, no recording. Click handlers in the webview are no-ops.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { parseDeck } from '@deckpilot/core/parser/deckParser';
import { matter } from '@deckpilot/core/parser/frontmatter';
import { collectWatchPaths } from './collectWatchPaths';
import { renderPreviewError, renderPreviewHtml, RenderPreviewOptions } from './previewRenderer';
import { WatchedSources } from './watchedSources';

const DEBOUNCE_MS = 150;
const VIEW_TYPE = 'deckPilotPreview';

export class PreviewProvider implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private deckUri: vscode.Uri | undefined;
  private readonly watched: WatchedSources;
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;
  private disposables: vscode.Disposable[] = [];
  private nonce = generateNonce();

  constructor(private readonly extensionUri: vscode.Uri) {
    this.watched = new WatchedSources(() => this.scheduleRefresh());
  }

  async show(deckUri: vscode.Uri): Promise<void> {
    this.deckUri = deckUri;

    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside, true);
    } else {
      this.panel = vscode.window.createWebviewPanel(
        VIEW_TYPE,
        previewTitle(deckUri),
        { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: this.computeResourceRoots(),
        },
      );
      this.panel.onDidDispose(() => this.disposePanel(), null, this.disposables);
      this.attachDocumentListener();
    }

    this.panel.title = previewTitle(deckUri);
    await this.refresh();
  }

  private attachDocumentListener(): void {
    const changeDisposable = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.contentChanges.length === 0) {
        return;
      }
      const changedPath = e.document.uri.fsPath;
      if (
        (this.deckUri && changedPath === this.deckUri.fsPath) ||
        this.watched.has(changedPath)
      ) {
        this.scheduleRefresh();
      }
    });
    this.disposables.push(changeDisposable);
  }

  private scheduleRefresh(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = undefined;
      void this.refresh();
    }, DEBOUNCE_MS);
  }

  private async refresh(): Promise<void> {
    if (!this.panel || !this.deckUri) {
      return;
    }
    const renderOpts = this.buildRenderOptions();
    let content: string;
    try {
      content = await this.readDeckContent(this.deckUri);
    } catch (err) {
      this.panel.webview.html = renderPreviewError(
        `Failed to read deck file: ${(err as Error).message}`,
        renderOpts,
      );
      return;
    }

    const result = await parseDeck(content, this.deckUri.fsPath);
    if (result.error || !result.deck) {
      this.panel.webview.html = renderPreviewError(
        result.error ?? 'Parse failed',
        renderOpts,
      );
      this.watched.sync([]);
      return;
    }

    this.panel.webview.html = renderPreviewHtml(result.deck, {
      ...renderOpts,
      warnings: result.warnings,
    });
    this.watched.sync(collectWatchPaths(result.deck));
  }

  private async readDeckContent(uri: vscode.Uri): Promise<string> {
    const raw = await this.readLive(uri.fsPath);
    return this.inlineContentImport(raw, uri.fsPath);
  }

  private async readLive(fsPath: string): Promise<string> {
    const openDoc = vscode.workspace.textDocuments.find(
      (d) => d.uri.fsPath === fsPath,
    );
    if (openDoc) {
      return openDoc.getText();
    }
    return fs.promises.readFile(fsPath, 'utf-8');
  }

  /**
   * If the wrapper deck declares `content: <path>` and that imported file is
   * currently open in an editor with unsaved edits, splice its live body into
   * the wrapper so the preview reflects keystrokes (not just saves). When the
   * import file isn't open, we leave the directive in place and let parseDeck
   * read it from disk.
   */
  private async inlineContentImport(raw: string, deckPath: string): Promise<string> {
    let parsed: { data: Record<string, unknown>; content: string };
    try {
      parsed = matter(raw);
    } catch {
      return raw;
    }
    const importPath = typeof parsed.data.content === 'string' ? parsed.data.content.trim() : '';
    if (!importPath) {
      return raw;
    }
    const resolved = path.isAbsolute(importPath)
      ? importPath
      : path.resolve(path.dirname(deckPath), importPath);
    const openDoc = vscode.workspace.textDocuments.find(
      (d) => d.uri.fsPath === resolved,
    );
    if (!openDoc) {
      return raw;
    }
    let importedBody: string;
    try {
      importedBody = matter(openDoc.getText()).content;
    } catch {
      return raw;
    }
    const { content: _drop, ...rest } = parsed.data;
    const fmLines = Object.entries(rest).map(([k, v]) => `${k}: ${serializeYamlScalar(v)}`);
    const fm = fmLines.length > 0 ? `---\n${fmLines.join('\n')}\n---\n` : '';
    return `${fm}${importedBody}`;
  }

  private buildRenderOptions(): RenderPreviewOptions {
    const webview = this.panel!.webview;
    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.extensionUri,
        'packages',
        'extension',
        'src',
        'webview',
        'assets',
        'preview.css',
      ),
    );
    return {
      webview,
      cspSource: webview.cspSource,
      nonce: this.nonce,
      cssUri,
      deckPath: this.deckUri!.fsPath,
    };
  }

  private computeResourceRoots(): vscode.Uri[] {
    const roots: vscode.Uri[] = [
      vscode.Uri.joinPath(this.extensionUri, 'packages', 'extension', 'src', 'webview', 'assets'),
    ];
    if (vscode.workspace.workspaceFolders) {
      for (const f of vscode.workspace.workspaceFolders) {
        roots.push(f.uri);
      }
    }
    if (this.deckUri) {
      roots.push(vscode.Uri.file(path.dirname(this.deckUri.fsPath)));
    }
    return roots;
  }

  private disposePanel(): void {
    this.panel = undefined;
    this.deckUri = undefined;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
    this.watched.dispose();
  }

  dispose(): void {
    this.panel?.dispose();
    this.disposePanel();
  }
}

function previewTitle(deckUri: vscode.Uri): string {
  return `Preview: ${path.basename(deckUri.fsPath)}`;
}

function generateNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 32; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

/**
 * Minimal YAML scalar serializer for the few values we round-trip when
 * stripping the `content:` directive. Strings get quoted, primitives stringified,
 * everything else falls back to JSON. Good enough — this output is fed straight
 * back into the deck parser, not persisted.
 */
function serializeYamlScalar(v: unknown): string {
  if (v === null || v === undefined) {
    return '';
  }
  if (typeof v === 'string') {
    return JSON.stringify(v);
  }
  if (typeof v === 'number' || typeof v === 'boolean') {
    return String(v);
  }
  return JSON.stringify(v);
}
