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
import { peekCommandCache } from '../renderer/commandRenderer';

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
  const deckCwd = path.dirname(opts.deckPath);
  const env = deck.resolvedEnvironment;
  const slidesHtml = deck.slides.map((slide) => renderSlide(slide, deckCwd, env)).join('\n');

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
    (function () {
      var vscode = acquireVsCodeApi();

      // Inert preview: swallow clicks on action links and render-directive cards,
      // but allow propagation for slide-level reverse sync (handled below).
      document.addEventListener('click', function (event) {
        var t = event.target;
        if (t && t.closest && (t.closest('a[href^="action:"]') || t.closest('.preview-directive') || t.closest('a[href^="render:"]'))) {
          event.preventDefault();
          event.stopPropagation();
        }
      }, true);

      // Reverse sync: click empty slide chrome (header / body padding) → reveal source.
      document.addEventListener('click', function (event) {
        var slide = event.target && event.target.closest && event.target.closest('.preview-slide');
        if (!slide) return;
        // Ignore clicks on interactive content (links/buttons inside the slide body).
        if (event.target.closest('a, button, input, .preview-directive')) return;
        var idx = parseInt(slide.getAttribute('data-slide-index'), 10);
        if (!isNaN(idx)) {
          vscode.postMessage({ type: 'revealSource', slideIndex: idx });
        }
      });

      // Cursor follow: extension pushes { type: 'scrollToSlide', slideIndex } messages.
      window.addEventListener('message', function (event) {
        var msg = event.data || {};
        if (msg.type === 'scrollToSlide' && typeof msg.slideIndex === 'number') {
          var el = document.querySelector('.preview-slide[data-slide-index="' + msg.slideIndex + '"]');
          if (el && el.scrollIntoView) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            el.classList.add('preview-slide--active');
            // Drop the highlight from any siblings.
            var others = document.querySelectorAll('.preview-slide--active');
            for (var i = 0; i < others.length; i++) {
              if (others[i] !== el) others[i].classList.remove('preview-slide--active');
            }
          }
        }
      });
    })();
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

function renderSlide(slide: Slide, deckCwd: string, env?: Record<string, string>): string {
  // injectBlockElements turns <!--ACTION:id--> placeholders into real button HTML.
  // The buttons render but clicks are swallowed by the body-level handler above.
  const withButtons = injectBlockElements(slide.html, slide);
  const withInertDirectives = replaceRenderDirectiveLinks(withButtons, slide, deckCwd);
  const withEnv = interpolateEnv(withInertDirectives, env);
  const title = slide.frontmatter?.title;
  const header = title
    ? `<div class="preview-slide-label">#${slide.index + 1} &middot; ${escapeHtml(String(title))}</div>`
    : `<div class="preview-slide-label">#${slide.index + 1}</div>`;
  return `<section class="preview-slide" data-slide-index="${slide.index}">
    ${header}
    <div class="preview-slide-body">${withEnv}</div>
  </section>`;
}

/**
 * Replace {{VAR}} placeholders with values from the deck's resolved
 * environment. Values are HTML-escaped. Unknown vars are left as-is so the
 * author can see what's missing. Operates on rendered HTML; we intentionally
 * keep the syntax narrow (alphanumerics + underscore) to avoid colliding with
 * legitimate `{{` content in code blocks.
 */
function interpolateEnv(html: string, env?: Record<string, string>): string {
  if (!env) {
    return html;
  }
  return html.replace(/\{\{\s*([A-Z_][A-Z0-9_]*)\s*\}\}/gi, (match, name: string) => {
    if (Object.prototype.hasOwnProperty.call(env, name)) {
      return escapeHtml(env[name]);
    }
    return match;
  });
}

/**
 * Replace [label](render:type?params) links left in the rendered HTML with
 * inert preview cards. We re-parse from slide.content (the source of truth)
 * to know the directive set, then locate each link in the HTML by its
 * rendered anchor signature and swap it.
 */
function replaceRenderDirectiveLinks(html: string, slide: Slide, deckCwd: string): string {
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
      return renderInertDirective(directive, deckCwd);
    },
  );
}

function renderInertDirective(directive: RenderDirective, deckCwd: string): string {
  // For render:command, surface a cached output card if a previous run
  // populated the renderer cache. Never executes from the preview surface.
  if (directive.type === 'command' && typeof directive.params.cmd === 'string') {
    const cached = peekCommandCache(directive.params.cmd, deckCwd);
    if (cached) {
      return renderCachedCommand(directive.params.cmd, cached);
    }
  }
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

function renderCachedCommand(
  cmd: string,
  cached: { success: boolean; output?: string; exitCode?: number; error?: string; timedOut?: boolean },
): string {
  const statusClass = cached.success ? 'success' : cached.timedOut ? 'timeout' : 'error';
  const statusIcon = cached.success ? '\u2713' : cached.timedOut ? '\u23F1' : '\u2717';
  const body = escapeHtml(cached.output ?? cached.error ?? '');
  return `<div class="preview-directive preview-directive--command preview-directive--cached preview-directive--${statusClass}">
    <div class="preview-directive-header">
      <span class="preview-directive-icon">\u26A1</span>
      <span class="preview-directive-kind">render:command</span>
      <span class="preview-directive-source">${escapeHtml(cmd)}</span>
      <span class="preview-directive-status">${statusIcon} cached</span>
    </div>
    <pre class="preview-directive-output"><code>${body}</code></pre>
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
