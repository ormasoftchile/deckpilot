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

import { ActionType, createAction } from '../models/action';
import type { InteractiveElement } from '../models/slide';
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
  'browser.open',
  'browser.navigate',
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
 * Derive a human-readable button label from a SidecarAction.
 * If the YAML entry has an explicit `label` field, that wins.
 */
function deriveLabel(sidecar: SidecarAction): string {
  if (sidecar.label) return String(sidecar.label);
  switch (sidecar.type) {
    case 'terminal.run':   return sidecar.cmd  ? `Run: ${sidecar.cmd}`                          : 'Run command';
    case 'file.open':      return sidecar.file ? `Open: ${String(sidecar.file).split('/').pop()}` : 'Open file';
    case 'editor.highlight': return sidecar.file ? `Highlight: ${String(sidecar.file).split('/').pop()}` : 'Highlight';
    case 'debug.start':    return (sidecar.configName as string | undefined) ? `Debug: ${sidecar.configName}` : 'Start debug';
    case 'browser.open':   return (sidecar.url as string | undefined) ? `Open: ${sidecar.url}` : 'Open browser';
    case 'browser.navigate': return (sidecar.url as string | undefined) ? `Navigate: ${sidecar.url}` : 'Navigate';
    default:               return sidecar.type;
  }
}

/**
 * Map an array of SidecarAction entries to InteractiveElement objects.
 *
 * Each element gets source='sidecar' so the renderer appends it after slide
 * content rather than trying to replace an inline placeholder.
 * fragment=true so the button appears as the LAST reveal step, after any
 * explanatory text and code blocks that precede it.
 */
export function mapSidecarActionsToInteractiveElements(
  sidecarActions: SidecarAction[],
  slideIndex: number,
): InteractiveElement[] {
  const result: InteractiveElement[] = [];

  for (const sidecar of sidecarActions) {
    if (!KNOWN_ACTION_TYPES.has(sidecar.type)) {
      console.warn(
        `[deckpilot] sidecarActionMapper: unknown action type "${sidecar.type}" ` +
        `on slide ${slideIndex} — skipped`,
      );
      continue;
    }

    const params = buildParams(sidecar);
    const action = createAction(sidecar.type as ActionType, params, slideIndex);
    const label = deriveLabel(sidecar);
    const simpleParams = Object.entries(params)
      .filter(([, v]) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    const href = simpleParams ? `action:${sidecar.type}?${simpleParams}` : `action:${sidecar.type}`;

    result.push({
      id: action.id,
      label,
      action,
      position: { line: 9999, column: 0 },
      rawLink: `[${label}](${href})`,
      source: 'sidecar',
      fragment: true,
    });
  }

  return result;
}
