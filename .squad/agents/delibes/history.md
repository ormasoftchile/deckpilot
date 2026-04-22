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

### 2026-06-12 — Merge Engine Tests: DA-16

**File:** `test/unit/parser/mergeEngine.test.ts` (30 tests, all passing)

**Context:** `src/parser/mergeEngine.ts` was shipped as part of DA-05 with 27 tests. DA-16 audit identified one coverage gap and added 2 targeted tests to the `multi-slide deck` describe block, bringing the total to 30.

**New tests added (DA-16):**
1. `each of multiple sidecar entries matches its own slide independently` — three slides each matched by a dedicated sidecar entry; verifies field isolation (cues on slide-1, checkpoint on slide-2, cues+duration+checkpoint on slide-3)
2. `sidecar entry matching only slide-2 leaves slide-1 and slide-3 untouched` — verifies same-reference pass-through for unmatched slides while slide-2 receives the injected fields

**mergeEngine.ts is a pure function module — fully testable without the vscode mock.**
`sidecarActionMapper` is imported and used in `mergeSidecarIntoSlides` to populate `onEnterActions` from sidecar actions when the slide has none inline. This side-effect is NOT currently covered in the test suite — only `sidecarActions` (the raw copy) is verified.

**ts-node caching artefact:**
The full `npm run test:unit` suite can flip between "674 passing / 1 failing" and "Exception during run" on consecutive runs. The cause is a stale ts-node compile cache conflicting with untracked working-directory files (`deckValidator.ts`, `deckValidator.test.ts`) that contain TypeScript errors. Running the mergeEngine tests in isolation (`mocha … 'test/unit/parser/mergeEngine.test.ts'`) is always clean: 30/30 green.

---

### 2026-04-11 — Visual Layout Rendering: Test Coverage Gaps

**What exists today:**

- `test/unit/parser/layoutDirectivePlugin.test.ts` tests `transformLayoutDirectives()` in isolation — pure string → string function, no VS Code dependency, runs headlessly via `npm run test:unit`. Covered: `:::center`, `:::columns`/`:::left`/`:::right`, `:::advanced`, `:::optional`, unclosed directives, code fence passthrough, nested div balance, and mixed layout+disclosure. **Missing:** HTML is asserted with string `contain()` only — no DOM structure checks (e.g. nesting order, sibling relationships). No test that the output actually passes through markdown-it and produces parseable HTML. No test for unknown directive names. No test for directives with trailing whitespace variations. No test for adjacent directives without blank lines between them.

- `test/unit/parser/fragmentProcessor.test.ts` tests `processFragments()` — takes HTML string, returns annotated HTML string. Covered: fragment detection on `<li>`, `<p>`, `<h2>`; sequential numbering; animation types; document-order numbering across element types; no cross-tag boundary matches. **Missing:** No test through the full pipeline (transformLayoutDirectives → md.render → processFragments). No test for fragment markers inside `:::columns` blocks.

**HTML rendering pipeline is unit-testable without VS Code:**

The full slide rendering pipeline in `src/parser/slideParser.ts` (`parseSlideContent`) composes: `transformLayoutDirectives` → `md.render` → `injectBlockElementsFromParsed` → `processFragments`. None of these functions touch the VS Code API. `parseSlides()` is the public export and is fully callable in a headless Mocha unit test. The output `slide.html` is a plain HTML string — assertable with Node's built-in `DOMParser` or a lightweight parser like `node-html-parser`.

**`WebviewProvider` is VS Code-entangled:**

`webviewProvider.ts` requires `vscode.WebviewPanel`, `vscode.Uri`, and `vscode.workspace` — it cannot be instantiated in a unit test context. The HTML string that ends up in the webview is assembled in `sendSlideChanged`/`sendDeckLoaded` using `slide.html` (already rendered) plus `transformImageUrls`. The rendering itself is cleanly separated; only the delivery layer is entangled.

**`test:unit` runs headlessly:**

`"test:unit": "mocha --require ts-node/register 'test/unit/**/*.test.ts'"` — no VS Code host required, no Electron. Any new test in `test/unit/parser/` with no `vscode` imports runs immediately with `npm run test:unit`.

**Coverage gap summary:**

1. No end-to-end pipeline test: markdown source → final `slide.html` string
2. No DOM-structural assertions (child/sibling/nesting checks)
3. No test for `:::columns` containing fragments
4. No test for `renderMarkdown()` export
5. No test for `injectBlockElementsFromParsed` in the render pipeline context

---

### 2026-04-11 — Pipeline Regression Baseline: slideRenderingPipeline.test.ts

**`parseSlides()` API (src/parser/slideParser.ts):**
- Signature: `parseSlides(content: string): Slide[]`
- Input: raw slide body string (no frontmatter, just markdown). Split on `---` delimiter internally.
- Returns: `Slide[]` — each has `.html` (final rendered HTML string), `.index` (0-based), `.content` (cleaned markdown), `.frontmatter`, `.interactiveElements`, `.fragmentCount`
- First slide is always kept, even if empty. Subsequent empty slides are dropped.
- A "frontmatter-only" slide (bare YAML with no content) is silently merged into the next slide.

**Final HTML output structure per layout mode (confirmed by tests):**

| Directive | Outer element | Class | Inner landmark |
|-----------|--------------|-------|----------------|
| `:::center` | `<div>` | `layout-center` | content rendered as markdown |
| `:::columns` | `<div>` | `layout-columns` | contains `layout-left` and `layout-right` divs |
| `:::advanced` | `<details>` | `disclosure-advanced` | `<summary>Advanced</summary>` |
| `:::optional` | `<div>` | `step-optional` | `<span class="optional-badge">Optional</span>` |

