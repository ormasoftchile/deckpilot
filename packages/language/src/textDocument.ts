/**
 * TextDocument — the minimal, framework-neutral document abstraction the
 * language-intelligence providers operate on.
 *
 * This is the duck type the extension providers already relied on: a line
 * count, line access, and full-text access. `vscode.TextDocument` satisfies
 * it structurally, and so can a browser-side document adapter. Keeping this
 * shape identical to the original inline types is what makes the extraction a
 * pure refactor.
 */
export interface TextLine {
  /** The raw text of the line, without the trailing line break. */
  text: string;
}

/** A zero-based position in a document. */
export interface Position {
  line: number;
  character: number;
}

/**
 * Read-only document surface consumed by the completion, hover, and
 * diagnostic providers. Members mirror the subset of `vscode.TextDocument`
 * the providers used before extraction.
 */
export interface TextDocument {
  /** Total number of lines in the document. */
  lineCount: number;
  /** Return the line at the given zero-based line number. */
  lineAt(line: number): TextLine;
  /** Return the full text of the document. */
  getText(): string;
  /**
   * Optional word-range probe. Present on `vscode.TextDocument`; retained here
   * only for structural compatibility (the hover provider accepted it in its
   * original duck type but never invoked it).
   */
  getWordRangeAtPosition?(position: unknown, regex?: RegExp): unknown;
}
