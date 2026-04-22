# Project Context

- **Owner:** ormasoftchile
- **Project:** executable-talk — VS Code extension (v0.8.1) that transforms .deck.md Markdown files into interactive executable presentations with live code demos
- **Stack:** TypeScript 5.x strict, VS Code Extension API 1.85+, gray-matter (YAML frontmatter), markdown-it, @vscode/test-electron, Mocha
- **Architecture:** Three layers — Webview (Presentation UI) ↔ Conductor (Orchestration) ↔ VS Code API. Webview communicates only via postMessage.
- **Key files:** src/extension.ts, src/conductor/Conductor.ts, src/conductor/StateStack.ts, src/actions/ActionRegistry.ts, src/parser/DeckParser.ts, src/webview/WebviewProvider.ts
- **Action types:** file.open, editor.highlight, terminal.run (trust required), debug.start (trust required), sequence
- **Improvement focus areas:** visual/theming support, presentation rendering, video recording, subtitle production, general automation
- **Created:** 2026-04-11

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### 2026-04-11 — Layout Rendering Pipeline Investigation

**Rendering pipeline (end-to-end):**

1. **DeckParser** → `parseDeck()` calls `gray-matter` to strip YAML frontmatter, then delegates to `parseSlides()`.
2. **SlideParser** → `parseSlideContent()` runs each slide through this ordered pipeline:
   - Extract checkpoint syntax
   - Strip voice-over cue comments (`<!-- voice: -->`)
   - Parse action blocks (fenced ` ```action ` blocks) — removed from markdown, replaced with `<!--ACTION:id-->` placeholders
   - **`transformLayoutDirectives()`** — pre-processes `:::directive` syntax into raw HTML divs before markdown-it sees it
   - **`markdown-it`** renders the result to HTML (`html: true, linkify: true, typographer: true`)
   - `injectBlockElementsFromParsed()` — replaces `<!--ACTION:id-->` placeholders with `<a href="action:...">` buttons
   - `processFragments()` — wraps `<!-- .fragment -->` comments into `<span class="fragment">` elements
3. **WebviewProvider** → serializes all slide HTML into `window.deckData` JSON, injected as a `<script>` block. The webview JS reads this on init.
4. **Image URLs** → transformed from file-system paths to `vscode-webview://` URIs via `transformImageUrls()` at send-time, not parse-time.

**Layout directives (`layoutDirectivePlugin.ts`):**
- Syntax: `:::name` / `:::` (close)
- Layout modes: `center` → `<div class="layout-center">`, `columns` → `<div class="layout-columns">`, `left` → `<div class="layout-left">`, `right` → `<div class="layout-right">`
- Disclosure/special: `advanced` → `<details class="disclosure-advanced"><summary>Advanced</summary>`, `optional` → `<div class="step-optional"><span class="optional-badge">Optional</span>`
- Directives are **pre-processed as string transforms** (not markdown-it plugins), replacing lines before the md renderer runs. Blank lines are injected after opening/before closing tags so markdown-it parses inner content correctly.
- Code fences are tracked to prevent directive processing inside them.
- Unclosed directives are auto-closed gracefully.

**CSS layout classes:**
- `.layout-center` — `display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center`
- `.layout-columns` — `display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; align-items: start`
- `.layout-left` / `.layout-right` — children of `.layout-columns`, just `min-width: 0` (no additional positioning)
- `.disclosure-advanced` — styled `<details>` with custom summary arrow (CSS `::before` triangle, rotates on open)
- `.step-optional` — left-border callout with `.optional-badge` pill label

**HTML shell structure (from `getHtmlContent`):**
```html
<body class="theme-{dark|light|minimal|contrast} font-{small|medium|large} mode-{presentation|onboarding}">
  <div id="presentation-container">
    <div id="progress-bar">
    <div id="slide-container">
      <div id="slide-content"> ← rendered slide HTML lands here via JS
    <div id="onboarding-controls"> ← only shown in onboarding mode
    <nav id="navigation">
    <div id="toolbar">
    <div id="env-badge">
    <div id="action-overlay">
  </div>
</body>
```

**Themes:** `theme-dark` (default), `theme-light`, `theme-minimal`, `theme-contrast` (WCAG AAA). All use `--vscode-*` CSS custom properties as base, with `--bg-color`, `--fg-color`, `--accent-color`, `--border-color` as computed aliases.

**Modes:** `mode-presentation` (default, centered, animated transitions) vs `mode-onboarding` (left-aligned, no entry animation, step-dot progress bar, retry/reset buttons).

**Fragment animations:** `.fragment` elements start `opacity: 0 / visibility: hidden`. Supported animations: `fade`, `slide-up`, `slide-left`, `zoom`, `highlight`. Controlled by `data-fragment-animation` attribute.

**Transitions:** `slideIn` / `slideOut` (default, translateX) and `fadeIn` / `fadeOut`. Applied as CSS animation classes on `#slide-content`.

**Extractability outside VS Code:** The rendering pipeline is pure TypeScript (no VS Code API dependencies). `transformLayoutDirectives()` and `renderMarkdown()` from `slideParser.ts` can be called in Node.js unit tests directly. `parseSlides()` + `injectBlockElementsFromParsed()` are also VS-Code-free. The webview HTML shell uses `vscode.Webview.asWebviewUri()` for CSS/JS URIs, but a test harness could substitute those paths. `window.deckData` is plain JSON — the rendered slide HTML can be extracted without running VS Code.

**Layout pain points identified:**
- `.layout-columns` is hardcoded `1fr 1fr` — no support for asymmetric column ratios (e.g. `2fr 1fr`)
- No CSS gap or alignment options are author-configurable
- `.layout-left` / `.layout-right` have no visual differentiation; they rely entirely on parent grid position
- `#slide-content` has `max-width: 1200px` and `overflow: auto` — columns inside it don't adapt to content height, risking scroll within a slide
- Onboarding mode overrides `align-items: flex-start` on `#slide-container` which breaks centering for layout directives expecting centered context
- No `:::split` or `:::grid` variants for more complex layouts (3-col, sidebar, etc.)
- The `:::advanced` / `:::optional` disclosure types use hardcoded English labels ("Advanced", "Optional") — not localizable

## ⚠️ Layout Baseline Tests (2026-04-11)

**File:** `test/unit/parser/slideRenderingPipeline.test.ts` (38 tests, all green)

This file is the **safety net for all layout class names and HTML structure changes.** Any refactor to `layoutDirectivePlugin.ts`, `slideParser.ts`, or CSS layout classes will break these tests if not synchronized with test assertions.

**Rule:** Any layout class name change, tag restructuring, or new directive added to the rendering pipeline **must update this test file** with corresponding string assertions on the final `slide.html` output.

**Critical:** Do not change `.layout-*`, `.disclosure-*`, `.step-*` CSS selectors or HTML structure (tag types, class presence, nesting) without:
1. Updating failing assertions in `slideRenderingPipeline.test.ts`
2. Running full test suite (`npm run test:unit`) to verify all 38 layout tests pass
3. Documenting the intent of the change in the test file or commit message

**Infrastructure:** Tests use Tier 1 string assertions (no DOM parser). Mock patch at `test/unit/helpers/vscode-mock.cjs` enables headless Mocha execution.

### 2026-06-12 — DA-24: Show Resolved Deck Model Command

**Command:** `deckpilot.showResolvedDeckModel`

New command in `src/commands/showResolvedModel.ts`. Parses the active `.deck.md` file via `parseDeck()` and opens the resulting merged `Deck` object as a virtual read-only JSON document using a `TextDocumentContentProvider` registered on the `deckpilot-model:` URI scheme.

**Key implementation details:**
- `DeckModelContentProvider` holds a `Map<string, string>` keyed by URI path — allows multiple open deck files without collision
- JSON serialization uses a circular-reference guard (`seen` Set) plus function stripping (replacer returns `undefined` for `typeof === 'function'`)
- `vscode.languages.setTextDocumentLanguage(doc, 'json')` applied after opening to get syntax highlighting on a virtual doc
- Provider registered in `extension.ts` alongside the command, both in `context.subscriptions`
- 814 unit tests still green post-implementation; zero TypeScript errors
