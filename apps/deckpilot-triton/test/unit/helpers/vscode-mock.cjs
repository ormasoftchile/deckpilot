'use strict';

const Module = require('module');

const vscodeMock = {
  Uri: {
    joinPath: (...parts) => ({
      fsPath: parts.map((part) => part.fsPath ?? String(part)).join('/'),
    }),
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
