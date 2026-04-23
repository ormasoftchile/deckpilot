/**
 * BrowserNavigateExecutor — executes the browser.navigate action.
 *
 * Navigates an open BrowserPanel to a new URL.
 * If no panel is open, auto-creates it in ViewColumn.Two.
 * Does not require workspace trust.
 */

import { Action, BrowserNavigateParams } from '../models/action';
import { ActionExecutor, ExecutionContext, ExecutionResult, BaseActionExecutor } from './types';
import { ValidationError } from './errors';
import { getOrCreateBrowserPanel } from '../browser/BrowserPanel';
import { isAllowedUrl } from '../browser/urlValidator';

export class BrowserNavigateExecutor extends BaseActionExecutor<BrowserNavigateParams> implements ActionExecutor<BrowserNavigateParams> {
  readonly actionType = 'browser.navigate' as const;
  readonly description = 'Navigates the browser panel to a new URL';
  readonly requiresTrust = false;
  override readonly defaultTimeoutMs = 5000;

  validate(params: BrowserNavigateParams): void {
    if (!params.url || typeof params.url !== 'string') {
      throw new ValidationError('browser.navigate', 'url', 'url is required');
    }
    if (!isAllowedUrl(params.url)) {
      throw new ValidationError(
        'browser.navigate',
        'url',
        'url must be https://, http://localhost, or http://127.0.0.1'
      );
    }
  }

  async execute(action: Action, context: ExecutionContext): Promise<ExecutionResult> {
    const startTime = Date.now();
    const params = action.params as unknown as BrowserNavigateParams;

    try {
      this.validate(params);

      const panel = getOrCreateBrowserPanel();
      const { previousUrl } = panel.navigate(params.url);

      context.outputChannel.appendLine(`[browser.navigate] ${params.url}`);

      return this.success(startTime, true, async () => {
        if (previousUrl) {
          panel.navigate(previousUrl);
        } else {
          panel.close();
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
