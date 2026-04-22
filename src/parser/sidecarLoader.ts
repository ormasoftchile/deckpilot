/**
 * SidecarLoader — discovery utilities for .deck.yaml sidecar files.
 *
 * DA-03: resolves and checks sidecar path existence.
 * DA-04 (future): parses the YAML content into a typed sidecar object.
 *
 * Naming convention mirrors .deck.env sibling:
 *   demo.deck.md → demo.deck.yaml
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Resolve the expected sidecar path for a given .deck.md file.
 *
 * @param deckMdPath Absolute path to a .deck.md file
 * @returns Corresponding .deck.yaml path in the same directory
 * @throws Error if the path does not end with `.deck.md`
 *
 * @example
 * resolveSidecarPath('/projects/demo.deck.md')
 * // → '/projects/demo.deck.yaml'
 */
export function resolveSidecarPath(deckMdPath: string): string {
  if (!deckMdPath.endsWith('.deck.md')) {
    throw new Error(
      `resolveSidecarPath: expected a .deck.md file path, got '${path.basename(deckMdPath)}'`
    );
  }
  return deckMdPath.replace(/\.deck\.md$/, '.deck.yaml');
}

/**
 * Check whether the sidecar .deck.yaml file exists on disk.
 *
 * @param deckMdPath Absolute path to the .deck.md file
 * @returns true if the companion .deck.yaml file exists, false otherwise
 * @throws Error if the path does not end with `.deck.md`
 */
export async function sidecarExists(deckMdPath: string): Promise<boolean> {
  const sidecarPath = resolveSidecarPath(deckMdPath);
  try {
    await fs.promises.access(sidecarPath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
