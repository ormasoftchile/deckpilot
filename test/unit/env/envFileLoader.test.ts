/**
 * Unit tests for EnvFileLoader
 * Per T004 — Tests written FIRST, must FAIL before implementation.
 *
 * Covers: valid .deck.env parsing, quoted values, values with =,
 * empty values, comments, blank lines, malformed lines, invalid keys,
 * duplicate keys (last wins), file not found, BOM stripping,
 * generateTemplate() output format.
 */

import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EnvFileLoader } from '../../../src/env/envFileLoader';
import { EnvDeclaration } from '../../../src/models/env';

describe('EnvFileLoader', () => {
  let loader: EnvFileLoader;
  let tmpDir: string;

  beforeEach(() => {
    loader = new EnvFileLoader();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'envloader-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeDeckFile(content: string, basename = 'test'): string {
    const deckPath = path.join(tmpDir, `${basename}.deck.md`);
    fs.writeFileSync(deckPath, '---\ntitle: Test\n---\n# Slide');
    const envPath = path.join(tmpDir, `${basename}.deck.env`);
    fs.writeFileSync(envPath, content);
    return deckPath;
  }

  // ========================================================================
  // loadEnvFile — valid parsing
  // ========================================================================

  describe('loadEnvFile', () => {
    it('should parse simple KEY=VALUE pairs', async () => {
      const deckPath = writeDeckFile('FOO=bar\nBAZ=qux');
      const result = await loader.loadEnvFile(deckPath);

      expect(result.exists).to.be.true;
      expect(result.values.get('FOO')).to.equal('bar');
      expect(result.values.get('BAZ')).to.equal('qux');
      expect(result.errors).to.have.length(0);
    });

    it('should strip double quotes from values', async () => {
      const deckPath = writeDeckFile('KEY="hello world"');
      const result = await loader.loadEnvFile(deckPath);

      expect(result.values.get('KEY')).to.equal('hello world');
    });

    it('should strip single quotes from values', async () => {
      const deckPath = writeDeckFile("KEY='hello world'");
      const result = await loader.loadEnvFile(deckPath);

      expect(result.values.get('KEY')).to.equal('hello world');
    });

    it('should split on first = only (values may contain =)', async () => {
      const deckPath = writeDeckFile('CONNECTION=host=localhost;port=5432');
      const result = await loader.loadEnvFile(deckPath);

      expect(result.values.get('CONNECTION')).to.equal('host=localhost;port=5432');
    });

    it('should handle empty values (KEY=)', async () => {
      const deckPath = writeDeckFile('EMPTY=');
      const result = await loader.loadEnvFile(deckPath);

      expect(result.values.get('EMPTY')).to.equal('');
    });

    it('should skip comment lines (starting with #)', async () => {
      const deckPath = writeDeckFile('# This is a comment\nKEY=value');
      const result = await loader.loadEnvFile(deckPath);

      expect(result.values.size).to.equal(1);
      expect(result.values.get('KEY')).to.equal('value');
    });

    it('should skip blank lines', async () => {
      const deckPath = writeDeckFile('A=1\n\n\nB=2');
      const result = await loader.loadEnvFile(deckPath);

      expect(result.values.size).to.equal(2);
      expect(result.values.get('A')).to.equal('1');
      expect(result.values.get('B')).to.equal('2');
    });

    it('should report malformed lines (no =) as EnvFileError with line number', async () => {
      const deckPath = writeDeckFile('GOOD=value\nBADLINE\nALSO_GOOD=ok');
      const result = await loader.loadEnvFile(deckPath);

      expect(result.values.size).to.equal(2);
      expect(result.errors).to.have.length(1);
      expect(result.errors[0].line).to.equal(2);
      expect(result.errors[0].rawText).to.equal('BADLINE');
      expect(result.errors[0].message.toLowerCase()).to.include('malformed');
    });

    it('should report invalid key characters as error', async () => {
      const deckPath = writeDeckFile('123INVALID=value');
      const result = await loader.loadEnvFile(deckPath);

      expect(result.errors).to.have.length(1);
      expect(result.errors[0].message.toLowerCase()).to.include('invalid');
    });

    it('should handle =VALUE (empty key) as malformed', async () => {
      const deckPath = writeDeckFile('=nokey');
      const result = await loader.loadEnvFile(deckPath);

      expect(result.errors).to.have.length(1);
    });

    it('should use last value for duplicate keys (last wins)', async () => {
      const deckPath = writeDeckFile('DUP=first\nDUP=second');
      const result = await loader.loadEnvFile(deckPath);

      expect(result.values.get('DUP')).to.equal('second');
      expect(result.errors).to.have.length(0);
    });

    it('should return exists=false when .deck.env not found', async () => {
      const deckPath = path.join(tmpDir, 'noenv.deck.md');
      fs.writeFileSync(deckPath, '# empty');
      const result = await loader.loadEnvFile(deckPath);

      expect(result.exists).to.be.false;
      expect(result.values.size).to.equal(0);
      expect(result.errors).to.have.length(0);
    });

    it('should strip BOM from file content', async () => {
      const deckPath = writeDeckFile('\uFEFFKEY=value');
      const result = await loader.loadEnvFile(deckPath);

      expect(result.values.get('KEY')).to.equal('value');
    });

    it('should handle values with spaces around =', async () => {
      const deckPath = writeDeckFile('KEY = value with spaces');
      const result = await loader.loadEnvFile(deckPath);

      expect(result.values.get('KEY')).to.equal('value with spaces');
    });

    it('should preserve quoted values containing # (not inline comment)', async () => {
      const deckPath = writeDeckFile('KEY="value # not comment"');
      const result = await loader.loadEnvFile(deckPath);

      expect(result.values.get('KEY')).to.equal('value # not comment');
    });

    it('should accept underscored keys like _PRIVATE', async () => {
      const deckPath = writeDeckFile('_PRIVATE=secret');
      const result = await loader.loadEnvFile(deckPath);

      expect(result.values.get('_PRIVATE')).to.equal('secret');
    });
  });

  // ========================================================================
  // OS environment variable expansion
  // ========================================================================

  describe('OS environment variable expansion', () => {
    // Save and restore process.env
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = {
        ...originalEnv,
        TEST_VAR: '/test/path',
        USER_NAME: 'testuser',
        APP_HOME: 'C:\\Program Files\\MyApp',
      };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should expand PowerShell $env:VAR syntax in values', async () => {
      const deckPath = writeDeckFile('INSTALL_DIR=$env:APP_HOME\\bin');
      const result = await loader.loadEnvFile(deckPath);

      expect(result.values.get('INSTALL_DIR')).to.equal('C:\\Program Files\\MyApp\\bin');
    });

    it('should expand cmd %VAR% syntax in values', async () => {
      const deckPath = writeDeckFile('WORK_DIR=C:\\Users\\%USER_NAME%\\projects');
      const result = await loader.loadEnvFile(deckPath);

      expect(result.values.get('WORK_DIR')).to.equal('C:\\Users\\testuser\\projects');
    });

    it('should expand both syntaxes in same value', async () => {
      const deckPath = writeDeckFile('PATH=$env:TEST_VAR/%USER_NAME%');
      const result = await loader.loadEnvFile(deckPath);

      expect(result.values.get('PATH')).to.equal('/test/path/testuser');
    });

    it('should leave unknown variables as-is (not remove them)', async () => {
      const deckPath = writeDeckFile('CONFIG=$env:UNDEFINED_VAR/config');
      const result = await loader.loadEnvFile(deckPath);

      expect(result.values.get('CONFIG')).to.equal('$env:UNDEFINED_VAR/config');
    });

    it('should leave unknown cmd vars as-is', async () => {
      const deckPath = writeDeckFile('CONFIG=C:\\%NONEXISTENT%\\data');
      const result = await loader.loadEnvFile(deckPath);

      expect(result.values.get('CONFIG')).to.equal('C:\\%NONEXISTENT%\\data');
    });

    it('should mix expanded and unexpanded variables', async () => {
      const deckPath = writeDeckFile('PATH=$env:TEST_VAR:$env:MISSING:/usr/bin');
      const result = await loader.loadEnvFile(deckPath);

      expect(result.values.get('PATH')).to.equal('/test/path:$env:MISSING:/usr/bin');
    });

    it('should work with quoted values', async () => {
      const deckPath = writeDeckFile('QUOTED="$env:APP_HOME\\tools"');
      const result = await loader.loadEnvFile(deckPath);

      expect(result.values.get('QUOTED')).to.equal('C:\\Program Files\\MyApp\\tools');
    });

    it('should work with single-quoted values', async () => {
      const deckPath = writeDeckFile("QUOTED='$env:TEST_VAR/bin'");
      const result = await loader.loadEnvFile(deckPath);

      expect(result.values.get('QUOTED')).to.equal('/test/path/bin');
    });

    it('should expand multiple occurrences of same variable', async () => {
      const deckPath = writeDeckFile('DUP=$env:TEST_VAR:$env:TEST_VAR');
      const result = await loader.loadEnvFile(deckPath);

      expect(result.values.get('DUP')).to.equal('/test/path:/test/path');
    });

    it('should handle empty values gracefully', async () => {
      const deckPath = writeDeckFile('EMPTY=');
      const result = await loader.loadEnvFile(deckPath);

      expect(result.values.get('EMPTY')).to.equal('');
    });

    it('should not affect comment lines', async () => {
      const deckPath = writeDeckFile('# This has $env:TEST_VAR in comment\nVAR=$env:TEST_VAR');
      const result = await loader.loadEnvFile(deckPath);

      expect(result.values.size).to.equal(1);
      expect(result.values.get('VAR')).to.equal('/test/path');
    });

    it('should work with values containing = (split on first =)', async () => {
      const deckPath = writeDeckFile('CONNECTION=host=$env:TEST_VAR;user=%USER_NAME%');
      const result = await loader.loadEnvFile(deckPath);

      expect(result.values.get('CONNECTION')).to.equal('host=/test/path;user=testuser');
    });
  });

  // ========================================================================
  // generateTemplate
  // ========================================================================

  describe('generateTemplate', () => {
    it('should generate template with header comment', () => {
      const declarations: EnvDeclaration[] = [
        { name: 'REPO', description: 'Repo path', required: true, secret: false, validate: 'directory' },
      ];
      const result = loader.generateTemplate(declarations, 'demo.deck.md');

      expect(result).to.include('# Environment variables for demo.deck.md');
      expect(result).to.include('# Copy this file to .deck.env');
    });

    it('should include description, required/secret/validate metadata, and NAME= placeholder', () => {
      const declarations: EnvDeclaration[] = [
        { name: 'TOKEN', description: 'API token', required: false, secret: true, validate: undefined },
      ];
      const result = loader.generateTemplate(declarations, 'test.deck.md');

      expect(result).to.include('# API token');
      expect(result).to.include('Secret: yes');
      expect(result).to.include('TOKEN=');
    });

    it('should include default value hint when default is set', () => {
      const declarations: EnvDeclaration[] = [
        { name: 'BRANCH', description: 'Branch name', required: false, secret: false, default: 'main' },
      ];
      const result = loader.generateTemplate(declarations, 'test.deck.md');

      expect(result).to.include('Default: main');
      expect(result).to.include('BRANCH=');
    });

    it('should handle multiple declarations', () => {
      const declarations: EnvDeclaration[] = [
        { name: 'A', description: 'First', required: true, secret: false },
        { name: 'B', description: 'Second', required: false, secret: true },
      ];
      const result = loader.generateTemplate(declarations, 'multi.deck.md');

      expect(result).to.include('A=');
      expect(result).to.include('B=');
    });

    it('should return empty template for no declarations', () => {
      const result = loader.generateTemplate([], 'empty.deck.md');

      expect(result).to.include('# Environment variables for empty.deck.md');
      // Should still have header but no variable entries
    });
  });
});
