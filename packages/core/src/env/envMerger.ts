/**
 * envMerger — sidecar environment override resolution.
 *
 * DA-22: Merges process environment, sidecar common overrides,
 * sidecar platform-specific overrides, and .deck.env file values
 * into a single flat Record for use during deck execution.
 *
 * Precedence (lowest → highest):
 *   1. process.env          — system/process environment
 *   2. sidecar common       — environment.common
 *   3. sidecar platform     — environment.platform.{platform}
 *   4. .deck.env file       — explicit user-provided values
 */

import { EnvFileLoader } from './envFileLoader';
import type { SidecarFile } from '../models/sidecar';

type KnownPlatform = 'darwin' | 'linux' | 'win32';

/**
 * Resolve the merged execution environment for a deck.
 *
 * @param deckPath - Absolute path to the .deck.md file (used to locate .deck.env)
 * @param sidecar  - Parsed sidecar, or null when no .deck.yaml is present
 * @param platform - Target platform key (injectable; defaults to process.platform)
 */
export async function resolveEnvironment(
  deckPath: string,
  sidecar: SidecarFile | null,
  platform: NodeJS.Platform = process.platform,
): Promise<Record<string, string>> {
  // Layer 4 (base): system process environment — undefined values excluded
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }

  // Layer 3: sidecar common overrides
  if (sidecar?.environment?.common) {
    Object.assign(result, sidecar.environment.common);
  }

  // Layer 2: sidecar platform-specific overrides (darwin / linux / win32 only)
  const platformEnv = sidecar?.environment?.platform?.[platform as KnownPlatform];
  if (platformEnv) {
    Object.assign(result, platformEnv);
  }

  // Layer 1: .deck.env file (highest priority)
  const loader = new EnvFileLoader();
  const envFile = await loader.loadEnvFile(deckPath);
  if (envFile.exists) {
    for (const [key, value] of envFile.values) {
      result[key] = value;
    }
  }

  return result;
}
