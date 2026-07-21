/**
 * EnvExistenceChecker — the host-injected seam for validating env values
 * against on-disk / environment EXISTENCE rules (directory/file present,
 * command on PATH, etc.).
 *
 * The language package is framework-neutral and MUST NOT touch `fs`,
 * `child_process`, or any host API. Any check that requires the real
 * environment is delegated to an implementation supplied by the host:
 *   - VS Code extension → backed by the host `EnvRuleValidator` (real fs/PATH).
 *   - Browser editor      → omitted (no-op); existence checks are skipped.
 *
 * The signature intentionally matches `@deckpilot/core`'s `EnvRuleValidatorLike`
 * so the existing extension `EnvRuleValidator` satisfies it without changes.
 *
 * NOTE (Phase 1): the current authoring diagnostics validate rule *names*
 * (see `isValidRule`) but do NOT perform on-disk existence checks. This
 * interface is therefore a reserved seam wired through today so a future LSP /
 * in-editor preflight can plug real existence validation in without touching
 * the framework-neutral core. See the Phase-1 decision note.
 */
import type {
  EnvValidationContext,
  EnvValidationResult,
} from '@deckpilot/core/models/env';

export interface EnvExistenceChecker {
  /**
   * Validate a resolved value against an existence-based rule.
   * Mirrors `EnvRuleValidatorLike.validateValue` from `@deckpilot/core`.
   */
  validateValue(
    value: string,
    rule: string,
    context: EnvValidationContext,
  ): Promise<EnvValidationResult>;
}
