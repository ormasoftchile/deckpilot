/**
 * BrowserPanelContent — generates the HTML for the side-by-side browser WebviewPanel.
 *
 * The panel shows an <iframe> filling the viewport, with a minimal browser-chrome
 * address bar and back / forward / reload controls styled with VS Code semantic tokens.
 *
 * Message protocol (extension host → webview):
 *   { command: 'navigate', url: string }
 */

import * as vscode from 'vscode';

export class BrowserPanelContent {
  /**
   * Return the self-contained HTML document for the browser panel.
   *
   * @param webview  The VS Code Webview instance (used for CSP source token).
   * @param initialUrl  The first URL to load.  Defaults to empty (blank screen).
   */
  static getHtmlContent(webview: vscode.Webview, initialUrl = ''): string {
    const nonce = BrowserPanelContent.getNonce();
    const cspSource = webview.cspSource;

    // CSP notes:
    //   • frame-src *        — iframes may load arbitrary external URLs
    //   • script-src nonce   — only our inline script runs in the chrome
    //   • style-src 'unsafe-inline' — inline CSS only (no external sheets needed)
    //   • img-src https: data: blob: — address-bar favicon, etc.
    const csp = [
      `default-src 'none'`,
      `frame-src *`,
      `script-src 'nonce-${nonce}'`,
      `style-src ${cspSource} 'unsafe-inline'`,
      `img-src ${cspSource} https: data: blob:`,
      `connect-src https: http:`,
    ].join('; ');

    const escapedInitialUrl = BrowserPanelContent.escapeHtml(initialUrl);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <title>Browser</title>
  <style>
    /* ── Reset & VS Code token aliases ─────────────────────────────────── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg:           var(--vscode-editor-background, #1e1e1e);
      --fg:           var(--vscode-editor-foreground, #d4d4d4);
      --chrome-bg:    var(--vscode-titleBar-activeBackground, #3c3c3c);
      --chrome-fg:    var(--vscode-titleBar-activeForeground, #cccccc);
      --input-bg:     var(--vscode-input-background, #3c3c3c);
      --input-fg:     var(--vscode-input-foreground, #cccccc);
      --input-border: var(--vscode-input-border, transparent);
      --input-focus:  var(--vscode-focusBorder, #007fd4);
      --btn-bg:       var(--vscode-button-secondaryBackground, #3a3d41);
      --btn-fg:       var(--vscode-button-secondaryForeground, #cccccc);
      --btn-hover:    var(--vscode-button-secondaryHoverBackground, #45494e);
      --border:       var(--vscode-panel-border, #444);
      --error-fg:     var(--vscode-errorForeground, #f48771);
      --link-fg:      var(--vscode-textLink-foreground, #3794ff);
      --link-hover:   var(--vscode-textLink-activeForeground, #3794ff);
    }

    html, body {
      height: 100%;
      background: var(--bg);
      color: var(--fg);
      font-family: var(--vscode-font-family, system-ui, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      overflow: hidden;
    }

    /* ── Layout ─────────────────────────────────────────────────────────── */
    #root {
      display: flex;
      flex-direction: column;
      height: 100vh;
    }

