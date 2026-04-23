/**
 * Unit tests for BrowserNavigateExecutor.
 *
 * getOrCreateBrowserPanel() is mocked by mutating the module exports object.
 */

import { expect } from 'chai';
import { BrowserNavigateExecutor } from '../../../src/actions/browserNavigateExecutor';
import { ValidationError } from '../../../src/actions/errors';
import { Action } from '../../../src/models/action';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const browserPanelMod = require('../../../src/browser/BrowserPanel') as Record<string, unknown>;

// ── Helpers ────────────────────────────────────────────────────────────────────

function createAction(params: Record<string, unknown>): Action {
  return {
    id: 'action-test',
    type: 'browser.navigate',
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

// ── Test Suite ─────────────────────────────────────────────────────────────────

describe('BrowserNavigateExecutor', () => {
  let executor: BrowserNavigateExecutor;
  let savedGetOrCreate: unknown;

  beforeEach(() => {
    executor = new BrowserNavigateExecutor();
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
      expect(() => executor.validate({ url: null } as never)).to.throw(ValidationError);
    });

    it('throws ValidationError for invalid scheme (javascript:)', () => {
      expect(() => executor.validate({ url: 'javascript:alert(1)' })).to.throw(ValidationError);
    });

    it('throws ValidationError for non-localhost http:// URL', () => {
      expect(() => executor.validate({ url: 'http://evil.com' })).to.throw(ValidationError);
    });

    it('does not throw for https:// URL', () => {
      expect(() => executor.validate({ url: 'https://api.example.com' })).not.to.throw();
    });

    it('does not throw for http://127.0.0.1 URL', () => {
      expect(() => executor.validate({ url: 'http://127.0.0.1:3000' })).not.to.throw();
    });
  });

  // ── execute() ──────────────────────────────────────────────────────────────

  describe('execute()', () => {
    it('navigates to the given URL and returns a success result', async () => {
      const navigateCalls: string[] = [];
      browserPanelMod['getOrCreateBrowserPanel'] = () => ({
        navigate: (url: string) => {
          navigateCalls.push(url);
          return { wasOpen: true, previousUrl: 'https://old.com' };
        },
        close: () => undefined,
      });

      const result = await executor.execute(
        createAction({ url: 'https://new.com' }),
        createContext() as never,
      );

      expect(result.success).to.equal(true);
      expect(result.canUndo).to.equal(true);
      expect(navigateCalls).to.deep.equal(['https://new.com']);
    });

    it('returns failure result (not throws) when URL is invalid', async () => {
      browserPanelMod['getOrCreateBrowserPanel'] = () => ({
        navigate: () => ({ wasOpen: false, previousUrl: undefined }),
        close: () => undefined,
      });

      const result = await executor.execute(
        createAction({ url: 'file:///etc/passwd' }),
        createContext() as never,
      );

      expect(result.success).to.equal(false);
      expect(result.error).to.be.a('string');
    });
  });

  // ── Undo ──────────────────────────────────────────────────────────────────

  describe('undo behaviour', () => {
    it('undo navigates back to the previous URL', async () => {
      const navigateCalls: string[] = [];
      browserPanelMod['getOrCreateBrowserPanel'] = () => ({
        navigate: (url: string) => {
          navigateCalls.push(url);
          return { wasOpen: true, previousUrl: 'https://old.com' };
        },
        close: () => undefined,
      });

      const result = await executor.execute(
        createAction({ url: 'https://new.com' }),
        createContext() as never,
      );

      await result.undo!();
      // First call: execute navigate('https://new.com')
      // Second call: undo navigate('https://old.com')
      expect(navigateCalls).to.deep.equal(['https://new.com', 'https://old.com']);
    });

    it('undo closes the panel when there was no previous URL', async () => {
      let closeCalled = false;
      browserPanelMod['getOrCreateBrowserPanel'] = () => ({
        navigate: (_url: string) => ({ wasOpen: false, previousUrl: undefined }),
        close: () => { closeCalled = true; },
      });

      const result = await executor.execute(
        createAction({ url: 'https://new.com' }),
        createContext() as never,
      );

      await result.undo!();
      expect(closeCalled).to.equal(true);
    });
  });
});
