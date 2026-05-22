/**
 * SidecarLoader — discovery and parsing utilities for .deck.yaml sidecar files.
 *
 * DA-03: resolves and checks sidecar path existence.
 * DA-04: parses the YAML content into a typed SidecarFile object.
 *
 * Naming convention mirrors .deck.env sibling:
 *   demo.deck.md → demo.deck.yaml
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import type { SidecarFile } from '../models/sidecar';

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

/**
 * Load and parse a .deck.yaml sidecar file into a typed SidecarFile object.
 *
 * Returns `null` if no sidecar file exists alongside the given .deck.md path —
 * this is normal; absence of a sidecar is not an error.
 *
 * Returns `null` if the YAML cannot be parsed (syntax error) or if the top-level
 * structure is not a mapping.  Callers that need structured editor diagnostics
 * should invoke `validateSidecarSchema` from `deckValidator.ts` with the raw
 * file content separately.
 *
 * @param deckMdPath Absolute path to the .deck.md file
 * @returns Parsed SidecarFile, or null if no sidecar exists or cannot be parsed
 */
export async function loadSidecar(deckMdPath: string): Promise<SidecarFile | null> {
  if (!(await sidecarExists(deckMdPath))) {
    return null;
  }

  const sidecarPath = resolveSidecarPath(deckMdPath);
  const raw = await fs.promises.readFile(sidecarPath, 'utf-8');

  let parsed: unknown;
  try {
    parsed = yaml.load(raw);
  } catch {
    // YAML syntax error — return null; callers use validateSidecarSchema for diagnostics.
    return null;
  }

  if (parsed === null || parsed === undefined) {
    return {};
  }

  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    // Top-level is not a mapping — unrecoverable, return null.
    return null;
  }

  return parsed as SidecarFile;
}