    /* ── Address bar / chrome ────────────────────────────────────────────── */
    #chrome {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 8px;
      background: var(--chrome-bg);
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }

    .nav-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      background: var(--btn-bg);
      color: var(--btn-fg);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      transition: background 0.1s;
      flex-shrink: 0;
    }
    .nav-btn:hover:not(:disabled) { background: var(--btn-hover); }
    .nav-btn:disabled { opacity: 0.38; cursor: default; }

    #address-input {
      flex: 1;
      height: 28px;
      padding: 0 10px;
      background: var(--input-bg);
      color: var(--input-fg);
      border: 1px solid var(--input-border);
      border-radius: 4px;
      font-size: inherit;
      font-family: inherit;
      outline: none;
      min-width: 0;
    }
    #address-input:focus { border-color: var(--input-focus); }

    /* ── Loading bar ─────────────────────────────────────────────────────── */
    #loading-bar {
      height: 2px;
      background: var(--vscode-progressBar-background, #0e70c0);
      flex-shrink: 0;
      transform-origin: left;
      transform: scaleX(0);
      transition: transform 0.2s ease, opacity 0.3s ease;
      opacity: 0;
    }
    #loading-bar.active {
      opacity: 1;
      animation: indeterminate 1.4s ease-in-out infinite;
    }
    @keyframes indeterminate {
      0%   { transform: translateX(-100%) scaleX(0.5); }
      50%  { transform: translateX(25%)  scaleX(0.6); }
      100% { transform: translateX(110%) scaleX(0.4); }
    }

    /* ── Viewport (iframe + overlays) ───────────────────────────────────── */
    #viewport {
      flex: 1;
      position: relative;
      overflow: hidden;
    }

    #browser-iframe {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      border: none;
      background: var(--bg);
    }

    /* ── Empty state ─────────────────────────────────────────────────────── */
    #empty-state {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      color: var(--vscode-descriptionForeground, #858585);
      pointer-events: none;
    }
    #empty-state .empty-icon { font-size: 48px; opacity: 0.4; }
    #empty-state p { font-size: 13px; }
    #empty-state.hidden { display: none; }

    /* ── Error overlay ───────────────────────────────────────────────────── */
    #error-overlay {
      position: absolute;
      inset: 0;
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      padding: 32px;
      text-align: center;
      background: var(--bg);
    }
    #error-overlay.visible { display: flex; }
    #error-overlay .error-icon { font-size: 40px; }
    #error-overlay h2 { font-size: 15px; color: var(--fg); font-weight: 600; }
    #error-overlay p  { font-size: 13px; color: var(--vscode-descriptionForeground, #858585); max-width: 420px; line-height: 1.5; }
    #error-overlay a {
      color: var(--link-fg);
      text-decoration: none;
      font-size: 13px;
      border-bottom: 1px solid transparent;
      transition: border-color 0.1s;
    }
    #error-overlay a:hover { border-color: var(--link-hover); }
  </style>
