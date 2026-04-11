/**
 * Minimal stub for the 'vscode' module used in unit tests that transitively
 * import VS Code-dependent source files (e.g. src/renderer/commandRenderer.ts).
 *
 * Only stubs what the renderer chain needs at *module load time* — none of
 * the real runtime APIs are exercised during headless unit tests.
 *
 * This file is registered via --require in the test:unit mocha script.
 */

'use strict';

const Module = require('module');

const vscodeMock = {
  workspace: {
    workspaceFolders: undefined,
    fs: {
      readFile: async () => Buffer.from(''),
    },
  },
  Uri: {
    file: (p) => ({ fsPath: p, path: p, toString: () => p }),
    parse: (s) => ({ fsPath: s, path: s, toString: () => s }),
  },
  window: {
    showErrorMessage: () => {},
    showInformationMessage: () => {},
    createOutputChannel: () => ({ appendLine: () => {}, show: () => {}, dispose: () => {} }),
  },
  env: { shell: '' },
  EventEmitter: class { on() {} off() {} fire() {} },
  Disposable: class { dispose() {} },
  ThemeColor: class { constructor(id) { this.id = id; } },
};

// Intercept Node's module resolver so any `require('vscode')` or
// `import … from 'vscode'` resolves to this stub.
const originalResolve = Module._resolveFilename.bind(Module);
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === 'vscode') {
    return '__vscode_stub__';
  }
  return originalResolve(request, parent, isMain, options);
};

// Register the stub exports under the synthetic filename.
require.cache['__vscode_stub__'] = {
  id: '__vscode_stub__',
  filename: '__vscode_stub__',
  loaded: true,
  exports: vscodeMock,
  parent: null,
  children: [],
  paths: [],
};
