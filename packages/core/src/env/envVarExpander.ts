/**
 * EnvVarExpander — expands OS environment variables in .deck.env values.
 *
 * Supports two syntaxes:
 * - PowerShell: $env:VARNAME → resolves to process.env.VARNAME
 * - Command syntax: %VARNAME% → resolves to process.env.VARNAME
 *
 * Unknown variables (not in process.env) are left as-is (not removed or errored).
 * This is called at .deck.env parse time, BEFORE {{VAR}} substitution.
 */

/**
 * Regular expression for PowerShell env var syntax: $env:VARNAME
 * Matches: $env:LOCALAPPDATA, $env:HOME, etc.
 * Does NOT match: $envFoo (no colon), ${env:X} (braces)
 */
const POWERSHELL_ENV_PATTERN = /\$env:([A-Za-z_][A-Za-z0-9_]*)/g;

/**
 * Regular expression for Command environment var syntax: %VARNAME%
 * Matches: %LOCALAPPDATA%, %HOME%, etc.
 * Does NOT match: %%, %%, or empty % %
 */
const CMD_ENV_PATTERN = /%([A-Za-z_][A-Za-z0-9_]*)%/g;

/**
 * Expands OS environment variable references in a string.
 * Returns expanded value if variables are resolved, or original if not found.
 *
 * @param value - The string value to expand (e.g., "$env:LOCALAPPDATA\\MyApp")
 * @returns Expanded string with OS env vars resolved
 *
 * @example
 * // On Windows with process.env.LOCALAPPDATA = "C:\\Users\\alice\\AppData\\Local"
 * expandEnvVars("$env:LOCALAPPDATA\\Microsoft\\SQL Server")
 * // → "C:\\Users\\alice\\AppData\\Local\\Microsoft\\SQL Server"
 *
 * @example
 * // Using cmd syntax
 * expandEnvVars("C:\\Users\\%USERNAME%\\Documents")
 * // → "C:\\Users\\alice\\Documents" (if process.env.USERNAME exists)
 *
 * @example
 * // Unknown variables left as-is
 * expandEnvVars("$env:NONEXISTENT_VAR")
 * // → "$env:NONEXISTENT_VAR" (unchanged)
 */
export function expandEnvVars(value: string): string {
  if (!value) {
    return value;
  }

  // Expand PowerShell $env:VARNAME syntax
  let expanded = value.replace(POWERSHELL_ENV_PATTERN, (match, varName: string) => {
    const osValue = process.env[varName];
    return osValue !== undefined ? osValue : match; // Keep original if undefined
  });

  // Expand Command %VARNAME% syntax
  expanded = expanded.replace(CMD_ENV_PATTERN, (match, varName: string) => {
    const osValue = process.env[varName];
    return osValue !== undefined ? osValue : match; // Keep original if undefined
  });

  return expanded;
}

/**
 * Expands all strings in a Map<string, string> using expandEnvVars.
 * Used to batch-expand all parsed .deck.env values.
 *
 * @param values - Map of environment variable names to values
 * @returns New Map with all values expanded
 */
export function expandEnvVarsInMap(values: Map<string, string>): Map<string, string> {
  const expanded = new Map<string, string>();
  for (const [key, value] of values) {
    expanded.set(key, expandEnvVars(value));
  }
  return expanded;
}
