/**
 * Deck-level validation helpers.
 *
 * These functions operate on fully-parsed Slide arrays and return plain
 * diagnostic objects (not vscode.Diagnostic) so they can run outside the
 * VS Code host process.  Extension.ts is responsible for lifting
 * SlideDiagnosticResult → vscode.Diagnostic when surfacing to the editor.
 */

import * as yaml from 'js-yaml';
import { Slide } from '../models/slide';
import { SidecarFile } from '../models/sidecar';

/**
 * Diagnostic severity values that mirror vscode.DiagnosticSeverity without
 * importing the VS Code module.
 */
export const enum SlideDiagnosticSeverity {
  Error = 0,
  Warning = 1,
  Information = 2,
  Hint = 3,
}

/**
 * A diagnostic produced by deck-level validation.
 * Shape is intentionally compatible with DiagnosticResult in
 * actionDiagnosticProvider so both can be mapped to vscode.Diagnostic
 * using the same converter in extension.ts.
 */
export interface SlideDiagnosticResult {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  message: string;
  severity: SlideDiagnosticSeverity;
  source: string;
}

const SOURCE = 'Deckpilot';

/**
 * Validate that no two slides share the same explicitly-declared ID.
 *
 * "Explicitly declared" means the author wrote an `<!-- id: xxx -->` comment
 * or a frontmatter `id: xxx` field.  IDs derived from heading slugs or
 * assigned as positional fallbacks (`slide-N`) are considered auto-generated
 * and are handled silently by `resolveUniqueIds`.
 *
 * A collision is flagged when two slides share the same `id` and at least one
 * of them has `idExplicit === true`.
 *
 * **Call this before `resolveUniqueIds`** — uniquification renames the second
 * occurrence in place, so duplicates are no longer detectable afterwards.
 *
 * Range note: `Slide` currently carries no source-position information
 * (lineStart / lineEnd).  All diagnostics are therefore anchored to line 0
 * of the document.  Precise ranges will be added once position tracking lands
 * on the Slide model (tracked as a future improvement).
 *
 * @param slides - Array of slides with `id` and `idExplicit` already populated.
 * @returns Array of Error-severity diagnostics, one per duplicate explicit ID.
 */
export function validateSlideIds(slides: Slide[]): SlideDiagnosticResult[] {
  const diagnostics: SlideDiagnosticResult[] = [];

  // Track: id string → { first slide index, was explicit }
  const seen = new Map<string, { slideIndex: number; idExplicit: boolean }>();

  for (const slide of slides) {
    if (!slide.id) {
      continue;
    }

    const existing = seen.get(slide.id);
    if (existing !== undefined) {
      // Flag the collision if at least one side was explicitly declared.
      if (existing.idExplicit || slide.idExplicit) {
        diagnostics.push({
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 0 },
          },
          message: `Duplicate slide id '${slide.id}' — slide IDs must be unique`,
          severity: SlideDiagnosticSeverity.Error,
          source: SOURCE,
        });
      }
    } else {
      seen.set(slide.id, {
        slideIndex: slide.index,
        idExplicit: slide.idExplicit ?? false,
      });
    }
  }

  return diagnostics;
}

// ---------------------------------------------------------------------------
// Sidecar YAML validation (DA-12)
// ---------------------------------------------------------------------------

const KNOWN_SIDECAR_KEYS = new Set(['deck', 'slides', 'recording', 'export']);

/**
 * Extract the 0-based line number from a js-yaml YAMLException, if available.
 */
function yamlErrorLine(err: unknown): number {
  if (err && typeof err === 'object') {
    const mark = (err as { mark?: { line?: number } }).mark;
    if (mark && typeof mark.line === 'number') {
      return mark.line;
    }
  }
  return 0;
}

/**
 * Validate slide entries in an already-parsed SidecarFile.
 *
 * Checks that each entry in `slides[]` has a non-empty string `id` field.
 * Returns one Error-severity diagnostic per missing or blank id.
 */
