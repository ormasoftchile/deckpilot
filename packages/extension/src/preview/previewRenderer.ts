/**
 * renderPreviewHtml — pure function that turns a parsed Deck into the HTML
 * shell for the live-preview webview.
 *
 * The view is a vertical scroll of every slide ("poster mode"). Action links
 * and render directives are rendered as inert visual cards — preview never
 * executes side-effects.
 */

import * as path from 'path';
import type * as vscode from 'vscode';
import type { Deck } from '@deckpilot/core/models/deck';
import type { Slide } from '@deckpilot/core/models/slide';
import { injectBlockElements } from '@deckpilot/core/renderer/blockElementRenderer';
import { parseRenderDirectives } from '@deckpilot/core/renderer/renderDirectiveParser';
import type { RenderDirective } from '@deckpilot/core/renderer/renderDirectiveParser';

export interface RenderPreviewOptions {
  webview: vscode.Webview;
  cspSource: string;
  nonce: string;
  cssUri: vscode.Uri;
  deckPath: string;
  warnings?: string[];
}

export function renderPreviewHtml(deck: Deck, opts: RenderPreviewOptions): string {
  const title = escapeHtml(deck.title ?? path.basename(opts.deckPath));
  const slideCount = deck.slides.length;
  const warningsHtml = renderWarnings(opts.warnings);
  const slidesHtml = deck.slides.map((slide) => renderSlide(slide)).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${opts.cspSource} 'unsafe-inline'; script-src 'nonce-${opts.nonce}'; img-src ${opts.cspSource} https: data:;">
  <link href="${opts.cssUri}" rel="stylesheet">
  <title>Preview: ${title}</title>
</head>
<body class="preview-body">
  <header class="preview-header">
    <span class="preview-title">${title}</span>
    <span class="preview-meta">${slideCount} slide${slideCount === 1 ? '' : 's'} &middot; live preview</span>
  </header>
  ${warningsHtml}
  <main class="preview-slides">
    ${slidesHtml}
  </main>
  <script nonce="${opts.nonce}">
    // Inert preview: swallow clicks on action links and render-directive cards.
    document.addEventListener('click', function (event) {
      var target = event.target;
      if (target && (target.closest && (target.closest('a[href^="action:"]') || target.closest('.preview-directive') || target.closest('a[href^="render:"]')))) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);
  </script>
</body>
</html>`;
}

export function renderPreviewError(message: string, opts: RenderPreviewOptions): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${opts.cspSource} 'unsafe-inline'; img-src ${opts.cspSource} https: data:;">
  <link href="${opts.cssUri}" rel="stylesheet">
  <title>Preview error</title>
</head>
<body class="preview-body">
  <header class="preview-header">
    <span class="preview-title">Preview unavailable</span>
  </header>
  <main class="preview-slides">
    <section class="preview-slide preview-slide--error">
      <p class="preview-error-message">${escapeHtml(message)}</p>
    </section>
  </main>
</body>
</html>`;
}

function renderSlide(slide: Slide): string {
  // injectBlockElements turns <!--ACTION:id--> placeholders into real button HTML.
  // The buttons render but clicks are swallowed by the body-level handler above.
  const withButtons = injectBlockElements(slide.html, slide);
  const withInertDirectives = replaceRenderDirectiveLinks(withButtons, slide);
  const title = slide.frontmatter?.title;
  const header = title
    ? `<div class="preview-slide-label">#${slide.index + 1} &middot; ${escapeHtml(String(title))}</div>`
    : `<div class="preview-slide-label">#${slide.index + 1}</div>`;
  return `<section class="preview-slide" data-slide-index="${slide.index}">
    ${header}
    <div class="preview-slide-body">${withInertDirectives}</div>
  </section>`;
}

/**
 * Replace [label](render:type?params) links left in the rendered HTML with
 * inert preview cards. We re-parse from slide.content (the source of truth)
 * to know the directive set, then locate each link in the HTML by its
 * rendered anchor signature and swap it.
 */
function replaceRenderDirectiveLinks(html: string, slide: Slide): string {
  if (!slide.renderDirectives || slide.renderDirectives.length === 0) {
    return html;
  }
  const directives = parseRenderDirectives(slide.content, slide.index);
  if (directives.length === 0) {
    return html;
  }

  // Match every <a href="render:..."> ... </a> in the rendered HTML and
  // swap with an inert card. Markdown-it renders [label](render:...) into
  // exactly that anchor shape, so a single regex pass is enough.
  let i = 0;
  return html.replace(
    /<a\s+href="render:[^"]*"[^>]*>([\s\S]*?)<\/a>/g,
    (_match) => {
      const directive = directives[i++];
      if (!directive) {
        return _match;
      }
      return renderInertDirective(directive);
    },
  );
}

function renderInertDirective(directive: RenderDirective): string {
  const { icon, source, kind } = describeDirective(directive);
  return `<div class="preview-directive preview-directive--${directive.type}">
    <div class="preview-directive-header">
      <span class="preview-directive-icon">${icon}</span>
      <span class="preview-directive-kind">${kind}</span>
      <span class="preview-directive-source">${escapeHtml(source)}</span>
    </div>
    <div class="preview-directive-note">Not executed in preview.</div>
  </div>`;
}

function describeDirective(d: RenderDirective): { icon: string; source: string; kind: string } {
  switch (d.type) {
    case 'file':
      return { icon: '\u{1F4C4}', source: d.params.path, kind: 'render:file' };
    case 'command':
      return { icon: '\u26A1', source: d.params.cmd, kind: 'render:command' };
    case 'diff':
      return {
        icon: '\u{1F4CA}',
        source: d.params.path ?? `${d.params.left ?? d.params.before ?? '?'} \u2194 ${d.params.right ?? d.params.after ?? '?'}`,
        kind: 'render:diff',
      };
    default: {
      const unknown = d as RenderDirective;
      return { icon: '\u2753', source: unknown.rawDirective, kind: 'render:?' };
    }
  }
}

function renderWarnings(warnings?: string[]): string {
  if (!warnings || warnings.length === 0) {
    return '';
  }
  const items = warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('');
  return `<aside class="preview-warnings"><ul>${items}</ul></aside>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
