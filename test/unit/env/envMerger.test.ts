/**
 * Unit tests for resolveEnvironment (DA-22).
 *
 * Covers:
 * - No sidecar: only .deck.env + process.env
 * - Sidecar common: merged below .deck.env
 * - Sidecar platform: merged above common, below .deck.env
 * - Unknown platform: platform layer skipped gracefully
 * - Precedence chain: .deck.env wins over platform wins over common wins over process.env
 * - Empty sidecar: no errors, returns process.env + .deck.env
 * - No .deck.env file: only process.env + sidecar layers
 * - Null sidecar: only .deck.env + process.env
 */

import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { resolveEnvironment } from '../../../packages/core/src/env/envMerger';
import type { SidecarFile } from '../../../packages/core/src/models/sidecar';

describe('resolveEnvironment', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'envmerger-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeDeckFile(basename = 'test'): string {
    const deckPath = path.join(tmpDir, `${basename}.deck.md`);
    fs.writeFileSync(deckPath, '---\ntitle: Test\n---\n# Slide');
    return deckPath;
  }

  function writeDeckEnv(deckPath: string, content: string): void {
    const envPath = deckPath.replace(/\.deck\.md$/, '.deck.env');
    fs.writeFileSync(envPath, content);
  }

  // -------------------------------------------------------------------------
  // Null/empty sidecar cases
  // -------------------------------------------------------------------------

  it('returns a record containing process.env keys when sidecar is null and no .deck.env', async () => {
    const deckPath = writeDeckFile();
    const result = await resolveEnvironment(deckPath, null, 'darwin');

    // Should contain at least the entries from process.env (non-undefined)
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        expect(result[key]).to.equal(value);
      }
    }
  });

  it('returns a record when sidecar is null and .deck.env exists', async () => {
    const deckPath = writeDeckFile();
    writeDeckEnv(deckPath, 'MY_KEY=from_env_file\n');

    const result = await resolveEnvironment(deckPath, null, 'darwin');
    expect(result['MY_KEY']).to.equal('from_env_file');
  });

  it('handles empty sidecar object without throwing', async () => {
    const deckPath = writeDeckFile();
    const sidecar: SidecarFile = {};

    const result = await resolveEnvironment(deckPath, sidecar, 'darwin');
    expect(result).to.be.an('object');
  });

  // -------------------------------------------------------------------------
  // Sidecar common layer
  // -------------------------------------------------------------------------

  it('includes sidecar common values when no .deck.env overrides them', async () => {
    const deckPath = writeDeckFile();
    const sidecar: SidecarFile = {
      environment: {
        common: { COMMON_VAR: 'common_value' },
      },
    };

    const result = await resolveEnvironment(deckPath, sidecar, 'darwin');
    expect(result['COMMON_VAR']).to.equal('common_value');
  });

  // -------------------------------------------------------------------------
  // Sidecar platform layer
  // -------------------------------------------------------------------------

  it('includes platform-specific values for darwin', async () => {
    const deckPath = writeDeckFile();
    const sidecar: SidecarFile = {
      environment: {
        platform: { darwin: { PLATFORM_VAR: 'darwin_value' } },
      },
    };

    const result = await resolveEnvironment(deckPath, sidecar, 'darwin');
    expect(result['PLATFORM_VAR']).to.equal('darwin_value');
  });

  it('includes platform-specific values for linux', async () => {
    const deckPath = writeDeckFile();
    const sidecar: SidecarFile = {
      environment: {
        platform: { linux: { PLATFORM_VAR: 'linux_value' } },
      },
    };

    const result = await resolveEnvironment(deckPath, sidecar, 'linux');
    expect(result['PLATFORM_VAR']).to.equal('linux_value');
  });

  it('includes platform-specific values for win32', async () => {
    const deckPath = writeDeckFile();
    const sidecar: SidecarFile = {
      environment: {
        platform: { win32: { PLATFORM_VAR: 'win32_value' } },
      },
    };

    const result = await resolveEnvironment(deckPath, sidecar, 'win32');
    expect(result['PLATFORM_VAR']).to.equal('win32_value');
  });

  it('skips platform layer when platform is not darwin/linux/win32', async () => {
    const deckPath = writeDeckFile();
    const sidecar: SidecarFile = {
      environment: {
        platform: { darwin: { PLATFORM_VAR: 'darwin_value' } },
      },
    };

    // freebsd has no entry in the sidecar platform map
    const result = await resolveEnvironment(deckPath, sidecar, 'freebsd');
    expect(result['PLATFORM_VAR']).to.be.undefined;
  });

  it('does not include other-platform values when a different platform is requested', async () => {
    const deckPath = writeDeckFile();
    const sidecar: SidecarFile = {
      environment: {
        platform: {
          darwin: { MY_VAR: 'darwin_val' },
          linux: { MY_VAR: 'linux_val' },
        },
      },
    };

    const result = await resolveEnvironment(deckPath, sidecar, 'linux');
    expect(result['MY_VAR']).to.equal('linux_val');
  });

  // -------------------------------------------------------------------------
  // Precedence chain
  // -------------------------------------------------------------------------

  it('.deck.env overrides sidecar platform value', async () => {
    const deckPath = writeDeckFile();
    writeDeckEnv(deckPath, 'SHARED=from_env_file\n');
    const sidecar: SidecarFile = {
      environment: {
        platform: { darwin: { SHARED: 'from_platform' } },
      },
    };

    const result = await resolveEnvironment(deckPath, sidecar, 'darwin');
    expect(result['SHARED']).to.equal('from_env_file');
  });

  it('.deck.env overrides sidecar common value', async () => {
    const deckPath = writeDeckFile();
    writeDeckEnv(deckPath, 'SHARED=from_env_file\n');
    const sidecar: SidecarFile = {
      environment: {
        common: { SHARED: 'from_common' },
      },
    };

    const result = await resolveEnvironment(deckPath, sidecar, 'darwin');
    expect(result['SHARED']).to.equal('from_env_file');
  });

  it('sidecar platform overrides sidecar common for the same key', async () => {
    const deckPath = writeDeckFile();
    const sidecar: SidecarFile = {
      environment: {
        common: { SHARED: 'from_common' },
        platform: { darwin: { SHARED: 'from_platform' } },
      },
    };

    const result = await resolveEnvironment(deckPath, sidecar, 'darwin');
    expect(result['SHARED']).to.equal('from_platform');
  });

  it('full precedence chain: env_file > platform > common > process.env', async () => {
    const deckPath = writeDeckFile();
    // .deck.env only overrides KEY_A
    writeDeckEnv(deckPath, 'KEY_A=env_file\n');

    const sidecar: SidecarFile = {
      environment: {
        common: {
          KEY_A: 'common',
          KEY_B: 'common',
          KEY_C: 'common',
        },
        platform: {
          darwin: {
            KEY_A: 'platform',
            KEY_B: 'platform',
          },
        },
      },
    };

    const result = await resolveEnvironment(deckPath, sidecar, 'darwin');
    // .deck.env wins for KEY_A
    expect(result['KEY_A']).to.equal('env_file');
    // platform wins for KEY_B (no .deck.env entry)
    expect(result['KEY_B']).to.equal('platform');
    // common wins for KEY_C (no platform or .deck.env entry)
    expect(result['KEY_C']).to.equal('common');
  });

  // -------------------------------------------------------------------------
  // No .deck.env file
  // -------------------------------------------------------------------------

  it('works correctly when .deck.env does not exist', async () => {
    const deckPath = writeDeckFile();
    // No .deck.env written
    const sidecar: SidecarFile = {
      environment: {
        common: { ONLY_COMMON: 'yes' },
      },
    };

    const result = await resolveEnvironment(deckPath, sidecar, 'darwin');
    expect(result['ONLY_COMMON']).to.equal('yes');
  });

  // -------------------------------------------------------------------------
  // Default platform parameter
  // -------------------------------------------------------------------------

  it('uses process.platform as the default when platform is not supplied', async () => {
    const deckPath = writeDeckFile();
    const currentPlatform = process.platform as 'darwin' | 'linux' | 'win32';
    const sidecar: SidecarFile = {
      environment: {
        platform: {
          [currentPlatform]: { INJECTED: 'yes' },
        },
      },
    };

    // Call without explicit platform — should pick up the current platform
    const result = await resolveEnvironment(deckPath, sidecar);
    expect(result['INJECTED']).to.equal('yes');
  });

  // -------------------------------------------------------------------------
  // Additional edge cases (DA-25)
  // -------------------------------------------------------------------------

  it('includes all multiple common vars in the result', async () => {
    const deckPath = writeDeckFile();
    const sidecar: SidecarFile = {
      environment: {
        common: {
          ALPHA: 'alpha_val',
          BETA: 'beta_val',
          GAMMA: 'gamma_val',
        },
      },
    };

    const result = await resolveEnvironment(deckPath, sidecar, 'darwin');
    expect(result['ALPHA']).to.equal('alpha_val');
    expect(result['BETA']).to.equal('beta_val');
    expect(result['GAMMA']).to.equal('gamma_val');
  });

  it('sidecar common overrides a process.env value for the same key', async () => {
    const deckPath = writeDeckFile();
    const testKey = 'DA25_COMMON_OVERRIDE_TEST';
    process.env[testKey] = 'from_process_env';
    try {
      const sidecar: SidecarFile = {
        environment: {
          common: { [testKey]: 'from_common' },
        },
      };

      const result = await resolveEnvironment(deckPath, sidecar, 'darwin');
      expect(result[testKey]).to.equal('from_common');
    } finally {
      delete process.env[testKey];
    }
  });

  it('darwin platform vars are absent when win32 platform is requested', async () => {
    const deckPath = writeDeckFile();
    const sidecar: SidecarFile = {
      environment: {
        platform: {
          darwin: { DARWIN_ONLY: 'darwin_val' },
        },
      },
    };

    const result = await resolveEnvironment(deckPath, sidecar, 'win32');
    expect(result['DARWIN_ONLY']).to.be.undefined;
  });

  it('win32 platform vars are absent when darwin platform is requested', async () => {
    const deckPath = writeDeckFile();
    const sidecar: SidecarFile = {
      environment: {
        platform: {
          win32: { WIN32_ONLY: 'win32_val' },
        },
      },
    };

    const result = await resolveEnvironment(deckPath, sidecar, 'darwin');
    expect(result['WIN32_ONLY']).to.be.undefined;
  });

  it('empty common object adds no new keys to the result', async () => {
    const deckPath = writeDeckFile();
    const sidecar: SidecarFile = {
      environment: {
        common: {},
      },
    };

    const withoutSidecar = await resolveEnvironment(deckPath, null, 'darwin');
    const withEmptyCommon = await resolveEnvironment(deckPath, sidecar, 'darwin');

    // The keyset should be identical
    expect(Object.keys(withEmptyCommon).sort()).to.deep.equal(Object.keys(withoutSidecar).sort());
  });

  it('environment.platform present but current platform entry is empty — no extra keys added', async () => {
    const deckPath = writeDeckFile();
    const sidecar: SidecarFile = {
      environment: {
        platform: {
          darwin: {},
        },
      },
    };

    const withoutSidecar = await resolveEnvironment(deckPath, null, 'darwin');
    const withEmptyPlatform = await resolveEnvironment(deckPath, sidecar, 'darwin');

    expect(Object.keys(withEmptyPlatform).sort()).to.deep.equal(Object.keys(withoutSidecar).sort());
  });
});
