/**
 * Unit tests for sidecarActionMapper — DA-07.
 *
 * Covers:
 * - terminal.run: cmd → command rename
 * - file.open: file → path rename
 * - editor.highlight: file → path rename
 * - debug.start: pass-through params (configName)
 * - Other recognised types: pass-through without renaming
 * - Unknown types: skipped with console.warn (no throw)
 * - Extra fields: passed through for all types
 * - Empty input: returns empty array
 * - Output shape: valid Action objects (id, type, params, status, slideIndex)
 */

import { expect } from 'chai';
import { mapSidecarActions } from '../../../src/parser/sidecarActionMapper';
import type { SidecarAction } from '../../../src/models/sidecar';

// ---------------------------------------------------------------------------
// Console.warn capture helper
// ---------------------------------------------------------------------------

let warnMessages: string[] = [];
const originalWarn = console.warn;

function captureWarn(): void {
  warnMessages = [];
  console.warn = (...args: unknown[]) => { warnMessages.push(String(args[0])); };
}

function restoreWarn(): void {
  console.warn = originalWarn;
}

describe('mapSidecarActions', () => {

  afterEach(() => {
    restoreWarn();
  });

  // ---------------------------------------------------------------------------
  // Empty / trivial paths
  // ---------------------------------------------------------------------------

  describe('empty input', () => {
    it('returns an empty array when given no actions', () => {
      const result = mapSidecarActions([], 0);
      expect(result).to.deep.equal([]);
    });
  });

  // ---------------------------------------------------------------------------
  // terminal.run
  // ---------------------------------------------------------------------------

  describe('terminal.run', () => {
    it('maps cmd to command', () => {
      const actions: SidecarAction[] = [{ type: 'terminal.run', cmd: 'npm install' }];
      const result = mapSidecarActions(actions, 2);
      expect(result).to.have.lengthOf(1);
      expect(result[0].type).to.equal('terminal.run');
      expect(result[0].params).to.have.property('command', 'npm install');
      expect(result[0].params).to.not.have.property('cmd');
    });

    it('sets correct slideIndex', () => {
      const actions: SidecarAction[] = [{ type: 'terminal.run', cmd: 'echo hi' }];
      const result = mapSidecarActions(actions, 5);
      expect(result[0].slideIndex).to.equal(5);
    });

    it('preserves extra fields alongside command', () => {
      const actions: SidecarAction[] = [
        { type: 'terminal.run', cmd: 'npm test', name: 'Tests', background: true },
      ];
      const result = mapSidecarActions(actions, 0);
      expect(result[0].params).to.include({ command: 'npm test', name: 'Tests', background: true });
      expect(result[0].params).to.not.have.property('cmd');
    });

    it('handles missing cmd gracefully (no command key added)', () => {
      const actions: SidecarAction[] = [{ type: 'terminal.run' }];
      const result = mapSidecarActions(actions, 0);
      expect(result).to.have.lengthOf(1);
      expect(result[0].params).to.not.have.property('command');
    });
  });

  // ---------------------------------------------------------------------------
  // file.open
  // ---------------------------------------------------------------------------

  describe('file.open', () => {
    it('maps file to path', () => {
      const actions: SidecarAction[] = [{ type: 'file.open', file: './src/app.ts' }];
      const result = mapSidecarActions(actions, 1);
      expect(result).to.have.lengthOf(1);
      expect(result[0].type).to.equal('file.open');
      expect(result[0].params).to.have.property('path', './src/app.ts');
      expect(result[0].params).to.not.have.property('file');
    });

    it('does not overwrite an explicit path field with file', () => {
      const actions: SidecarAction[] = [
        { type: 'file.open', file: 'old.ts', path: 'explicit.ts' } as SidecarAction,
      ];
      const result = mapSidecarActions(actions, 0);
      expect(result[0].params).to.have.property('path', 'explicit.ts');
    });

    it('preserves extra fields like range and line', () => {
      const actions: SidecarAction[] = [
        { type: 'file.open', file: 'src/index.ts', range: '10-20', line: 10 },
      ];
      const result = mapSidecarActions(actions, 0);
      expect(result[0].params).to.include({ path: 'src/index.ts', range: '10-20', line: 10 });
    });
  });

  // ---------------------------------------------------------------------------
  // editor.highlight
  // ---------------------------------------------------------------------------

  describe('editor.highlight', () => {
    it('maps file to path', () => {
      const actions: SidecarAction[] = [
        { type: 'editor.highlight', file: 'src/main.ts', lines: '5-10' },
      ];
      const result = mapSidecarActions(actions, 3);
      expect(result[0].type).to.equal('editor.highlight');
      expect(result[0].params).to.have.property('path', 'src/main.ts');
      expect(result[0].params).to.have.property('lines', '5-10');
      expect(result[0].params).to.not.have.property('file');
    });
  });

  // ---------------------------------------------------------------------------
  // debug.start
  // ---------------------------------------------------------------------------

  describe('debug.start', () => {
    it('passes configName through unchanged', () => {
      const actions: SidecarAction[] = [{ type: 'debug.start', configName: 'Launch Tests' }];
      const result = mapSidecarActions(actions, 0);
      expect(result[0].type).to.equal('debug.start');
      expect(result[0].params).to.have.property('configName', 'Launch Tests');
    });

    it('passes optional workspaceFolder and stopOnEntry through', () => {
      const actions: SidecarAction[] = [
        { type: 'debug.start', configName: 'Server', workspaceFolder: 'api', stopOnEntry: true },
      ];
      const result = mapSidecarActions(actions, 0);
      expect(result[0].params).to.include({
        configName: 'Server',
        workspaceFolder: 'api',
        stopOnEntry: true,
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Other recognised types (pass-through)
  // ---------------------------------------------------------------------------

  describe('other recognised types', () => {
    it('vscode.command: passes id through', () => {
      const actions: SidecarAction[] = [
        { type: 'vscode.command', id: 'workbench.action.openSettings' },
      ];
      const result = mapSidecarActions(actions, 0);
      expect(result[0].type).to.equal('vscode.command');
      expect(result[0].params).to.have.property('id', 'workbench.action.openSettings');
    });

    it('wait.condition: passes condition through', () => {
      const actions: SidecarAction[] = [
        { type: 'wait.condition', condition: 'port.open', port: 3000 },
      ];
      const result = mapSidecarActions(actions, 0);
      expect(result[0].type).to.equal('wait.condition');
      expect(result[0].params).to.include({ condition: 'port.open', port: 3000 });
    });
  });

  // ---------------------------------------------------------------------------
  // Unknown types
  // ---------------------------------------------------------------------------

  describe('unknown action types', () => {
    it('skips unknown type without throwing', () => {
      captureWarn();
      const actions: SidecarAction[] = [{ type: 'does.not.exist' }];
      const result = mapSidecarActions(actions, 1);
      restoreWarn();
      expect(result).to.have.lengthOf(0);
    });

    it('emits a console.warn containing the unknown type name', () => {
      captureWarn();
      const actions: SidecarAction[] = [{ type: 'magic.action' }];
      mapSidecarActions(actions, 4);
      restoreWarn();
      expect(warnMessages).to.have.lengthOf(1);
      expect(warnMessages[0]).to.include('magic.action');
    });

    it('processes valid actions before and after an unknown type', () => {
      captureWarn();
      const actions: SidecarAction[] = [
        { type: 'file.open', file: 'a.ts' },
        { type: 'unknown.type' },
        { type: 'terminal.run', cmd: 'echo done' },
      ];
      const result = mapSidecarActions(actions, 0);
      restoreWarn();
      expect(result).to.have.lengthOf(2);
      expect(result[0].type).to.equal('file.open');
      expect(result[1].type).to.equal('terminal.run');
      expect(warnMessages).to.have.lengthOf(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Output shape
  // ---------------------------------------------------------------------------

  describe('output action shape', () => {
    it('produces an Action with id, type, params, status pending, and slideIndex', () => {
      const actions: SidecarAction[] = [{ type: 'terminal.run', cmd: 'ls' }];
      const result = mapSidecarActions(actions, 7);
      const action = result[0];
      expect(action).to.have.property('id').that.is.a('string').and.not.empty;
      expect(action).to.have.property('type', 'terminal.run');
      expect(action).to.have.property('params').that.is.an('object');
      expect(action).to.have.property('status', 'pending');
      expect(action).to.have.property('slideIndex', 7);
    });

    it('assigns distinct ids to multiple actions', () => {
      const actions: SidecarAction[] = [
        { type: 'file.open', file: 'a.ts' },
        { type: 'file.open', file: 'b.ts' },
      ];
      const result = mapSidecarActions(actions, 0);
      expect(result[0].id).to.not.equal(result[1].id);
    });
  });
});

