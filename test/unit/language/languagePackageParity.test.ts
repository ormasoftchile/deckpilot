/**
 * Phase 1 EXIT-GATE parity tests for the `@deckpilot/language` extraction.
 *
 * Author: Delibes (independent parity reviewer). De Unamuno performed the MOVE
 * of completion/hover/diagnostics out of the extension into the framework-neutral
 * `@deckpilot/language` package; these tests independently prove PARITY and
 * package isolation.
 *
 * WHY THIS FILE IMPORTS FROM `@deckpilot/language` DIRECTLY (not the extension
 * shims): the pre-existing provider tests under `test/unit/providers/*` import
 * via `packages/extension/src/providers/*`, which now re-export from the package.
 * That proves the shims work. This file exercises the EXTRACTED package's public
 * API and facade functions head-on, so a future shim change cannot mask a
 * package regression.
 *
 * Coverage the pre-existing suite did NOT have (the gate's asks):
 *   1. The `getCompletions` / `getHover` / `getDiagnostics` FACADE functions,
 *      asserted to be byte-identical to the provider-class output.
 *   2. The env `validate:` rule-name path through `computeDiagnostics`, proving
 *      `isValidRule` still resolves off core's `VALIDATION_RULES`.
 *   3. Diagnostics WITHOUT an injected env-existence checker (browser scenario)
 *      vs WITH one injected (extension scenario) — proving identical output and
 *      that the checker is a RESERVED, non-gating seam (never invoked today).
 *   4. Honest `.deck.yaml` behavior: these are `.deck.md`-fence-scoped authoring
 *      providers, so a raw YAML sidecar body yields empty/null results. Locked
 *      here so nobody later "fixes" it into a silent behavior change.
 *   5. vscode-compatible result SHAPES (ranges, severities, kinds, source).
 */

import { expect } from 'chai';
import * as lang from '@deckpilot/language';
import {
  ActionCompletionProvider,
  ActionHoverProvider,
  ActionDiagnosticProvider,
  getCompletions,
  getHover,
  getDiagnostics,
  isValidRule,
  CompletionKind,
  DiagnosticSeverity,
  type EnvExistenceChecker,
} from '@deckpilot/language';

/** Minimal framework-neutral TextDocument mock (matches the package duck type). */
function mockDocument(lines: string[]) {
  return {
    lineCount: lines.length,
    lineAt(line: number) {
      return { text: lines[line] ?? '' };
    },
    getText() {
      return lines.join('\n');
    },
  };
}

