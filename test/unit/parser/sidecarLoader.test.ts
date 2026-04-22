/**
 * Unit tests for sidecarLoader — DA-03 sidecar file discovery utilities.
 *
 * Covers:
 * - resolveSidecarPath: happy path, nested directories, non-deck.md input
 * - sidecarExists: file present, file absent, bad path input
 */

import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { resolveSidecarPath, sidecarExists } from '../../../src/parser/sidecarLoader';

describe('sidecarLoader', () => {
  // =========================================================================
  // resolveSidecarPath
  // =========================================================================

  describe('resolveSidecarPath', () => {
    it('returns companion .deck.yaml in the same directory', () => {
      const result = resolveSidecarPath('/projects/demo.deck.md');
      expect(result).to.equal('/projects/demo.deck.yaml');
    });

    it('handles nested directories', () => {
      const result = resolveSidecarPath('/a/b/c/my-talk.deck.md');
      expect(result).to.equal('/a/b/c/my-talk.deck.yaml');
    });

    it('handles filenames with dots in the basename', () => {
      const result = resolveSidecarPath('/foo/v1.0.deck.md');
      expect(result).to.equal('/foo/v1.0.deck.yaml');
    });

    it('only replaces the trailing .deck.md suffix', () => {
      // Ensure "deck.md" inside the stem is not touched
      const result = resolveSidecarPath('/path/deck.md.deck.md');
      expect(result).to.equal('/path/deck.md.deck.yaml');
    });

    it('throws a clear error when the path does not end with .deck.md', () => {
      expect(() => resolveSidecarPath('/foo/notes.md')).to.throw(
        "resolveSidecarPath: expected a .deck.md file path, got 'notes.md'"
      );
    });

    it('throws when given a .deck.yaml path directly', () => {
      expect(() => resolveSidecarPath('/foo/demo.deck.yaml')).to.throw(
        "resolveSidecarPath: expected a .deck.md file path, got 'demo.deck.yaml'"
      );
    });

    it('throws when given a bare filename with no extension', () => {
      expect(() => resolveSidecarPath('/foo/mydeck')).to.throw(
        "resolveSidecarPath: expected a .deck.md file path, got 'mydeck'"
      );
    });
  });

  // =========================================================================
  // sidecarExists
  // =========================================================================

  describe('sidecarExists', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecar-test-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('returns true when .deck.yaml exists alongside the .deck.md file', async () => {
      const deckMd = path.join(tmpDir, 'demo.deck.md');
      const deckYaml = path.join(tmpDir, 'demo.deck.yaml');
      fs.writeFileSync(deckMd, '');
      fs.writeFileSync(deckYaml, '');

      const result = await sidecarExists(deckMd);
      expect(result).to.be.true;
    });

    it('returns false when .deck.yaml does not exist', async () => {
      const deckMd = path.join(tmpDir, 'demo.deck.md');
      fs.writeFileSync(deckMd, '');

      const result = await sidecarExists(deckMd);
      expect(result).to.be.false;
    });

    it('returns false even when the .deck.md itself does not exist', async () => {
      const deckMd = path.join(tmpDir, 'missing.deck.md');
      // neither file exists — should still return false, not throw
      const result = await sidecarExists(deckMd);
      expect(result).to.be.false;
    });

    it('propagates the error from resolveSidecarPath when path is not .deck.md', async () => {
      let caught: Error | undefined;
      try {
        await sidecarExists('/foo/notes.md');
      } catch (err) {
        caught = err as Error;
      }
      expect(caught).to.be.instanceOf(Error);
      expect(caught?.message).to.include('expected a .deck.md file path');
    });
  });
});
