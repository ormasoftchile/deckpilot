/**
 * Unit tests for EnvVarExpander
 *
 * Features tested:
 * - PowerShell $env:VARNAME expansion
 * - Command %VARNAME% expansion
 * - Mixed syntax in same value
 * - Unknown variables left as-is (not removed)
 * - Empty values handled safely
 * - Case sensitivity
 * - Map expansion (expandEnvVarsInMap)
 * - Edge cases (empty keys, empty values, special chars)
 */

import { expect } from 'chai';
import { expandEnvVars, expandEnvVarsInMap } from '../../../packages/core/src/env/envVarExpander';

describe('EnvVarExpander', () => {
  // Save original process.env state
  const originalEnv = process.env;

  beforeEach(() => {
    // Create a fresh copy of process.env for each test
    process.env = {
      ...originalEnv,
      // Set known test variables
      LOCALAPPDATA: 'C:\\Users\\alice\\AppData\\Local',
      USERPROFILE: 'C:\\Users\\alice',
      HOME: '/home/alice',
      USERNAME: 'alice',
      CUSTOM_VAR: '/usr/local/bin',
    };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  // ========================================================================
  // PowerShell Syntax: $env:VARNAME
  // ========================================================================

  describe('PowerShell syntax ($env:VARNAME)', () => {
    it('should expand $env:LOCALAPPDATA', () => {
      const input = '$env:LOCALAPPDATA\\Microsoft\\SQL Server';
      const result = expandEnvVars(input);
      expect(result).to.equal('C:\\Users\\alice\\AppData\\Local\\Microsoft\\SQL Server');
    });

    it('should expand $env:HOME', () => {
      const input = '$env:HOME/.config/app';
      const result = expandEnvVars(input);
      expect(result).to.equal('/home/alice/.config/app');
    });

    it('should expand $env:CUSTOM_VAR', () => {
      const input = 'PATH=$env:CUSTOM_VAR:/bin:/usr/bin';
      const result = expandEnvVars(input);
      expect(result).to.equal('PATH=/usr/local/bin:/bin:/usr/bin');
    });

    it('should leave unknown $env:VAR as-is', () => {
      const input = '$env:NONEXISTENT_VAR';
      const result = expandEnvVars(input);
      expect(result).to.equal('$env:NONEXISTENT_VAR');
    });

    it('should expand multiple $env: in same string', () => {
      const input = '$env:HOME:$env:USERNAME';
      const result = expandEnvVars(input);
      expect(result).to.equal('/home/alice:alice');
    });

    it('should handle multiple instances of same variable', () => {
      const input = '$env:USERNAME-$env:USERNAME';
      const result = expandEnvVars(input);
      expect(result).to.equal('alice-alice');
    });

    it('should not match $envVAR (no colon)', () => {
      const input = '$envVAR is not expanded';
      const result = expandEnvVars(input);
      expect(result).to.equal(input);
    });

    it('should not match ${env:VAR} (with braces)', () => {
      const input = '${env:USERNAME}';
      const result = expandEnvVars(input);
      expect(result).to.equal(input);
    });

    it('should expand valid identifier characters after $env:', () => {
      const input = '$env:CUSTOM_VAR_123';
      // This var doesn't exist, so should stay as-is
      const result = expandEnvVars(input);
      expect(result).to.equal('$env:CUSTOM_VAR_123');
    });
  });

  // ========================================================================
  // Command Syntax: %VARNAME%
  // ========================================================================

  describe('Command syntax (%VARNAME%)', () => {
    it('should expand %LOCALAPPDATA%', () => {
      const input = '%LOCALAPPDATA%\\MyApp\\config.ini';
      const result = expandEnvVars(input);
      expect(result).to.equal('C:\\Users\\alice\\AppData\\Local\\MyApp\\config.ini');
    });

    it('should expand %USERNAME%', () => {
      const input = 'C:\\Users\\%USERNAME%\\Documents';
      const result = expandEnvVars(input);
      expect(result).to.equal('C:\\Users\\alice\\Documents');
    });

    it('should leave unknown %VAR% as-is', () => {
      const input = '%UNDEFINED_VAR%';
      const result = expandEnvVars(input);
      expect(result).to.equal('%UNDEFINED_VAR%');
    });

    it('should expand multiple %VAR% in same string', () => {
      const input = '%USERPROFILE%\\%USERNAME%\\work';
      const result = expandEnvVars(input);
      expect(result).to.equal('C:\\Users\\alice\\alice\\work');
    });

    it('should handle multiple instances of same %VAR%', () => {
      const input = '%USERNAME%-%USERNAME%';
      const result = expandEnvVars(input);
      expect(result).to.equal('alice-alice');
    });

    it('should not treat %% as a variable', () => {
      const input = 'batch %% syntax';
      const result = expandEnvVars(input);
      expect(result).to.equal(input);
    });

    it('should not match empty % %', () => {
      const input = '% %';
      const result = expandEnvVars(input);
      expect(result).to.equal(input);
    });

    it('should expand valid identifier characters in %VAR%', () => {
      const input = '%CUSTOM_VAR_123%';
      // This var doesn't exist, so should stay as-is
      const result = expandEnvVars(input);
      expect(result).to.equal('%CUSTOM_VAR_123%');
    });
  });

  // ========================================================================
  // Mixed Syntax
  // ========================================================================

  describe('Mixed syntax (PowerShell and Command)', () => {
    it('should expand both $env: and % in one string', () => {
      const input = '$env:HOME and %USERNAME%';
      const result = expandEnvVars(input);
      expect(result).to.equal('/home/alice and alice');
    });

    it('should handle interleaved variables', () => {
      const input = '$env:CUSTOM_VAR:%USERNAME%:$env:HOME';
      const result = expandEnvVars(input);
      expect(result).to.equal('/usr/local/bin:alice:/home/alice');
    });

    it('should expand path with both syntaxes', () => {
      const input = '$env:HOME/%USERNAME%/project';
      const result = expandEnvVars(input);
      expect(result).to.equal('/home/alice/alice/project');
    });

    it('should handle unknown vars of both types', () => {
      const input = '$env:MISSING1 and %MISSING2%';
      const result = expandEnvVars(input);
      expect(result).to.equal('$env:MISSING1 and %MISSING2%');
    });

    it('should mix expanded and unexpanded vars', () => {
      const input = '$env:USERNAME (exists) vs $env:MISSING (unknown)';
      const result = expandEnvVars(input);
      expect(result).to.equal('alice (exists) vs $env:MISSING (unknown)');
    });
  });

  // ========================================================================
  // Edge Cases
  // ========================================================================

  describe('Edge cases', () => {
    it('should handle empty string', () => {
      const result = expandEnvVars('');
      expect(result).to.equal('');
    });

    it('should handle null/undefined gracefully', () => {
      // @ts-ignore - Testing runtime behavior with falsy values
      const result1 = expandEnvVars(null);
      expect(result1).to.be.null;

      // @ts-ignore
      const result2 = expandEnvVars(undefined);
      expect(result2).to.be.undefined;
    });

    it('should handle string with no variables', () => {
      const input = 'plain text with no variables';
      const result = expandEnvVars(input);
      expect(result).to.equal(input);
    });

    it('should handle path with backslashes', () => {
      const input = '$env:LOCALAPPDATA\\Microsoft\\Windows';
      const result = expandEnvVars(input);
      expect(result).to.equal('C:\\Users\\alice\\AppData\\Local\\Microsoft\\Windows');
    });

    it('should handle path with forward slashes', () => {
      const input = '$env:HOME/projects/repo';
      const result = expandEnvVars(input);
      expect(result).to.equal('/home/alice/projects/repo');
    });

    it('should handle URL with variables', () => {
      const input = 'https://api.example.com/$env:USERNAME/profile';
      const result = expandEnvVars(input);
      expect(result).to.equal('https://api.example.com/alice/profile');
    });

    it('should handle variable at start of string', () => {
      const input = '$env:HOME/is/where/i/live';
      const result = expandEnvVars(input);
      expect(result).to.equal('/home/alice/is/where/i/live');
    });

    it('should handle variable at end of string', () => {
      const input = 'path/to/$env:HOME';
      const result = expandEnvVars(input);
      expect(result).to.equal('path/to//home/alice');
    });

    it('should handle variable as entire string', () => {
      const input = '$env:USERNAME';
      const result = expandEnvVars(input);
      expect(result).to.equal('alice');
    });

    it('should handle adjacent variables without separator', () => {
      const input = '%USERNAME%$env:CUSTOM_VAR';
      const result = expandEnvVars(input);
      expect(result).to.equal('alice/usr/local/bin');
    });

    it('should handle variable names starting with underscore', () => {
      process.env._PRIVATE_VAR = 'secret';
      const input = '$env:_PRIVATE_VAR';
      const result = expandEnvVars(input);
      expect(result).to.equal('secret');
    });

    it('should handle variable names with numbers', () => {
      process.env.VAR_123_ABC = 'value';
      const input = '%VAR_123_ABC%';
      const result = expandEnvVars(input);
      expect(result).to.equal('value');
    });

    it('should be case-sensitive for variable names', () => {
      const input = '$env:username'; // lowercase, process.env.USERNAME is uppercase
      const result = expandEnvVars(input);
      expect(result).to.equal('$env:username'); // Not expanded because env is case-sensitive on Unix
    });

    it('should handle special shell characters in values', () => {
      process.env.SPECIAL_VAR = '/path/with spaces & symbols|pipes';
      const input = 'prefix=$env:SPECIAL_VAR';
      const result = expandEnvVars(input);
      expect(result).to.equal('prefix=/path/with spaces & symbols|pipes');
    });
  });

  // ========================================================================
  // expandEnvVarsInMap
  // ========================================================================

  describe('expandEnvVarsInMap', () => {
    it('should expand all values in a Map', () => {
      const input = new Map<string, string>([
        ['INSTALL_DIR', '$env:LOCALAPPDATA\\Tools'],
        ['HOME_PATH', '%USERPROFILE%\\Projects'],
        ['MIXED', '$env:HOME:%USERNAME%'],
      ]);

      const result = expandEnvVarsInMap(input);

      expect(result.get('INSTALL_DIR')).to.equal('C:\\Users\\alice\\AppData\\Local\\Tools');
      expect(result.get('HOME_PATH')).to.equal('C:\\Users\\alice\\Projects');
      expect(result.get('MIXED')).to.equal('/home/alice:alice');
    });

    it('should return a new Map (not mutate original)', () => {
      const input = new Map<string, string>([['VAR', '$env:USERNAME']]);
      const result = expandEnvVarsInMap(input);

      expect(input.get('VAR')).to.equal('$env:USERNAME'); // Original unchanged
      expect(result.get('VAR')).to.equal('alice'); // Result expanded
      expect(input).to.not.equal(result); // Different objects
    });

    it('should handle empty Map', () => {
      const input = new Map<string, string>();
      const result = expandEnvVarsInMap(input);

      expect(result.size).to.equal(0);
    });

    it('should preserve keys exactly', () => {
      const input = new Map<string, string>([
        ['KEY_1', '$env:USERNAME'],
        ['KEY_2', '%USERPROFILE%'],
      ]);

      const result = expandEnvVarsInMap(input);

      expect(Array.from(result.keys())).to.deep.equal(['KEY_1', 'KEY_2']);
    });

    it('should handle values with no variables', () => {
      const input = new Map<string, string>([
        ['PLAIN', 'no variables here'],
        ['ANOTHER', 'plain text'],
      ]);

      const result = expandEnvVarsInMap(input);

      expect(result.get('PLAIN')).to.equal('no variables here');
      expect(result.get('ANOTHER')).to.equal('plain text');
    });

    it('should handle mix of variables and plain values', () => {
      const input = new Map<string, string>([
        ['WITH_VAR', '$env:USERNAME'],
        ['NO_VAR', 'plain text'],
        ['ANOTHER_VAR', '%USERPROFILE%'],
      ]);

      const result = expandEnvVarsInMap(input);

      expect(result.get('WITH_VAR')).to.equal('alice');
      expect(result.get('NO_VAR')).to.equal('plain text');
      expect(result.get('ANOTHER_VAR')).to.equal('C:\\Users\\alice');
    });
  });
});