// ───────────────────────────────────────────────────────────────────────────
// 0. Public API surface — no signature/symbol drift after the move
// ───────────────────────────────────────────────────────────────────────────
describe('@deckpilot/language — public API surface', () => {
  it('exports the three provider classes', () => {
    expect(lang.ActionCompletionProvider).to.be.a('function');
    expect(lang.ActionHoverProvider).to.be.a('function');
    expect(lang.ActionDiagnosticProvider).to.be.a('function');
  });

  it('exports the three stateless facade functions', () => {
    expect(lang.getCompletions).to.be.a('function');
    expect(lang.getHover).to.be.a('function');
    expect(lang.getDiagnostics).to.be.a('function');
  });

  it('exports the pure isValidRule helper and the enum/const shapes', () => {
    expect(lang.isValidRule).to.be.a('function');
    expect(lang.CompletionKind).to.be.an('object');
    expect(lang.DiagnosticSeverity).to.be.an('object');
    // vscode.DiagnosticSeverity numeric parity
    expect(DiagnosticSeverity.Error).to.equal(0);
    expect(DiagnosticSeverity.Warning).to.equal(1);
    // vscode.CompletionItemKind subset parity
    expect(CompletionKind.Value).to.equal(12);
    expect(CompletionKind.Property).to.equal(9);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 1. isValidRule — behavior-change probe: still off core's VALIDATION_RULES
//    (must match the original extension EnvRuleValidator.isValidRule semantics)
// ───────────────────────────────────────────────────────────────────────────
describe('@deckpilot/language — isValidRule parity with original EnvRuleValidator', () => {
  it('accepts the five exact-match rules', () => {
    for (const rule of ['directory', 'file', 'command', 'url', 'port']) {
      expect(isValidRule(rule), rule).to.be.true;
    }
  });

  it('accepts any regex: prefixed rule', () => {
    expect(isValidRule('regex:^\\d+$')).to.be.true;
    expect(isValidRule('regex:^v\\d+')).to.be.true;
  });

  it('rejects unknown rule names and bare regex without colon', () => {
    expect(isValidRule('unknown')).to.be.false;
    expect(isValidRule('')).to.be.false;
    expect(isValidRule('regex')).to.be.false;
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 2. Completion — fires inside a .deck.md action fence; facade === class
// ───────────────────────────────────────────────────────────────────────────
describe('@deckpilot/language — completion parity (.deck.md action fence)', () => {
  const doc = mockDocument([
    '```action',
    'type: ',
    '```',
  ]);
  const position = { line: 1, character: 6 }; // right after "type: "

  it('suggests all action types on the type: line with vscode-compatible shape', () => {
    const items = getCompletions(doc as any, position);
    expect(items).to.be.an('array');
    expect(items!.length).to.be.greaterThan(0);
    const labels = items!.map((i) => i.label);
    expect(labels).to.include.members(['file.open', 'terminal.run']);
    // Shape: every item has a string label and numeric kind (Value for types)
    for (const item of items!) {
      expect(item.label).to.be.a('string');
      expect(item.kind).to.equal(CompletionKind.Value);
    }
  });

  it('returns null completion outside any action block', () => {
    const plain = mockDocument(['# Heading', 'no action blocks here']);
    expect(getCompletions(plain as any, { line: 1, character: 3 })).to.equal(null);
  });

  it('facade getCompletions is identical to ActionCompletionProvider output', () => {
    const facade = getCompletions(doc as any, position);
    const viaClass = new ActionCompletionProvider().provideCompletionItems(
      doc as any,
      position,
      undefined,
      undefined,
    );
    expect(facade).to.deep.equal(viaClass);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 3. Hover — on an action type keyword; facade === class
// ───────────────────────────────────────────────────────────────────────────
describe('@deckpilot/language — hover parity (.deck.md action type)', () => {
  const doc = mockDocument([
    '```action',
    'type: file.open',
    'path: src/main.ts',
    '```',
  ]);
  const position = { line: 1, character: 8 }; // inside "file.open"

  it('returns markdown hover + range for the action type with vscode-compatible shape', () => {
    const hover = getHover(doc as any, position);
    expect(hover).to.not.equal(null);
    expect(hover!.contents).to.be.an('array').with.length.greaterThan(0);
    expect(hover!.contents[0]).to.include('file.open');
    expect(hover!.range).to.not.equal(undefined);
    expect(hover!.range!.start).to.have.keys(['line', 'character']);
    expect(hover!.range!.end).to.have.keys(['line', 'character']);
  });

  it('returns null hover outside any action block', () => {
    const plain = mockDocument(['# Heading', 'nothing here']);
    expect(getHover(plain as any, { line: 1, character: 2 })).to.equal(null);
  });

  it('facade getHover is identical to ActionHoverProvider output', () => {
    const facade = getHover(doc as any, position);
    const viaClass = new ActionHoverProvider().provideHover(doc as any, position, undefined);
    expect(facade).to.deep.equal(viaClass);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 4. Diagnostics — action-block validation shapes + facade === class
// ───────────────────────────────────────────────────────────────────────────
describe('@deckpilot/language — diagnostics parity (.deck.md action blocks)', () => {
  it('flags an unknown action type as an Error with the Deckpilot source and a range', () => {
    const doc = mockDocument(['```action', 'type: nonexistent.action', '```']);
    const diags = getDiagnostics(doc as any);
    const err = diags.find((d) => d.message.includes('Unknown action type'));
    expect(err, 'expected an unknown-type diagnostic').to.not.equal(undefined);
    expect(err!.severity).to.equal(DiagnosticSeverity.Error);
    expect(err!.source).to.equal('Deckpilot');
    expect(err!.range.start).to.have.keys(['line', 'character']);
    expect(err!.range.end).to.have.keys(['line', 'character']);
  });

  it('flags a missing required parameter as an Error', () => {
    const doc = mockDocument(['```action', 'type: file.open', '```']);
    const diags = getDiagnostics(doc as any);
    const missing = diags.find(
      (d) => d.message.includes('path') && d.message.toLowerCase().includes('required'),
    );
    expect(missing).to.not.equal(undefined);
    expect(missing!.severity).to.equal(DiagnosticSeverity.Error);
  });

  it('flags an unknown parameter key as a Warning', () => {
    const doc = mockDocument([
      '```action',
      'type: file.open',
      'path: src/main.ts',
      'bogusKey: value',
      '```',
    ]);
    const diags = getDiagnostics(doc as any);
    const unknown = diags.find((d) => d.message.includes('bogusKey'));
    expect(unknown).to.not.equal(undefined);
    expect(unknown!.severity).to.equal(DiagnosticSeverity.Warning);
  });

  it('flags invalid YAML in an action block as an Error', () => {
    const doc = mockDocument(['```action', 'type: file.open', '  bad: - [', '```']);
    const diags = getDiagnostics(doc as any);
    expect(diags.length).to.be.greaterThan(0);
    expect(diags.some((d) => d.severity === DiagnosticSeverity.Error)).to.be.true;
  });

  it('produces zero diagnostics for a valid action block', () => {
    const doc = mockDocument(['```action', 'type: file.open', 'path: src/main.ts', '```']);
    expect(getDiagnostics(doc as any)).to.deep.equal([]);
  });

  it('facade getDiagnostics is identical to ActionDiagnosticProvider output', () => {
    const doc = mockDocument(['```action', 'type: nonexistent.action', '```']);
    const facade = getDiagnostics(doc as any);
    const viaClass = new ActionDiagnosticProvider().computeDiagnostics(doc as any);
    expect(facade).to.deep.equal(viaClass);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 5. Diagnostics — env frontmatter validate: rule path (proves isValidRule wire)
// ───────────────────────────────────────────────────────────────────────────
describe('@deckpilot/language — env validate: rule diagnostics via isValidRule', () => {
  it('flags an unknown validation rule name as an Error', () => {
    const doc = mockDocument([
      '---',
      'env:',
      '  - name: FOO',
      '    validate: bogusrule',
      '---',
      '# Title',
    ]);
    const diags = getDiagnostics(doc as any);
    const ruleErr = diags.find((d) => d.message.includes('Unknown validation rule'));
    expect(ruleErr, "expected an 'Unknown validation rule' diagnostic").to.not.equal(undefined);
    expect(ruleErr!.severity).to.equal(DiagnosticSeverity.Error);
    expect(ruleErr!.message).to.include('bogusrule');
  });

  it('accepts a known exact rule (directory) — no rule diagnostic', () => {
    const doc = mockDocument([
      '---',
      'env:',
      '  - name: REPO',
      '    validate: directory',
      '---',
      '# Title',
    ]);
    const diags = getDiagnostics(doc as any);
    expect(diags.some((d) => d.message.includes('Unknown validation rule'))).to.be.false;
  });

  it('accepts a regex: prefixed rule — no rule diagnostic', () => {
    const doc = mockDocument([
      '---',
      'env:',
      '  - name: TAG',
      '    validate: regex:^v\\d+',
      '---',
      '# Title',
    ]);
    const diags = getDiagnostics(doc as any);
    expect(diags.some((d) => d.message.includes('Unknown validation rule'))).to.be.false;
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 6. EnvExistenceChecker seam — injected vs not is IDENTICAL, and never invoked
// ───────────────────────────────────────────────────────────────────────────
describe('@deckpilot/language — EnvExistenceChecker is a reserved, non-gating seam', () => {
  // A spy checker matching the extension's real EnvRuleValidator signature.
  function makeSpyChecker() {
    const calls: Array<{ value: string; rule: string }> = [];
    const checker: EnvExistenceChecker = {
      async validateValue(value: string, rule: string) {
        calls.push({ value, rule });
        return { rule, passed: true, message: 'stub' };
      },
    };
    return { checker, calls };
  }

  // A deck that exercises BOTH env rule validation and an existence-style rule
  // (directory) plus a {{VAR}} reference — everything the checker *could* gate.
  const doc = mockDocument([
    '---',
    'env:',
    '  - name: REPO',
    '    validate: directory',
    '---',
    '# Title',
    '',
    '```action',
    'type: file.open',
    'path: "{{REPO}}/main.ts"',
    '```',
  ]);

  it('produces identical diagnostics with and without an injected checker', () => {
    const { checker } = makeSpyChecker();
    const withoutChecker = getDiagnostics(doc as any); // browser scenario
    const withChecker = getDiagnostics(doc as any, checker); // extension scenario
    expect(withChecker).to.deep.equal(withoutChecker);
  });

  it('never invokes the injected checker (env-existence is NOT gated in authoring diagnostics)', () => {
    const { checker, calls } = makeSpyChecker();
    new ActionDiagnosticProvider(checker).computeDiagnostics(doc as any);
    expect(calls.length, 'checker.validateValue must not be called').to.equal(0);
  });

  it('exposes the injected checker on the reserved accessor, undefined when omitted', () => {
    const { checker } = makeSpyChecker();
    expect(new ActionDiagnosticProvider(checker).existenceChecker).to.equal(checker);
    expect(new ActionDiagnosticProvider().existenceChecker).to.equal(undefined);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 7. .deck.yaml behavior — HONEST parity: these are .deck.md fence-scoped
//    providers, so a raw YAML sidecar body yields empty/null results. The
//    equivalent authored as a .deck.md action fence DOES produce a diagnostic.
//    Locks the real seam so nobody silently changes it.
// ───────────────────────────────────────────────────────────────────────────
describe('@deckpilot/language — .deck.yaml sidecar parity (fence-scoped by design)', () => {
  // A representative .deck.yaml sidecar body: structured YAML, NO ```action
  // fence, NO leading --- frontmatter fence.
  const yamlSidecar = mockDocument([
    'title: My Deck',
    'slides:',
    '  - actions:',
    '      - type: file.open',
    '        path: src/main.ts',
    '      - type: bogus.action',
  ]);

  it('yields zero diagnostics for a raw .deck.yaml sidecar body', () => {
    // findActionBlocks() only detects ```action fences; a raw YAML doc has none,
    // and there is no ---frontmatter--- fence, so env validation is inert too.
    expect(getDiagnostics(yamlSidecar as any)).to.deep.equal([]);
  });

  it('yields null completion and null hover for a raw .deck.yaml sidecar body', () => {
    expect(getCompletions(yamlSidecar as any, { line: 5, character: 20 })).to.equal(null);
    expect(getHover(yamlSidecar as any, { line: 5, character: 20 })).to.equal(null);
  });

  it('CONTRAST: the same bad action authored in a .deck.md fence IS flagged (proves the seam is fence-scoped, not blind)', () => {
    const asDeckMd = mockDocument(['```action', 'type: bogus.action', '```']);
    const diags = getDiagnostics(asDeckMd as any);
    expect(diags.some((d) => d.message.includes('Unknown action type'))).to.be.true;
  });
});