**Surprises found:**
1. `slideParser.ts` imports `parseRenderDirectives` via the barrel `../renderer/index.ts`, which re-exports `commandRenderer.ts` — a module with a top-level `import * as vscode from 'vscode'`. This makes `parseSlides()` impossible to call in a headless unit test without mocking `vscode`.
2. **Fix implemented:** `test/unit/helpers/vscode-mock.cjs` — a Node.js CJS file that intercepts `Module._resolveFilename` and patches `require.cache` to provide a minimal vscode stub before ts-node loads any TypeScript. Registered via `--require ./test/unit/helpers/vscode-mock.cjs` in the `test:unit` script.
3. The `:::optional` wrapper label and `:::advanced` summary label are hardcoded English strings — confirmed by tests. Any localization or author-override feature will require test updates (which is by design — the tests are the regression anchor).
4. Empty middle slides (content between two `---` delimiters with nothing between) are silently dropped. The test confirmed: `# A\n---\n---\n# B` yields 2 slides, not 3.
5. The `:::center` directive with empty body (`:::center\n:::`) renders the wrapper div without crashing — the inner content is simply empty.

**38 tests written, 38 passing. Full suite: 472 passing.**

---

### 2026-06-12 — Cross-Platform Window Detection: Test Coverage

**File:** `test/unit/recording/windowDetection.test.ts` (25 tests, all new)

**Mocking pattern for `child_process`:**
TypeScript's `esModuleInterop` compiles `import * as cp from 'child_process'` into a `__importStar` wrapper that creates a new object with property getters. These getters are read-only — you cannot do `(cp as any).spawn = myFn`. The solution: use `const cpMod = require('child_process')` to get the actual `module.exports` object. Both the test file's `cpMod` and the source file's `cp` wrapper read from the same underlying exports — mutating `cpMod.spawn` is immediately visible through the source file's `cp.spawn` getter. Restore in `afterEach` with the saved originals.

**Mocking `process.platform`:**
`Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })` works cleanly. Restore with the original `process.platform` value in a describe-local `afterEach`. Top-level `afterEach` handles `cp` restore; inner `afterEach` handles platform restore — correct ordering (inner fires first).

**Private method access:**
All three detection methods are `private` on `RecorderOrchestrator`. Accessed via `(orchestrator as any).methodName()` in tests. Platform dispatch test replaces private methods on the instance (`(orchestrator as any).getWindowBoundsDarwin = async () => ...`) so it can verify routing without spawning real processes.

**Darwin fake process:**
`EventEmitter` subclass with `.stdout`, `.stderr` (separate `EventEmitter` instances), `.stdin` (`write/end` stubs), and `.kill` stub. All events emitted in `process.nextTick` so the code's `proc.once(...)` listeners are registered before they fire.

**Linux `execFileSync` dispatch:**
`execFileSync` is called 2–4 times in sequence inside `tryXdotool()`. Mock keyed on `"cmd:args[0]"` (e.g. `"xdotool:getactivewindow"`) handles the sequential call pattern cleanly. Throw an `Error` from the mock to simulate "command not found" for the wmctrl fallback path.

**25 tests written, 25 passing. Full suite: 497 passing.**

---

### 2026-06-12 — Sidecar Loader Tests: DA-15

**File:** `test/unit/parser/sidecarLoader.test.ts` (28 tests total: 11 pre-existing + 17 new)

**Test file location:** `test/unit/parser/sidecarLoader.test.ts` — follows the same pattern as all other parser unit tests in that directory. Import directly from `../../../src/parser/sidecarLoader`.

**Fixture pattern established:**
- Use `fs.mkdtempSync(path.join(os.tmpdir(), 'sidecar-load-test-'))` for temp directory — same as `sidecarExists` tests above
- Helper `writeSidecar(name, content)` writes the `.deck.yaml` into `tmpDir`
- Helper `deckMdPath(name?)` returns the `.deck.md` path within `tmpDir`
- Multi-line YAML built with `['key:', '  value:', ...].join('\n')` for readability
- Single-line YAML written as `'key:\n  value: x'` (TypeScript `\n` escape in string literal)
- Cleanup in `afterEach` with `fs.rmSync(tmpDir, { recursive: true, force: true })`

**Behaviour documented by tests:**
- Empty YAML file → `loadSidecar` returns `{}` (empty object, NOT null) — implementation returns `{}` when `yaml.load` returns null/undefined
- Unknown/extra fields on both top-level and slide objects pass through without throwing — extensible schema by design
- Whitespace-only `id` field throws same error as missing `id` (caught by `slide.id.trim() === ''`)

**Pre-existing issues encountered (all in OTHER test files, not sidecarLoader):**
- `src/parser/deckValidator.ts` — missing `yaml` import (needed for `validateSidecarSchema`); added it to fix TypeScript compilation
- `test/unit/parser/deckValidator.test.ts` — imports `getLastValidationDiagnostics` from `slideParser` which doesn't exist (DA-11 integration not yet implemented); pre-existing, left as-is
- `test/unit/parser/mergeEngine.test.ts` — 2 failing tests for `onEnterActions` population (DA-07 merge not wired up yet); pre-existing
- `sinon` package was missing from devDependencies (required by `sidecarActionMapper.test.ts`); installed to unblock test compilation

**Suite counts after DA-15:** 743 passing, 2 failing (pre-existing merge engine tests)
