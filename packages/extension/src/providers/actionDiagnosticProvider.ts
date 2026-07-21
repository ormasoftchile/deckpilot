/**
 * ActionDiagnosticProvider — re-export shim.
 *
 * The implementation now lives in the framework-neutral `@deckpilot/language`
 * package so the VS Code extension, the web editor, and a future LSP all share
 * ONE engine. This file preserves the historical import path
 * (`providers/actionDiagnosticProvider`) that the extension and unit tests
 * consume. No behavior changes — the class is identical.
 *
 * The host-only env EXISTENCE checker (fs/PATH backed) stays in the extension
 * (`../validation/envRuleValidator`) and is injected by `extension.ts`; the
 * package only depends on the pure `EnvExistenceChecker` interface.
 */

export {
  ActionDiagnosticProvider,
  getDiagnostics,
  DiagnosticSeverity,
} from '@deckpilot/language';
export type { DiagnosticResult } from '@deckpilot/language';

