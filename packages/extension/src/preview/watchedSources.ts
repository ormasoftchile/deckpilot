/**
 * WatchedSources — manages a dynamic set of file watchers for the live preview.
 *
 * The watch set is computed from the current parsed deck (sidecar, env file,
 * `content:` import, `render:file` / `render:diff` paths) and re-synced after
 * every parse so adding or removing a directive immediately attaches or detaches
 * the corresponding watcher.
 */

import * as path from 'path';
import * as vscode from 'vscode';

export type ChangeCallback = (changedPath: string) => void;

export class WatchedSources implements vscode.Disposable {
  private readonly watchers = new Map<string, vscode.FileSystemWatcher>();

  constructor(private readonly onChange: ChangeCallback) {}

  /**
   * Reconcile the current watcher set with the desired one.
   * Attaches new watchers, detaches stale ones, leaves overlaps untouched.
   */
  sync(paths: ReadonlyArray<string>): void {
    const desired = new Set<string>();
    for (const p of paths) {
      if (p) {
        desired.add(path.normalize(p));
      }
    }

    for (const [key, watcher] of this.watchers) {
      if (!desired.has(key)) {
        watcher.dispose();
        this.watchers.delete(key);
      }
    }

    for (const key of desired) {
      if (this.watchers.has(key)) {
        continue;
      }
      const pattern = new vscode.RelativePattern(
        vscode.Uri.file(path.dirname(key)),
        path.basename(key),
      );
      const watcher = vscode.workspace.createFileSystemWatcher(pattern);
      const fire = () => this.onChange(key);
      watcher.onDidChange(fire);
      watcher.onDidCreate(fire);
      watcher.onDidDelete(fire);
      this.watchers.set(key, watcher);
    }
  }

  /** Visible for tests. */
  watchedPaths(): string[] {
    return [...this.watchers.keys()].sort();
  }

  dispose(): void {
    for (const w of this.watchers.values()) {
      w.dispose();
    }
    this.watchers.clear();
  }
}
