/**
 * BrowserOpenExecutor — executes the browser.open action.
 *
 * Opens a URL in the side-by-side BrowserPanel WebviewPanel.
 * Does not require workspace trust (purely visual, no host code execution).
 */

import * as vscode from 'vscode';
import { Action, BrowserOpenParams } from '@deckpilot/core/models/action';
import { ActionExecutor, ExecutionContext, ExecutionResult, BaseActionExecutor } from './types';
import { ValidationError } from './errors';
import { getOrCreateBrowserPanel } from '../browser/BrowserPanel';
import { isAllowedUrl } from '../browser/urlValidator';

/**
 * Map a numeric column param to a VS Code ViewColumn.
 * Default is ViewColumn.Two (beside the presentation panel).
 */
function resolveColumn(column: number | undefined): vscode.ViewColumn {
  switch (column) {
    case 1:  return vscode.ViewColumn.One;
    case 2:  return vscode.ViewColumn.Two;
    case 3:  return vscode.ViewColumn.Three;
    case -1: return vscode.ViewColumn.Beside;
    default: return vscode.ViewColumn.Two;
  }
}

export class BrowserOpenExecutor extends BaseActionExecutor<BrowserOpenParams> implements ActionExecutor<BrowserOpenParams> {
  readonly actionType = 'browser.open' as const;
  readonly description = 'Opens a URL in a side-by-side browser panel';
  readonly requiresTrust = false;
  override readonly defaultTimeoutMs = 5000;

  validate(params: BrowserOpenParams): void {
    if (!params.url || typeof params.url !== 'string') {
      throw new ValidationError('browser.open', 'url', 'url is required');
    }
    if (!isAllowedUrl(params.url)) {
      throw new ValidationError(
        'browser.open',
        'url',
        'url must be https://, http://localhost, or http://127.0.0.1'
      );
    }
    if (
      params.title !== undefined &&
      typeof params.title !== 'string'
    ) {
      throw new ValidationError('browser.open', 'title', 'title must be a string');
    }
    if (
      params.column !== undefined &&
      (typeof params.column !== 'number' || params.column < -1 || params.column > 9)
    ) {
      throw new ValidationError('browser.open', 'column', 'column must be a valid ViewColumn');
    }
  }

  async execute(action: Action, context: ExecutionContext): Promise<ExecutionResult> {
    const startTime = Date.now();
    const params = action.params as unknown as BrowserOpenParams;

    try {
      this.validate(params);

      const column = resolveColumn(params.column);
      const title = params.title ?? 'Browser';

      const panel = getOrCreateBrowserPanel();
      const previousUrl = panel.getCurrentUrl();
      const wasNew = panel.open(params.url, column, title);

      context.outputChannel.appendLine(`[browser.open] ${params.url}`);

      return this.success(startTime, true, async () => {
        if (wasNew) {
          panel.close();
        } else if (previousUrl) {
          panel.navigate(previousUrl);
        }
      });
    } catch (error) {
      return this.failure(
        error instanceof Error ? error.message : 'Unknown error',
        startTime
      );
    }
  }
}
