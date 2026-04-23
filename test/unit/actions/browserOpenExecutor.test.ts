/**
 * Unit tests for BrowserOpenExecutor.
 *
 * getOrCreateBrowserPanel() is mocked by mutating the module exports object
 * (same pattern as child_process mocking in recorderOrchestrator tests).
 */

import { expect } from 'chai';
import { BrowserOpenExecutor } from '../../../src/actions/browserOpenExecutor';
import { ValidationError } from '../../../src/actions/errors';
import { Action } from '../../../src/models/action';

// Obtain the BrowserPanel module's exports object so we can swap getOrCreateBrowserPanel.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const browserPanelMod = require('../../../src/browser/BrowserPanel') as Record<string, unknown>;

// ── Helpers ────────────────────────────────────────────────────────────────────

function createAction(params: Record<string, unknown>): Action {
  return {
    id: 'action-test',
    type: 'browser.open',
    params,
    status: 'pending',
    slideIndex: 0,
  };
}

function createContext() {
  return {
    workspaceRoot: '/test',
    basePath: '/test',
    deckFilePath: '/test/demo.deck.md',
    currentSlideIndex: 0,
    isWorkspaceTrusted: true,
    cancellationToken: { isCancellationRequested: false },
    outputChannel: { appendLine: (_msg: string) => undefined },
  };
}

type MockPanel = {
  open: (url: string, column: number, title: string) => boolean;
  navigate: (url: string) => { wasOpen: boolean; previousUrl: string | undefined };
  close: () => void;
  isOpen: () => boolean;
  getCurrentUrl: () => string | undefined;
};

function makePanel(overrides: Partial<MockPanel> = {}): MockPanel {
  return {
    open: () => true,
    navigate: () => ({ wasOpen: false, previousUrl: undefined }),
    close: () => undefined,
    isOpen: () => false,
    getCurrentUrl: () => undefined,
    ...overrides,
  };
}

// ── Test Suite ─────────────────────────────────────────────────────────────────

describe('BrowserOpenExecutor', () => {
  let executor: BrowserOpenExecutor;
  let savedGetOrCreate: unknown;

  beforeEach(() => {
    executor = new BrowserOpenExecutor();
    savedGetOrCreate = browserPanelMod['getOrCreateBrowserPanel'];
  });

  afterEach(() => {
    browserPanelMod['getOrCreateBrowserPanel'] = savedGetOrCreate;
  });

  // ── validate() ──────────────────────────────────────────────────────────────

  describe('validate()', () => {
    it('throws ValidationError when url is missing (empty string)', () => {
      expect(() => executor.validate({ url: '' } as never)).to.throw(ValidationError);
    });

    it('throws ValidationError when url is not a string', () => {
      expect(() => executor.validate({ url: 42 } as never)).to.throw(ValidationError);
    });

    it('throws ValidationError for non-localhost http:// URL', () => {
      expect(() => executor.validate({ url: 'http://example.com' })).to.throw(ValidationError);
    });

    it('throws ValidationError for javascript: URL', () => {
      expect(() => executor.validate({ url: 'javascript:alert(1)' })).to.throw(ValidationError);
    });

    it('does not throw for a valid https:// URL', () => {
      expect(() => executor.validate({ url: 'https://example.com' })).not.to.throw();
    });

    it('does not throw for http://localhost URL', () => {
      expect(() => executor.validate({ url: 'http://localhost:3000' })).not.to.throw();
    });
  });

  // ── execute() — success ────────────────────────────────────────────────────

  describe('execute() — success', () => {
    it('returns success when panel opens for a valid https URL', async () => {
      browserPanelMod['getOrCreateBrowserPanel'] = () => makePanel();

      const result = await executor.execute(
        createAction({ url: 'https://example.com' }),
        createContext() as never,
      );

      expect(result.success).to.equal(true);
      expect(result.canUndo).to.equal(true);
    });

    it('returns failure result (not throws) when validation fails inside execute()', async () => {
      browserPanelMod['getOrCreateBrowserPanel'] = () => makePanel();

      const result = await executor.execute(
        createAction({ url: 'javascript:pwned' }),
        createContext() as never,
      );

      expect(result.success).to.equal(false);
      expect(result.error).to.be.a('string');
    });
  });

  // ── Column mapping ─────────────────────────────────────────────────────────

  describe('column mapping', () => {
    it('defaults to ViewColumn.Two (value 2) when column is omitted', async () => {
      const openArgs: Array<{ url: string; column: number; title: string }> = [];
      browserPanelMod['getOrCreateBrowserPanel'] = () =>
        makePanel({ open: (url, column, title) => { openArgs.push({ url, column, title }); return true; } });

      await executor.execute(createAction({ url: 'https://example.com' }), createContext() as never);

      expect(openArgs).to.have.length(1);
      expect(openArgs[0].column).to.equal(2);
    });

    it('maps column: 3 to ViewColumn.Three (value 3)', async () => {
      const openArgs: Array<{ url: string; column: number; title: string }> = [];
      browserPanelMod['getOrCreateBrowserPanel'] = () =>
        makePanel({ open: (url, column, title) => { openArgs.push({ url, column, title }); return true; } });

      await executor.execute(
        createAction({ url: 'https://example.com', column: 3 }),
        createContext() as never,
      );

      expect(openArgs[0].column).to.equal(3);
    });

    it('maps column: -1 to ViewColumn.Beside (value -2)', async () => {
      const openArgs: Array<{ url: string; column: number; title: string }> = [];
      browserPanelMod['getOrCreateBrowserPanel'] = () =>
        makePanel({ open: (url, column, title) => { openArgs.push({ url, column, title }); return true; } });

      await executor.execute(
        createAction({ url: 'https://example.com', column: -1 }),
        createContext() as never,
      );

      expect(openArgs[0].column).to.equal(-2);
    });
  });

  // ── Undo ──────────────────────────────────────────────────────────────────

  describe('undo behaviour', () => {
    it('undo closes the panel when it was newly created (wasNew = true)', async () => {
      let closeCalled = false;
      browserPanelMod['getOrCreateBrowserPanel'] = () =>
        makePanel({
          open: () => true,           // panel is new
          getCurrentUrl: () => undefined,
          close: () => { closeCalled = true; },
        });

      const result = await executor.execute(
        createAction({ url: 'https://example.com' }),
        createContext() as never,
      );

      expect(result.undo).to.be.a('function');
      await result.undo!();
      expect(closeCalled).to.equal(true);
    });

    it('undo navigates back to the previous URL when panel was already open (wasNew = false)', async () => {
      const navigateCalls: string[] = [];
      browserPanelMod['getOrCreateBrowserPanel'] = () =>
        makePanel({
          open: () => false,          // panel was already open
          getCurrentUrl: () => 'https://old.com',
          navigate: (url) => { navigateCalls.push(url); return { wasOpen: true, previousUrl: 'https://old.com' }; },
        });

      const result = await executor.execute(
        createAction({ url: 'https://example.com' }),
        createContext() as never,
      );

      await result.undo!();
      expect(navigateCalls).to.deep.equal(['https://old.com']);
    });
  });
});