</head>
<body>
  <div id="root">
    <div id="chrome">
      <button class="nav-btn" id="btn-back"    title="Back"    disabled>&#8592;</button>
      <button class="nav-btn" id="btn-forward" title="Forward" disabled>&#8594;</button>
      <button class="nav-btn" id="btn-reload"  title="Reload"  disabled>&#8635;</button>
      <input  id="address-input" type="url" placeholder="Enter URL…" spellcheck="false"
              value="${escapedInitialUrl}" autocomplete="off">
    </div>
    <div id="loading-bar"></div>
    <div id="viewport">
      <iframe id="browser-iframe"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
              referrerpolicy="no-referrer-when-downgrade"
              src="${escapedInitialUrl}"></iframe>

      <div id="empty-state" class="${initialUrl ? 'hidden' : ''}">
        <div class="empty-icon">🌐</div>
        <p>No page loaded yet</p>
      </div>

      <div id="error-overlay">
        <div class="error-icon">🚫</div>
        <h2>This page can't be embedded</h2>
        <p>The page refused to load inside a frame (X-Frame-Options or Content-Security-Policy).</p>
        <a id="open-external-link" href="#" target="_blank">Open in external browser ↗</a>
      </div>
    </div>
  </div>

  <script nonce="${nonce}">
    // ── State ──────────────────────────────────────────────────────────────
    const history = [];   // URL history stack
    let historyIndex = -1;
    let currentUrl = '';

    // ── Elements ───────────────────────────────────────────────────────────
    const iframe         = document.getElementById('browser-iframe');
    const addressInput   = document.getElementById('address-input');
    const btnBack        = document.getElementById('btn-back');
    const btnForward     = document.getElementById('btn-forward');
    const btnReload      = document.getElementById('btn-reload');
    const loadingBar     = document.getElementById('loading-bar');
    const emptyState     = document.getElementById('empty-state');
    const errorOverlay   = document.getElementById('error-overlay');
    const openExtLink    = document.getElementById('open-external-link');

    // ── Helpers ────────────────────────────────────────────────────────────
    function normaliseUrl(raw) {
      raw = raw.trim();
      if (!raw) { return ''; }
      if (!/^[a-zA-Z][a-zA-Z0-9+\\-.]*:/.test(raw)) {
        raw = 'https://' + raw;
      }
      return raw;
    }

    function updateControls() {
      btnBack.disabled    = historyIndex <= 0;
      btnForward.disabled = historyIndex >= history.length - 1;
      btnReload.disabled  = !currentUrl;
    }

    function setLoading(active) {
      if (active) {
        loadingBar.classList.add('active');
      } else {
        loadingBar.classList.remove('active');
      }
    }

    function hideOverlays() {
      emptyState.classList.add('hidden');
      errorOverlay.classList.remove('visible');
    }

    function showError(url) {
      errorOverlay.classList.add('visible');
      openExtLink.href = url;
      openExtLink.textContent = 'Open in external browser ↗ (' + url + ')';
      setLoading(false);
    }

    /**
     * Navigate the iframe to a URL and push it onto our history stack.
     * Does NOT push if called from a back/forward operation (pass push=false).
     */
    function navigate(url, push = true) {
      url = normaliseUrl(url);
      if (!url) { return; }

      currentUrl = url;
      addressInput.value = url;
      openExtLink.href = url;
      hideOverlays();
      setLoading(true);

      if (push) {
        // Truncate forward history when navigating to a new URL
        history.splice(historyIndex + 1);
        history.push(url);
        historyIndex = history.length - 1;
      }

      iframe.src = url;
      updateControls();

      // Safety net: if no successful load detected within 4 s, assume blocked.
      clearTimeout(loadTimer);
      loadTimer = setTimeout(() => {
        if (currentUrl) { showError(currentUrl); }
      }, 4000);
    }

    // ── iframe events ──────────────────────────────────────────────────────
    let loadTimer = null;

    iframe.addEventListener('load', () => {
      clearTimeout(loadTimer);

      // Attempt to read the iframe title (same-origin only; cross-origin silently fails)
      try {
        const frameTitle = iframe.contentDocument?.title;
        if (frameTitle) { document.title = frameTitle; }
      } catch (_) { /* cross-origin — expected */ }

      // Detect X-Frame-Options / frame-ancestors blocking.
      //
      // When a site refuses to be embedded, Electron/Chromium loads about:blank
      // into the iframe instead. Three observable states:
      //   • contentWindow === null   → sandbox blocked window access entirely → blocked
      //   • location.href === 'about:blank' → blank doc landed → blocked
      //   • location.href throws SecurityError → cross-origin page loaded fine
      //   • location.href is a real URL → same-origin page loaded fine
      if (currentUrl) {
        const win = iframe.contentWindow;
        if (win === null) {
          // VS Code's webview sandbox set contentWindow to null — treat as blocked.
          showError(currentUrl);
          return;
        }
        try {
          const loc = win.location?.href;
          if (!loc || loc === 'about:blank') {
            showError(currentUrl);
          } else {
            setLoading(false); // real content arrived
          }
        } catch (_) {
          // SecurityError: cross-origin page loaded successfully.
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    });

    iframe.addEventListener('error', () => {
      clearTimeout(loadTimer);
      if (currentUrl) { showError(currentUrl); }
    });

    // ── Chrome controls ────────────────────────────────────────────────────
    btnBack.addEventListener('click', () => {
      if (historyIndex > 0) {
        historyIndex--;
        navigate(history[historyIndex], false);
      }
    });

    btnForward.addEventListener('click', () => {
      if (historyIndex < history.length - 1) {
        historyIndex++;
        navigate(history[historyIndex], false);
      }
    });

    btnReload.addEventListener('click', () => {
      if (currentUrl) {
        setLoading(true);
        iframe.src = currentUrl;
      }
    });

    addressInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        navigate(addressInput.value);
      }
    });

    // ── Messages from extension host ───────────────────────────────────────
    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (!msg || typeof msg !== 'object') { return; }

      if (msg.command === 'navigate' && typeof msg.url === 'string') {
        navigate(msg.url);
      }
    });

    // ── Initial load ───────────────────────────────────────────────────────
    const initialUrl = ${JSON.stringify(initialUrl)};
    if (initialUrl) {
      navigate(initialUrl);
    } else {
      updateControls();
    }
  </script>
</body>
</html>`;
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private static getNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let nonce = '';
    for (let i = 0; i < 32; i++) {
      nonce += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return nonce;
  }

  private static escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
