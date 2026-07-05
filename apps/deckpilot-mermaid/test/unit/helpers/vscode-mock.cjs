'use strict';

const Module = require('module');

const vscodeMock = {
  extensions: {
    getExtension: () => undefined,
  },
  window: {
    activeColorTheme: { kind: 2 },
  },
  ColorThemeKind: {
    Light: 1,
    Dark: 2,
    HighContrast: 3,
    HighContrastLight: 4,
  },
};

const originalResolve = Module._resolveFilename.bind(Module);
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === 'vscode') {
    return '__vscode_stub__';
  }
  return originalResolve(request, parent, isMain, options);
};

require.cache['__vscode_stub__'] = {
  id: '__vscode_stub__',
  filename: '__vscode_stub__',
  loaded: true,
  exports: vscodeMock,
  parent: null,
  children: [],
  paths: [],
};
