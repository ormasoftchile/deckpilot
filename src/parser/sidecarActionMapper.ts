/**
 * Sidecar action mapper — converts SidecarAction[] to Action[].
 *
 * DA-07: Map sidecar-sourced actions into the ActionRegistry format so they
 * are indistinguishable from inline actions at runtime.
 *
 * Field-name conventions differ between the sidecar YAML model and the
 * canonical Action params model:
 *   terminal.run  : SidecarAction.cmd  → TerminalRunParams.command
 *   file.open     : SidecarAction.file → FileOpenParams.path
 *   editor.highlight: SidecarAction.file → EditorHighlightParams.path
 *   debug.start   : all fields pass through (configName already matches)
 *
 * Unknown action types are skipped with a console.warn — never thrown.
 * Trust enforcement (terminal.run, debug.start) is handled by the existing
 * execution pipeline at dispatch time; no special casing is needed here.
 */

import { Action, ActionType, createAction } from '../models/action';
import type { SidecarAction } from '../models/sidecar';

/**
 * All action types recognised by the registry.
 * Used to gate unknown-type filtering without importing the full registry.
 */
const KNOWN_ACTION_TYPES: ReadonlySet<string> = new Set<ActionType>([
  'file.open',
  'editor.highlight',
  'terminal.run',
  'debug.start',
  'sequence',
  'vscode.command',
  'wait.condition',
  'validate.command',
  'validate.fileExists',
  'validate.port',
]);

/**
 * Translate SidecarAction fields to the canonical params shape for its type.
 *
 * The `type` field is excluded from params (it drives dispatch, not execution).
 * `cmd` and `file` are consumed and renamed where the spec requires it;
 * all remaining index-signature fields pass through unchanged.
 */
function buildParams(sidecar: SidecarAction): Record<string, unknown> {
  // Pull out the sidecar-specific named fields so they don't land in params verbatim.
  const { type: _type, cmd, file, ...rest } = sidecar;
  const params: Record<string, unknown> = { ...rest };

  switch (sidecar.type) {
    case 'terminal.run':
      // cmd → command (TerminalRunParams.command)
      if (cmd !== undefined) {
        params.command = cmd;
      }
      break;

    case 'file.open':
    case 'editor.highlight':
      // file → path (FileOpenParams / EditorHighlightParams)
      // Only set if a more-specific `path` field wasn't already present.
      if (file !== undefined && params.path === undefined) {
        params.path = file;
      }
      break;

    default:
      // For all other recognised types, preserve cmd/file as-is if present.
      if (cmd !== undefined) { params.cmd = cmd; }
      if (file !== undefined) { params.file = file; }
      break;
  }

  return params;
}

/**
 * Map an array of SidecarAction entries to fully initialised Action objects.
 *
 * - Entries with a recognised type are mapped to the canonical params shape.
 * - Entries with an unknown type are skipped; a console.warn is emitted.
 * - Returns a new array; the input is not mutated.
 */
export function mapSidecarActions(
  sidecarActions: SidecarAction[],
  slideIndex: number,
): Action[] {
  const result: Action[] = [];

  for (const sidecar of sidecarActions) {
    if (!KNOWN_ACTION_TYPES.has(sidecar.type)) {
      console.warn(
        `[deckpilot] sidecarActionMapper: unknown action type "${sidecar.type}" ` +
        `on slide ${slideIndex} — skipped`,
      );
      continue;
    }

    const params = buildParams(sidecar);
    result.push(createAction(sidecar.type as ActionType, params, slideIndex));
  }

  return result;
}
