/**
 * Renders block-sourced interactive elements as clickable action link HTML.
 *
 * Inline action links (`[label](action:...)`) are already present in `slide.html`
 * because markdown-it renders them as `<a>` tags. Block elements (from ` ```action `
 * fenced code blocks) are stripped during parsing and need to be injected as HTML
 * wherever slide content is sent to the webview.
 */

import { Slide, InteractiveElement } from '../models/slide';

/**
 * Escape HTML special characters in content strings.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Derive the preview string for showCommand: true.
 * Returns the most meaningful param value for the action type, or null if nothing useful.
 */
function getCommandPreview(type: string, params: Record<string, unknown>): string | null {
  switch (type) {
    case 'terminal.run':
    case 'validate.command': {
      const cmd = params.command;
      if (typeof cmd === 'string') { return cmd; }
      if (cmd && typeof cmd === 'object') {
        // Cross-platform map — show the 'default' key or first available value
        const map = cmd as Record<string, string>;
        return map.default ?? Object.values(map)[0] ?? null;
      }
      return null;
    }
    case 'file.open':
    case 'validate.fileExists':
      return typeof params.path === 'string' ? params.path : null;
    case 'editor.highlight':
      return typeof params.path === 'string'
        ? `${params.path}${typeof params.lines === 'string' ? ` :${params.lines}` : ''}`
        : null;
    case 'debug.start':
      return typeof params.configName === 'string' ? params.configName : null;
    case 'vscode.command':
      return typeof params.id === 'string' ? params.id : null;
    default:
      return null;
  }
}

/**
 * Generate HTML for block-sourced interactive elements on a slide.
 * Returns an empty string if the slide has no block elements.
 * 
 * @deprecated Use {@link injectBlockElements} instead which places buttons
 * at the correct position using placeholders.
 */
export function renderBlockElements(slide: Slide): string {
  const blockElements = slide.interactiveElements.filter(el => el.source === 'block');
  if (blockElements.length === 0) {
    return '';
  }

  const links = blockElements.map(el => {
    const type = el.action.type;
    const params = el.action.params ?? {};
    const simpleParams = Object.entries(params)
      .filter(([, v]) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    const href = simpleParams ? `action:${type}?${simpleParams}` : `action:${type}`;
    const escapedLabel = escapeHtml(el.label);
    return `<p><a href="${href}" data-action-id="${el.action.id}">${escapedLabel}</a></p>`;
  });

  return '\n' + links.join('\n');
}

/**
 * Build the button HTML for a single interactive element.
 * Handles showCommand preview and fragment/no-fragment wrapping.
 */
function buildButtonHtml(el: InteractiveElement): string {
  const type = el.action.type;
  const params = el.action.params ?? {};
  const simpleParams = Object.entries(params)
    .filter(([, v]) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  const href = simpleParams ? `action:${type}?${simpleParams}` : `action:${type}`;
  const escapedLabel = escapeHtml(el.label);
  const noFrag = el.fragment === false ? ' data-no-fragment' : '';

  let preview = '';
  if (el.showCommand) {
    const previewText = getCommandPreview(type, params as Record<string, unknown>);
    if (previewText) {
      preview = `<code class="action-preview">${escapeHtml(previewText)}</code>`;
    }
  }

  return `<p${noFrag}><a href="${href}" data-action-id="${el.action.id}">${escapedLabel}</a>${preview}</p>`;
}

/**
 * Replace `<!--ACTION:id-->` placeholders in slide HTML with rendered
 * action-button links, so buttons appear at their original position in
 * the slide content rather than being appended at the end.
 *
 * If a placeholder has no matching element (e.g. parse error), it is
 * removed from the HTML silently.
 */
export function injectBlockElements(html: string, slide: Slide): string {
  const blockElements = slide.interactiveElements.filter(el => el.source === 'block');
  // Build a map from element ID → button HTML
  const buttonMap = new Map<string, string>();
  for (const el of blockElements) {
    buttonMap.set(el.id, buildButtonHtml(el));
  }

  // Replace each placeholder; remove unmatched ones (from errored blocks)
  return html.replace(
    /<!--ACTION:(block-\d+-\d+)-->/g,
    (_match, id: string) => buttonMap.get(id) ?? '',
  );
}

/**
 * Lightweight variant of {@link injectBlockElements} that accepts an array
 * of parsed elements directly, so the slide parser can call it before
 * fragment processing (no Slide object needed yet).
 */
export function injectBlockElementsFromParsed(html: string, elements: InteractiveElement[]): string {
  const blockElements = elements.filter(el => el.source === 'block');
  if (blockElements.length === 0) {
    return html;
  }
  const buttonMap = new Map<string, string>();
  for (const el of blockElements) {
    buttonMap.set(el.id, buildButtonHtml(el));
  }
  return html.replace(
    /<!--ACTION:(block-\d+-\d+)-->/g,
    (_match, id: string) => buttonMap.get(id) ?? '',
  );
}
