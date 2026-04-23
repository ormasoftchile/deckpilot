/**
 * Unit tests for sidecarLoader — DA-03/DA-04 sidecar file discovery and parsing.
 *
 * Covers:
 * - resolveSidecarPath: happy path, nested directories, non-deck.md input
 * - sidecarExists: file present, file absent, bad path input
 * - loadSidecar: null on missing file, full parse, partial shapes, errors
 */

import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { resolveSidecarPath, sidecarExists, loadSidecar } from '../../../src/parser/sidecarLoader';

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

  // =========================================================================
  // loadSidecar
  // =========================================================================

  describe('loadSidecar', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecar-load-test-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    function deckMdPath(name = 'demo'): string {
      return path.join(tmpDir, `${name}.deck.md`);
    }

    function writeSidecar(name: string, content: string): void {
      fs.writeFileSync(path.join(tmpDir, `${name}.deck.yaml`), content, 'utf-8');
    }

    // ── null on missing sidecar ────────────────────────────────────────────

    it('returns null when no sidecar exists alongside the .deck.md', async () => {
      const mdPath = deckMdPath();
      fs.writeFileSync(mdPath, '');

      const result = await loadSidecar(mdPath);
      expect(result).to.be.null;
    });

    it('returns null when neither .deck.md nor .deck.yaml exist', async () => {
      const mdPath = deckMdPath('phantom');
      // absence of sidecar is not an error
      const result = await loadSidecar(mdPath);
      expect(result).to.be.null;
    });

    // ── empty YAML ────────────────────────────────────────────────────────

    it('returns an empty object {} for an empty YAML file', async () => {
      const mdPath = deckMdPath();
      writeSidecar('demo', '');

      // Empty YAML parses to null internally; implementation returns {}
      const result = await loadSidecar(mdPath);
      expect(result).to.deep.equal({});
    });

    it('returns an empty object {} for a YAML file containing only whitespace', async () => {
      const mdPath = deckMdPath();
      writeSidecar('demo', '   \n\n   ');

      const result = await loadSidecar(mdPath);
      expect(result).to.deep.equal({});
    });

    // ── full valid sidecar ─────────────────────────────────────────────────

    it('parses a fully-populated sidecar into a SidecarFile shape', async () => {
      const mdPath = deckMdPath();
      writeSidecar('demo', [
        'deck:',
        '  title: My Talk',
        '  theme: dark',
        'slides:',
        '  - id: intro',
        '    cues:',
        '      - Welcome everyone',
        '    duration: 30s',
        '    actions:',
        '      - type: file.open',
        '        file: src/app.ts',
        '    checkpoint: opened app',
        'recording:',
        '  autoStart: true',
        'export:',
        '  subtitles: true',
        '  video: false',
      ].join('\n'));

      const result = await loadSidecar(mdPath);
      expect(result).to.not.be.null;
      expect(result!.deck).to.deep.equal({ title: 'My Talk', theme: 'dark' });
      expect(result!.slides).to.have.length(1);
      expect(result!.slides![0].id).to.equal('intro');
      expect(result!.slides![0].cues).to.deep.equal(['Welcome everyone']);
      expect(result!.slides![0].duration).to.equal('30s');
      expect(result!.slides![0].actions).to.deep.equal([{ type: 'file.open', file: 'src/app.ts' }]);
      expect(result!.slides![0].checkpoint).to.equal('opened app');
      expect(result!.recording).to.deep.equal({ autoStart: true });
      expect(result!.export).to.deep.equal({ subtitles: true, video: false });
    });

    // ── partial sidecar shapes ─────────────────────────────────────────────

    it('handles a sidecar with only deck metadata (no slides)', async () => {
      const mdPath = deckMdPath();
      writeSidecar('demo', [
        'deck:',
        '  title: Intro to TypeScript',
        '  theme: light',
      ].join('\n'));

      const result = await loadSidecar(mdPath);
      expect(result).to.not.be.null;
      expect(result!.deck).to.deep.equal({ title: 'Intro to TypeScript', theme: 'light' });
      expect(result!.slides).to.be.undefined;
      expect(result!.recording).to.be.undefined;
      expect(result!.export).to.be.undefined;
    });

    it('handles a sidecar with only slides (no deck metadata)', async () => {
      const mdPath = deckMdPath();
      writeSidecar('demo', [
        'slides:',
        '  - id: setup',
        '    cues:',
        '      - Let us begin',
        '  - id: demo',
        '    duration: 60s',
      ].join('\n'));

      const result = await loadSidecar(mdPath);
      expect(result).to.not.be.null;
      expect(result!.deck).to.be.undefined;
      expect(result!.slides).to.have.length(2);
      expect(result!.slides![0].id).to.equal('setup');
      expect(result!.slides![1].id).to.equal('demo');
    });

    it('handles a sidecar with only recording settings', async () => {
      const mdPath = deckMdPath();
      writeSidecar('demo', 'recording:\n  autoStart: false');

      const result = await loadSidecar(mdPath);
      expect(result).to.not.be.null;
      expect(result!.recording).to.deep.equal({ autoStart: false });
      expect(result!.deck).to.be.undefined;
      expect(result!.slides).to.be.undefined;
    });

    it('handles a sidecar with only export settings', async () => {
      const mdPath = deckMdPath();
      writeSidecar('demo', 'export:\n  subtitles: true\n  video: true');

      const result = await loadSidecar(mdPath);
      expect(result).to.not.be.null;
      expect(result!.export).to.deep.equal({ subtitles: true, video: true });
    });

    // ── unknown / extra fields ─────────────────────────────────────────────

    it('preserves unknown top-level fields without throwing (extensible schema)', async () => {
      const mdPath = deckMdPath();
      writeSidecar('demo', [
        'deck:',
        '  title: Forward-Compat Test',
        'futureSection:',
        '  someKey: someValue',
      ].join('\n'));

      // Should not throw — unknown fields pass through the cast
      const result = await loadSidecar(mdPath) as Record<string, unknown>;
      expect(result).to.not.be.null;
      expect((result as { deck: { title: string } }).deck.title).to.equal('Forward-Compat Test');
      expect(result['futureSection']).to.deep.equal({ someKey: 'someValue' });
    });

    it('preserves unknown fields on slide entries without throwing', async () => {
      const mdPath = deckMdPath();
      writeSidecar('demo', [
        'slides:',
        '  - id: intro',
        '    unknownProp: hello',
        '    anotherProp: 42',
      ].join('\n'));

      const result = await loadSidecar(mdPath) as Record<string, unknown>;
      expect(result).to.not.be.null;
      const slides = result['slides'] as Array<Record<string, unknown>>;
      expect(slides[0]['id']).to.equal('intro');
      expect(slides[0]['unknownProp']).to.equal('hello');
      expect(slides[0]['anotherProp']).to.equal(42);
    });

    // ── error cases ───────────────────────────────────────────────────────

    it('returns null for malformed YAML (invalid syntax)', async () => {
      const mdPath = deckMdPath();
      // Unclosed bracket is invalid YAML
      writeSidecar('demo', 'deck:\n  title: Broken\n  theme: [unclosed');

      const result = await loadSidecar(mdPath);
      expect(result).to.be.null;
    });

    it('returns the sidecar even when a slide entry is missing the required id field (validateSidecarSchema handles this)', async () => {
      const mdPath = deckMdPath();
      writeSidecar('demo', [
        'slides:',
        '  - cues:',
        "      - This slide has no id",
        '    duration: 10s',
      ].join('\n'));

      const result = await loadSidecar(mdPath);
      // loadSidecar no longer throws for missing ids — it returns the parsed object;
      // use validateSidecarSchema to surface the missing-id diagnostic.
      expect(result).to.not.be.null;
      expect(result).to.have.property('slides');
    });

    it('returns the sidecar for a slide entry with an empty string id', async () => {
      const mdPath = deckMdPath();
      writeSidecar('demo', [
        'slides:',
        '  - id: ""',
        '    duration: 5s',
      ].join('\n'));

      const result = await loadSidecar(mdPath);
      expect(result).to.not.be.null;
    });

    it('returns the sidecar for a slide entry with a whitespace-only id', async () => {
      const mdPath = deckMdPath();
      writeSidecar('demo', 'slides:\n  - id: "   "\n    duration: 5s');

      const result = await loadSidecar(mdPath);
      expect(result).to.not.be.null;
    });

    it('returns null for a top-level YAML array (must be a mapping)', async () => {
      const mdPath = deckMdPath();
      writeSidecar('demo', '- id: intro\n- id: setup');

      const result = await loadSidecar(mdPath);
      expect(result).to.be.null;
    });

    it('returns the sidecar when an earlier valid slide precedes a missing-id slide', async () => {
      const mdPath = deckMdPath();
      writeSidecar('demo', [
        'slides:',
        '  - id: intro',
        '  - cues:',
        '      - Missing id',
        '  - id: outro',
      ].join('\n'));

      const result = await loadSidecar(mdPath);
      // The parseable sidecar is returned; validateSidecarSchema flags slides[1] missing id.
      expect(result).to.not.be.null;
      expect((result as { slides: unknown[] }).slides).to.have.length(3);
    });
  });
});
