/**
 * Display-only renderer for Deckpilot actions in the public viewer.
 *
 * The viewer is read-only and never executes actions. Inline action links
 * (`[Label](action:type?params)`) and action block buttons are rewritten into
 * disabled `<button>` elements with metadata tooltips and a "requires VS Code"
 * informational badge.
 *
 * This is a string-level transform applied BEFORE sanitization, so the rewritten
 * markup uses only attributes whitelisted by sanitize.ts.
 */

const ACTION_LABEL: Record<string, string> = {
  'file.open': 'Open file',
  'editor.highlight': 'Highlight code',
  'terminal.run': 'Run command',
  'debug.start': 'Start debugging',
  'vscode.command': 'VS Code command',
  'sequence': 'Run sequence',
  'wait.condition': 'Wait for condition',
  'browser.open': 'Open browser',
  'browser.navigate': 'Navigate browser',
  'validate.command': 'Validate command',
  'validate.fileExists': 'Validate file exists',
  'validate.port': 'Validate port',
};

const ACTION_HREF_RE = /<a\s+([^>]*?)href=("|')action:([^"'<>]+)\2([^>]*)>([\s\S]*?)<\/a>/gi;

interface ParsedAction {
  type: string;
  summary: string;
}

function parseAction(actionUri: string): ParsedAction {
  // Format: type?key=value&key2=value2
  const [type, query = ''] = actionUri.split('?', 2);
  const params: Record<string, string> = {};
  if (query) {
    for (const part of query.split('&')) {
      const [k, v = ''] = part.split('=', 2);
      try {
        params[decodeURIComponent(k)] = decodeURIComponent(v);
      } catch {
        params[k] = v;
      }
    }
  }
  let summary = '';
  if (params.path) summary = params.path;
  else if (params.command) summary = params.command;
  else if (params.id) summary = params.id;
  else if (params.url) summary = params.url;
  else if (params.configName) summary = params.configName;
  return { type, summary };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Rewrite inline action anchors into disabled, informational buttons.
 * Idempotent — safe to call on already-transformed HTML (no-op for non-action anchors).
 */
export function rewriteActionLinks(html: string): string {
  return html.replace(ACTION_HREF_RE, (_full, _pre, _q, actionUri: string, _post, label: string) => {
    const { type, summary } = parseAction(actionUri);
    const friendly = ACTION_LABEL[type] ?? type;
    const tooltip = `${friendly}${summary ? ` — ${summary}` : ''}\nThis action requires Deckpilot in VS Code.`;
    return [
      `<button type="button" class="dp-action" data-action-type="${escapeHtml(type)}"`,
      ` data-action-raw="${escapeHtml(actionUri)}" title="${escapeHtml(tooltip)}" disabled>`,
      `<span class="dp-action-icon" aria-hidden="true">▶</span>`,
      `<span class="dp-action-label">${label}</span>`,
      `<span class="dp-action-type">${escapeHtml(friendly)}</span>`,
      `</button>`,
    ].join('');
  });
}
