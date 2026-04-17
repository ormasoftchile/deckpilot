import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as net from 'net';
import { WaitConditionExecutor } from '../../../src/actions/waitConditionExecutor';
import { Action } from '../../../src/models/action';

function createAction(params: Record<string, unknown>): Action {
  return {
    id: 'action-test',
    type: 'wait.condition',
    params,
    status: 'pending',
    slideIndex: 0,
  };
}

function createContext(basePath: string) {
  return {
    workspaceRoot: basePath,
    basePath,
    deckFilePath: path.join(basePath, 'demo.deck.md'),
    currentSlideIndex: 0,
    isWorkspaceTrusted: true,
    cancellationToken: { isCancellationRequested: false },
    outputChannel: { appendLine: (_msg: string) => undefined },
  };
}

describe('WaitConditionExecutor', () => {
  it('succeeds when file.exists condition is already true', async () => {
    const executor = new WaitConditionExecutor();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'et-wait-'));
    const targetFile = path.join(tempDir, 'ready.txt');
    fs.writeFileSync(targetFile, 'ok', 'utf8');

    const result = await executor.execute(
      createAction({ condition: 'file.exists', path: targetFile }),
      createContext(tempDir) as any,
    );

    expect(result.success).to.equal(true);
    expect(result.actionType).to.equal('wait.condition');

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('times out when file.exists condition is never satisfied', async () => {
    const executor = new WaitConditionExecutor();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'et-wait-'));

    const result = await executor.execute(
      createAction({
        condition: 'file.exists',
        path: 'missing-installer.bin',
        timeoutMs: 120,
        pollIntervalMs: 30,
      }),
      createContext(tempDir) as any,
    );

    expect(result.success).to.equal(false);
    expect(result.error).to.include('timed out');

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('succeeds when port.open condition is true', async () => {
    const executor = new WaitConditionExecutor();
    const server = net.createServer();

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });

    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    const result = await executor.execute(
      createAction({ condition: 'port.open', host: '127.0.0.1', port }),
      createContext(process.cwd()) as any,
    );

    expect(result.success).to.equal(true);

    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });
});