function validateSidecarSlideIdPresence(sidecar: SidecarFile): SlideDiagnosticResult[] {
  const diagnostics: SlideDiagnosticResult[] = [];
  if (!sidecar.slides) {
    return diagnostics;
  }
  sidecar.slides.forEach((slide, index) => {
    if (!slide.id || typeof slide.id !== 'string' || slide.id.trim() === '') {
      diagnostics.push({
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 0 },
        },
        message: `slides[${index}] is missing a required 'id' field`,
        severity: SlideDiagnosticSeverity.Error,
        source: SOURCE,
      });
    }
  });
  return diagnostics;
}

/**
 * Validate a raw .deck.yaml string and return editor diagnostics.
 *
 * Runs three checks in order, short-circuiting when the YAML is unreadable:
 * 1. YAML syntax — any parse error → Error severity with the offending line number.
 * 2. Unknown top-level keys — keys outside the expected schema → Warning severity
 *    (permissive: unknown fields are flagged but do not prevent loading).
 * 3. Slide id completeness — each entry in `slides[]` must have a non-empty `id`
 *    string → Error severity.
 *
 * All diagnostics use `SlideDiagnosticResult` (not `vscode.Diagnostic`) so this
 * function can run outside the VS Code extension host.  Extension.ts lifts the
 * results to `vscode.Diagnostic` before attaching them to a DiagnosticCollection.
 *
 * @param sidecarContent  Raw YAML text of the .deck.yaml file.
 * @returns               Array of diagnostics; empty means the file is valid.
 */
export function validateSidecarSchema(sidecarContent: string): SlideDiagnosticResult[] {
  const diagnostics: SlideDiagnosticResult[] = [];

  let parsed: unknown;
  try {
    parsed = yaml.load(sidecarContent);
  } catch (err) {
    const line = yamlErrorLine(err);
    const message = err instanceof Error ? err.message : String(err);
    diagnostics.push({
      range: {
        start: { line, character: 0 },
        end: { line, character: 0 },
      },
      message: `YAML parse error: ${message}`,
      severity: SlideDiagnosticSeverity.Error,
      source: SOURCE,
    });
    return diagnostics;
  }

  // Empty file is valid.
  if (parsed === null || parsed === undefined) {
    return diagnostics;
  }

  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    diagnostics.push({
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
      },
      message: 'Sidecar file must be a YAML mapping at the top level, not a scalar or sequence',
      severity: SlideDiagnosticSeverity.Error,
      source: SOURCE,
    });
    return diagnostics;
  }

  // Unknown top-level keys → Warning (permissive schema).
  for (const key of Object.keys(parsed as object)) {
    if (!KNOWN_SIDECAR_KEYS.has(key)) {
      diagnostics.push({
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 0 },
        },
        message: `Unknown top-level key '${key}' — expected one of: deck, slides, recording, export`,
        severity: SlideDiagnosticSeverity.Warning,
        source: SOURCE,
      });
    }
  }

  // Slide id completeness.
  const sidecar = parsed as SidecarFile;
  diagnostics.push(...validateSidecarSlideIdPresence(sidecar));

  return diagnostics;
}

/**
 * Validate that every slide ID referenced in a sidecar file exists in the
 * parsed slide array.
 *
 * Unresolved sidecar entries are non-fatal — the deck still loads and runs.
 * The sidecar entry is simply ignored at merge time.  A Warning (not Error)
 * is appropriate so authors are notified of the mismatch without blocking
 * the presentation.
 *
 * Range note: Sidecar entries carry no line-position information today, so
 * all diagnostics are anchored to line 0 of the document.
 *
 * @param slides  - Parsed slides, each carrying an `id` field.
 * @param sidecar - Parsed sidecar object returned by `loadSidecar()`.
 * @returns Array of Warning-severity diagnostics, one per unknown slide ID.
 */
export function validateSidecarSlideIds(
  slides: Slide[],
  sidecar: SidecarFile,
): SlideDiagnosticResult[] {
  if (!sidecar || !sidecar.slides || sidecar.slides.length === 0) {
    return [];
  }

  const knownIds = new Set<string>(
    slides.map(s => s.id).filter((id): id is string => id !== undefined),
  );

  return sidecar.slides
    .filter(entry => !knownIds.has(entry.id))
    .map(entry => ({
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
      },
      message: `Sidecar references unknown slide id '${entry.id}' — no matching slide found in deck`,
      severity: SlideDiagnosticSeverity.Warning,
      source: SOURCE,
    }));
}
