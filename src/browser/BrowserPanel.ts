/**
 * BrowserPanel — manages the side-by-side WebviewPanel for browser.open / browser.navigate actions.
 *
 * Lifecycle:
 *   - Executors call getOrCreateBrowserPanel() to obtain the singleton.
 *   - Conductor.dispose() calls disposeBrowserPanel() to clean up.
 *   - The user can close the panel via the VS Code "×" button; onDidDispose callbacks are invoked.
 */

import * as vscode from 'vscode';
import { BrowserPanelContent } from './BrowserPanelContent';

export class BrowserPanel implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private currentUrl: string | undefined;
  private onDisposeCallbacks: Array<() => void> = [];

  /**
   * Open (or re-open) the panel and navigate to url.
   * If the panel already exists, reveals it and navigates to the new URL.
   * @returns true if the panel was newly created, false if it already existed.
   */
  open(url: string, column: vscode.ViewColumn, title: string): boolean {
    if (this.panel) {
      // Panel already exists — reveal and navigate via postMessage.
      this.currentUrl = url;
      this.panel.title = title;
      void this.panel.webview.postMessage({ command: 'navigate', url });
      this.panel.reveal(this.panel.viewColumn ?? vscode.ViewColumn.Two, false);
      return false;
    }

    // Create a new panel.
    this.panel = vscode.window.createWebviewPanel(
      'deckpilotBrowser',
      title,
      column,
      {
        enableScripts: true,
        enableForms: false,
        retainContextWhenHidden: true,
        localResourceRoots: [],
      }
    );

    this.currentUrl = url;
    this.panel.webview.html = BrowserPanelContent.getHtmlContent(this.panel.webview, url);

    // When the user closes the panel, clean up our reference and notify observers.
    this.panel.onDidDispose(() => {
      this.panel = undefined;
      this.currentUrl = undefined;
      for (const cb of this.onDisposeCallbacks) {
        cb();
      }
    });

    return true;
  }

  /**
   * Navigate the open panel to a new URL.
   * If the panel is not open, opens it in ViewColumn.Two with the default title.
   * @returns The previous URL (for undo) and whether the panel was already open.
   */
  navigate(url: string): { wasOpen: boolean; previousUrl: string | undefined } {
    const wasOpen = this.isOpen();
    const previousUrl = this.currentUrl;

    if (this.panel) {
      this.currentUrl = url;
      void this.panel.webview.postMessage({ command: 'navigate', url });
      this.panel.reveal(this.panel.viewColumn ?? vscode.ViewColumn.Two, false);
    } else {
      this.open(url, vscode.ViewColumn.Two, 'Browser');
    }

    return { wasOpen, previousUrl };
  }

  /** Close and dispose the panel. */
  close(): void {
    this.panel?.dispose();
    // panel and currentUrl are cleared in the onDidDispose handler.
  }

  /** Whether the panel is currently open. */
  isOpen(): boolean {
    return this.panel !== undefined;
  }

  /** Current URL being displayed, or undefined if panel is closed. */
  getCurrentUrl(): string | undefined {
    return this.currentUrl;
  }

  /**
   * Register a callback that fires when the VS Code panel is disposed by the user.
   * Returns a disposable that unregisters the callback.
   */
  onDidDispose(cb: () => void): vscode.Disposable {
    this.onDisposeCallbacks.push(cb);
    return {
      dispose: () => {
        const idx = this.onDisposeCallbacks.indexOf(cb);
        if (idx !== -1) {
          this.onDisposeCallbacks.splice(idx, 1);
        }
      },
    };
  }

  dispose(): void {
    this.close();
    this.onDisposeCallbacks = [];
  }
}

// ── Module-level singleton ────────────────────────────────────────────────────

let activeBrowserPanel: BrowserPanel | undefined;

/**
 * Returns the active BrowserPanel, creating a new one if none exists or if the
 * previous one was closed by the user.
 */
export function getOrCreateBrowserPanel(): BrowserPanel {
  if (!activeBrowserPanel || !activeBrowserPanel.isOpen()) {
    activeBrowserPanel = new BrowserPanel();
  }
  return activeBrowserPanel;
}

/**
 * Dispose the active BrowserPanel and clear the singleton reference.
 * Called from Conductor.dispose().
 */
export function disposeBrowserPanel(): void {
  activeBrowserPanel?.dispose();
  activeBrowserPanel = undefined;
}
