/**
 * Minimal vscode stub for Vite — satisfies imports from renderer modules
 * that are transitively loaded by the parser. None of these functions
 * are ever called during a pure parse (no file I/O happens at parse time).
 */

export const workspace = {
  fs: {
    readFile: async (_uri: unknown): Promise<Uint8Array> => new Uint8Array(),
    writeFile: async (): Promise<void> => {},
    stat: async (): Promise<never> => { throw new Error('not implemented'); },
    readDirectory: async (): Promise<never[]> => [],
    delete: async (): Promise<void> => {},
    rename: async (): Promise<void> => {},
  },
  isTrusted: false,
  workspaceFolders: [] as unknown[],
  getConfiguration: () => ({
    get: () => undefined,
  }),
};

export const Uri = {
  file: (p: string) => ({
    fsPath: p,
    path: p,
    scheme: 'file',
    toString: () => `file://${p}`,
  }),
  parse: (s: string) => ({ fsPath: s, toString: () => s }),
  joinPath: (base: { fsPath: string }, ...parts: string[]) => {
    const joined = [base.fsPath, ...parts].join('/');
    return { fsPath: joined, toString: () => `file://${joined}` };
  },
};

export const window = {
  showErrorMessage: () => Promise.resolve(undefined),
  showWarningMessage: () => Promise.resolve(undefined),
  showInformationMessage: () => Promise.resolve(undefined),
  createOutputChannel: () => ({
    appendLine: () => {},
    append: () => {},
    clear: () => {},
    show: () => {},
    dispose: () => {},
  }),
};

export const commands = {
  executeCommand: () => Promise.resolve(undefined),
};

export const env = {
  clipboard: { writeText: () => Promise.resolve() },
};

export default { workspace, Uri, window, commands, env };
