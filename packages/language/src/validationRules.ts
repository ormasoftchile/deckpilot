/**
 * Pure validation-rule NAME checks.
 *
 * This replaces the extension `EnvRuleValidator.isValidRule` usage inside the
 * diagnostic provider. It is a pure function backed by the single source of
 * truth for rule names, `VALIDATION_RULES` in `@deckpilot/core`.
 *
 * Behavior is identical to the original `EnvRuleValidator.isValidRule`:
 *   - exact match against `directory`, `file`, `command`, `url`, `port`
 *   - prefix match for `regex:` (e.g. `regex:^v\d+`)
 *
 * The prefix rules are distinguished from exact rules by a trailing `:` in
 * their `VALIDATION_RULES` name (only `regex:` currently), so this stays in
 * sync automatically if core adds more prefix-style rules.
 */
import { VALIDATION_RULES } from '@deckpilot/core/models/actionSchema';

/**
 * Return true if `rule` is a recognized env validation rule.
 */
export function isValidRule(rule: string): boolean {
  for (const { name } of VALIDATION_RULES) {
    if (name.endsWith(':')) {
      if (rule.startsWith(name)) {
        return true;
      }
    } else if (rule === name) {
      return true;
    }
  }
  return false;
}
