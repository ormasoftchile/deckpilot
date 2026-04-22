/**
 * Unit tests for sidecarActionMapper — DA-07.
 *
 * Covers:
 * - terminal.run: cmd → action.params.command rename
 * - file.open: file → action.params.path rename
 * - editor.highlight: file → action.params.path rename
 * - debug.start: pass-through params (configName)
 * - Other recognised types: pass-through without renaming
 * - Unknown types: skipped with console.warn (no throw)
 * - Extra fields: passed through for all types
 * - Empty input: returns empty array
 * - Output shape: valid InteractiveElement (source='sidecar', fragment=false, label)
 * - Label derivation: auto-generated from type+params, overridden by explicit label field
 */

import { expect } from 'chai';
import { mapSidecarActionsToInteractiveElements } from '../../../src/parser/sidecarActionMapper';
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

describe('mapSidecarActionsToInteractiveElements', () => {

  afterEach(() => {
    restoreWarn();
  });

  // ---------------------------------------------------------------------------
  // Empty / trivial paths
  // ---------------------------------------------------------------------------

  describe('empty input', () => {
    it('returns an empty array when given no actions', () => {
      const result = mapSidecarActionsToInteractiveElements([], 0);
      expect(result).to.deep.equal([]);
    });
  });

  // ---------------------------------------------------------------------------
  // terminal.run
  // ---------------------------------------------------------------------------

  describe('terminal.run', () => {
    it('maps cmd to action.params.command', () => {
      const actions: SidecarAction[] = [{ type: 'terminal.run', cmd: 'npm install' }];
      const result = mapSidecarActionsToInteractiveElements(actions, 2);
      expect(result).to.have.lengthOf(1);
      expect(result[0].action.type).to.equal('terminal.run');
      expect(result[0].action.params).to.have.property('command', 'npm install');
      expect(result[0].action.params).to.not.have.property('cmd');
    });

    it('sets correct slideIndex on the action', () => {
      const actions: SidecarAction[] = [{ type: 'terminal.run', cmd: 'echo hi' }];
      const result = mapSidecarActionsToInteractiveElements(actions, 5);
      expect(result[0].action.slideIndex).to.equal(5);
    });

    it('preserves extra fields alongside command', () => {
      const actions: SidecarAction[] = [
        { type: 'terminal.run', cmd: 'npm test', name: 'Tests', background: true },
      ];
      const result = mapSidecarActionsToInteractiveElements(actions, 0);
      expect(result[0].action.params).to.include({ command: 'npm test', name: 'Tests', background: true });
      expect(result[0].action.params).to.not.have.property('cmd');
    });

    it('handles missing cmd gracefully (no command key added)', () => {
      const actions: SidecarAction[] = [{ type: 'terminal.run' }];
      const result = mapSidecarActionsToInteractiveElements(actions, 0);
      expect(result).to.have.lengthOf(1);
      expect(result[0].action.params).to.not.have.property('command');
    });
  });

  // ---------------------------------------------------------------------------
  // file.open
  // ---------------------------------------------------------------------------

  describe('file.open', () => {
    it('maps file to action.params.path', () => {
      const actions: SidecarAction[] = [{ type: 'file.open', file: './src/app.ts' }];
      const result = mapSidecarActionsToInteractiveElements(actions, 1);
      expect(result).to.have.lengthOf(1);
      expect(result[0].action.type).to.equal('file.open');
      expect(result[0].action.params).to.have.property('path', './src/app.ts');
      expect(result[0].action.params).to.not.have.property('file');
    });

    it('does not overwrite an explicit path field with file', () => {
      const actions: SidecarAction[] = [
        { type: 'file.open', file: 'old.ts', path: 'explicit.ts' } as SidecarAction,
      ];
      const result = mapSidecarActionsToInteractiveElements(actions, 0);
      expect(result[0].action.params).to.have.property('path', 'explicit.ts');
    });

    it('preserves extra fields like range and line', () => {
      const actions: SidecarAction[] = [
        { type: 'file.open', file: 'src/index.ts', range: '10-20', line: 10 },
      ];
      const result = mapSidecarActionsToInteractiveElements(actions, 0);
      expect(result[0].action.params).to.include({ path: 'src/index.ts', range: '10-20', line: 10 });
    });
  });

  // ---------------------------------------------------------------------------
  // editor.highlight
  // ---------------------------------------------------------------------------

  describe('editor.highlight', () => {
    it('maps file to action.params.path', () => {
      const actions: SidecarAction[] = [
        { type: 'editor.highlight', file: 'src/main.ts', lines: '5-10' },
      ];
      const result = mapSidecarActionsToInteractiveElements(actions, 3);
      expect(result[0].action.type).to.equal('editor.highlight');
      expect(result[0].action.params).to.have.property('path', 'src/main.ts');
      expect(result[0].action.params).to.have.property('lines', '5-10');
      expect(result[0].action.params).to.not.have.property('file');
    });
  });

  // ---------------------------------------------------------------------------
  // debug.start
  // ---------------------------------------------------------------------------

  describe('debug.start', () => {
    it('passes configName through unchanged', () => {
      const actions: SidecarAction[] = [{ type: 'debug.start', configName: 'Launch Tests' }];
      const result = mapSidecarActionsToInteractiveElements(actions, 0);
      expect(result[0].action.type).to.equal('debug.start');
      expect(result[0].action.params).to.have.property('configName', 'Launch Tests');
    });

    it('passes optional workspaceFolder and stopOnEntry through', () => {
      const actions: SidecarAction[] = [
        { type: 'debug.start', configName: 'Server', workspaceFolder: 'api', stopOnEntry: true },
      ];
      const result = mapSidecarActionsToInteractiveElements(actions, 0);
      expect(result[0].action.params).to.include({
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
      const result = mapSidecarActionsToInteractiveElements(actions, 0);
      expect(result[0].action.type).to.equal('vscode.command');
      expect(result[0].action.params).to.have.property('id', 'workbench.action.openSettings');
    });

    it('wait.condition: passes condition through', () => {
      const actions: SidecarAction[] = [
        { type: 'wait.condition', condition: 'port.open', port: 3000 },
      ];
      const result = mapSidecarActionsToInteractiveElements(actions, 0);
      expect(result[0].action.type).to.equal('wait.condition');
      expect(result[0].action.params).to.include({ condition: 'port.open', port: 3000 });
    });
  });

  // ---------------------------------------------------------------------------
  // Unknown types
  // ---------------------------------------------------------------------------

  describe('unknown action types', () => {
    it('skips unknown type without throwing', () => {
      captureWarn();
      const actions: SidecarAction[] = [{ type: 'does.not.exist' }];
      const result = mapSidecarActionsToInteractiveElements(actions, 1);
      restoreWarn();
      expect(result).to.have.lengthOf(0);
    });

    it('emits a console.warn containing the unknown type name', () => {
      captureWarn();
      const actions: SidecarAction[] = [{ type: 'magic.action' }];
      mapSidecarActionsToInteractiveElements(actions, 4);
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
      const result = mapSidecarActionsToInteractiveElements(actions, 0);
      restoreWarn();
      expect(result).to.have.lengthOf(2);
      expect(result[0].action.type).to.equal('file.open');
      expect(result[1].action.type).to.equal('terminal.run');
      expect(warnMessages).to.have.lengthOf(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Output shape — InteractiveElement
  // ---------------------------------------------------------------------------

  describe('output element shape', () => {
    it('produces an InteractiveElement with source=sidecar and fragment=false', () => {
      const actions: SidecarAction[] = [{ type: 'terminal.run', cmd: 'ls' }];
      const result = mapSidecarActionsToInteractiveElements(actions, 7);
      const el = result[0];
      expect(el).to.have.property('id').that.is.a('string').and.not.empty;
      expect(el).to.have.property('label').that.is.a('string').and.not.empty;
      expect(el).to.have.property('source', 'sidecar');
      expect(el).to.have.property('fragment', false);
      expect(el).to.have.property('rawLink').that.includes('action:terminal.run');
    });

    it('assigns distinct ids to multiple actions', () => {
      const actions: SidecarAction[] = [
        { type: 'file.open', file: 'a.ts' },
        { type: 'file.open', file: 'b.ts' },
      ];
      const result = mapSidecarActionsToInteractiveElements(actions, 0);
      expect(result[0].id).to.not.equal(result[1].id);
    });
  });

  // ---------------------------------------------------------------------------
  // Label derivation
  // ---------------------------------------------------------------------------

  describe('label derivation', () => {
    it('uses explicit label field when provided', () => {
      const actions: SidecarAction[] = [{ type: 'terminal.run', cmd: 'npm install', label: 'Install deps' }];
      const result = mapSidecarActionsToInteractiveElements(actions, 0);
      expect(result[0].label).to.equal('Install deps');
    });

    it('derives "Run: {cmd}" for terminal.run', () => {
      const actions: SidecarAction[] = [{ type: 'terminal.run', cmd: 'npm start' }];
      const result = mapSidecarActionsToInteractiveElements(actions, 0);
      expect(result[0].label).to.equal('Run: npm start');
    });

    it('derives "Open: {filename}" for file.open', () => {
      const actions: SidecarAction[] = [{ type: 'file.open', file: 'src/app.ts' }];
      const result = mapSidecarActionsToInteractiveElements(actions, 0);
      expect(result[0].label).to.equal('Open: app.ts');
    });

    it('derives "Debug: {configName}" for debug.start', () => {
      const actions: SidecarAction[] = [{ type: 'debug.start', configName: 'Launch App' }];
      const result = mapSidecarActionsToInteractiveElements(actions, 0);
      expect(result[0].label).to.equal('Debug: Launch App');
    });

    it('falls back to type name for unrecognised label pattern', () => {
      const actions: SidecarAction[] = [{ type: 'vscode.command', id: 'foo' }];
      const result = mapSidecarActionsToInteractiveElements(actions, 0);
      expect(result[0].label).to.equal('vscode.command');
    });
  });
});


