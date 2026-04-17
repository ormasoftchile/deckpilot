/**
 * Wait Condition Executor - blocks until a condition is satisfied or timeout expires.
 */

import * as fs from 'fs';
import * as net from 'net';
import * as path from 'path';
import { Action, WaitConditionParams } from '../models/action';
import { ActionExecutor, BaseActionExecutor, ExecutionContext, ExecutionResult } from './types';
import { ValidationError } from './errors';

const DEFAULT_TIMEOUT_MS = 120000;
const DEFAULT_POLL_INTERVAL_MS = 3000;
const DEFAULT_PORT_CONNECT_TIMEOUT_MS = 1000;

/**
 * Executor for wait.condition action type
 */
export class WaitConditionExecutor extends BaseActionExecutor implements ActionExecutor<WaitConditionParams> {
  readonly actionType = 'wait.condition' as const;
  readonly description = 'Waits until a condition is satisfied';
  readonly requiresTrust = false;
  override readonly defaultTimeoutMs = DEFAULT_TIMEOUT_MS;

  validate(params: WaitConditionParams): void {
    if (!params.condition || typeof params.condition !== 'string') {
      throw new ValidationError('wait.condition', 'condition', 'condition is required and must be a string');
    }

    if (params.condition !== 'file.exists' && params.condition !== 'port.open') {
      throw new ValidationError('wait.condition', 'condition', 'condition must be one of: file.exists, port.open');
    }

    if (params.condition === 'file.exists') {
      if (!params.path || typeof params.path !== 'string') {
        throw new ValidationError('wait.condition', 'path', 'path is required when condition=file.exists');
      }
    }

    if (params.condition === 'port.open') {
      if (params.port === undefined || params.port === null) {
        throw new ValidationError('wait.condition', 'port', 'port is required when condition=port.open');
      }
      const port = Number(params.port);
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new ValidationError('wait.condition', 'port', 'port must be an integer between 1 and 65535');
      }
      if (params.host !== undefined && typeof params.host !== 'string') {
        throw new ValidationError('wait.condition', 'host', 'host must be a string');
      }
    }

    if (params.message !== undefined && typeof params.message !== 'string') {
      throw new ValidationError('wait.condition', 'message', 'message must be a string');
    }

    if (
      params.timeoutMs !== undefined
      && (typeof params.timeoutMs !== 'number' || !Number.isFinite(params.timeoutMs) || params.timeoutMs <= 0)
    ) {
      throw new ValidationError('wait.condition', 'timeoutMs', 'timeoutMs must be a positive number');
    }

    if (
      params.pollIntervalMs !== undefined
      && (typeof params.pollIntervalMs !== 'number' || !Number.isFinite(params.pollIntervalMs) || params.pollIntervalMs <= 0)
    ) {
      throw new ValidationError('wait.condition', 'pollIntervalMs', 'pollIntervalMs must be a positive number');
    }
  }

  async execute(action: Action, context: ExecutionContext): Promise<ExecutionResult> {
    const startTime = Date.now();
    const params = action.params as unknown as WaitConditionParams;

    try {
      this.validate(params);

      const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      const pollIntervalMs = params.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
      const conditionText = this.describeCondition(params, context);
      const message = params.message?.trim().length
        ? params.message.trim()
        : `Waiting for condition: ${conditionText}`;

      context.outputChannel.appendLine(`[wait.condition] ${message}`);

      while (Date.now() - startTime < timeoutMs) {
        if (context.cancellationToken.isCancellationRequested) {
          return this.failure('Action canceled', startTime);
        }

        const satisfied = await this.evaluateCondition(params, context);
        if (satisfied) {
          context.outputChannel.appendLine(`[wait.condition] Condition satisfied: ${conditionText}`);
          return {
            success: true,
            canUndo: false,
            durationMs: Date.now() - startTime,
            actionType: 'wait.condition',
            actionTarget: conditionText,
          };
        }

        context.outputChannel.appendLine(`[wait.condition] ${message}`);
        await this.delay(pollIntervalMs);
      }

      return {
        success: false,
        error: `wait.condition timed out after ${timeoutMs}ms (${conditionText})`,
        canUndo: false,
        durationMs: Date.now() - startTime,
        actionType: 'wait.condition',
        actionTarget: conditionText,
      };
    } catch (error) {
      return this.failure(error instanceof Error ? error.message : 'Unknown error', startTime);
    }
  }

  private describeCondition(params: WaitConditionParams, context: ExecutionContext): string {
    if (params.condition === 'file.exists') {
      const filePath = params.path as string;
      const resolvedPath = path.isAbsolute(filePath) ? filePath : path.join(context.basePath, filePath);
      return `file.exists:${resolvedPath}`;
    }

    const host = params.host ?? 'localhost';
    return `port.open:${host}:${params.port}`;
  }

  private async evaluateCondition(params: WaitConditionParams, context: ExecutionContext): Promise<boolean> {
    if (params.condition === 'file.exists') {
      const filePath = params.path as string;
      const resolvedPath = path.isAbsolute(filePath) ? filePath : path.join(context.basePath, filePath);
      return fs.existsSync(resolvedPath);
    }

    const host = params.host ?? 'localhost';
    const port = Number(params.port);
    return this.isPortOpen(host, port);
  }

  private async isPortOpen(host: string, port: number): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const socket = new net.Socket();
      let settled = false;

      const finish = (result: boolean): void => {
        if (settled) {
          return;
        }
        settled = true;
        socket.destroy();
        resolve(result);
      };

      socket.setTimeout(DEFAULT_PORT_CONNECT_TIMEOUT_MS);
      socket.once('connect', () => finish(true));
      socket.once('timeout', () => finish(false));
      socket.once('error', () => finish(false));

      socket.connect(port, host);
    });
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
