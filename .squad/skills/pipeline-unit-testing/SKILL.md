# Skill: Unit Testing Pure Pipeline Functions with Headless Mocha

**Project:** executable-talk  
**Author:** Delibes  
**Date:** 2026-04-11

---

## Problem

A pipeline of pure TypeScript functions (no VS Code API calls) is embedded in a module that transitively imports VS Code-dependent code via a barrel export. You want to call the pipeline end-to-end in a headless Mocha unit test, but `import 'vscode'` throws at module load time.

**Pattern in this codebase:**
```
slideParser.ts
  └─ imports from '../renderer'   (barrel)
       └─ re-exports commandRenderer.ts
            └─ import * as vscode from 'vscode'  ← fails headless
```

---

## Solution: CJS Module Cache Intercept + --require

### 1. Create `test/unit/helpers/vscode-mock.cjs`

A plain CommonJS file (`.cjs` extension so it loads before ts-node touches it) that:

1. Intercepts `Module._resolveFilename` to redirect `require('vscode')` to a synthetic key
2. Injects a minimal stub into `require.cache` under that key

```js
'use strict';
const Module = require('module');

const vscodeMock = {
  workspace: {
    workspaceFolders: undefined,
    fs: { readFile: async () => Buffer.from('') },
  },
  Uri: {
    file: (p) => ({ fsPath: p, path: p }),
    parse: (s) => ({ fsPath: s, path: s }),
  },
  // add only what module-load-time code references
};

const originalResolve = Module._resolveFilename.bind(Module);
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === 'vscode') return '__vscode_stub__';
  return originalResolve(request, parent, isMain, options);
};

require.cache['__vscode_stub__'] = {
  id: '__vscode_stub__', filename: '__vscode_stub__',
  loaded: true, exports: vscodeMock,
  parent: null, children: [], paths: [],
};
```

### 2. Register it before ts-node in the Mocha script

```json
"test:unit": "mocha --require ./test/unit/helpers/vscode-mock.cjs --require ts-node/register 'test/unit/**/*.test.ts'"
```

**Order matters:** the `.cjs` file must be `--require`d before `ts-node/register` so the stub is in the cache before TypeScript modules start loading.

---

## Writing Pipeline Tests

Once the mock is in place, import and call `parseSlides()` directly in your test:

```typescript
import { expect } from 'chai';
import { parseSlides } from '../../../src/parser/slideParser';

it('should render :::center layout', () => {
  const slides = parseSlides(':::center\nHello\n:::');
  expect(slides[0].html).to.contain('class="layout-center"');
  expect(slides[0].html).to.contain('Hello');
});
```

### Assertion Patterns

| Goal | Pattern |
|------|---------|
| Element/class present | `expect(html).to.contain('class="layout-center"')` |
| Element absent | `expect(html).not.to.contain('layout-center')` |
| A appears before B | `expect(html.indexOf('A')).to.be.lessThan(html.indexOf('B'))` |
| Balanced tags | count `<div` vs `</div>` occurrences |
| Slide count | `expect(parseSlides(deck)).to.have.lengthOf(N)` |
| Slide indices | `expect(slides[0].index).to.equal(0)` |

### Baseline Fixture Pattern

Use a named `const` for multi-assertion slides to avoid repeating `parseSlides()`:

```typescript
const columnsMarkdown = ':::columns\n:::left\nL\n:::\n:::right\nR\n:::\n:::';

it('should produce layout-columns', () => {
  expect(renderSlide(columnsMarkdown)).to.contain('layout-columns');
});
it('should preserve left content', () => {
  expect(renderSlide(columnsMarkdown)).to.contain('L');
});
```

Or extract a helper:
```typescript
function renderSlide(markdown: string): string {
  const slides = parseSlides(markdown);
  expect(slides.length).to.be.greaterThan(0);
  return slides[0].html;
}
```

---

## When to Use This Pattern

- Testing a rendering/transformation pipeline where the function under test is pure TypeScript
- The pipeline is buried under a barrel export that re-exports vscode-dependent modules
- You want end-to-end coverage of: input markdown → output HTML string
- You do NOT need to invoke any real VS Code API (file system, workspace, window, etc.)

## When NOT to Use This Pattern

- When the function under test actually calls vscode APIs at runtime (use `@vscode/test-electron` integration tests)
- When the mock needs to be stateful or return realistic data (use a proper mock library)
- When you're testing the webview delivery layer (use integration tests)

---

## Files in This Project

- `test/unit/helpers/vscode-mock.cjs` — the stub registration file
- `test/unit/parser/slideRenderingPipeline.test.ts` — example test using this pattern
- `package.json` `test:unit` script — shows `--require` ordering
