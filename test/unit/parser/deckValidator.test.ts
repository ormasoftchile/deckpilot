/**
 * Tests for deckValidator — duplicate explicit slide ID detection (DA-11).
 *
 * These tests exercise validateSlideIds() directly (unit) and also verify the
 * end-to-end behaviour through parseSlides() + getLastValidationDiagnostics()
 * (integration).
 *
 * DA-12 adds validateSidecarSlideIds() and validateSidecarSchema() suites below.
 */

import { expect } from 'chai';
import { validateSlideIds, validateSidecarSlideIds, validateSidecarSchema, SlideDiagnosticSeverity } from '../../../packages/core/src/parser/deckValidator';
import { parseSlides, getLastValidationDiagnostics } from '../../../packages/core/src/parser/slideParser';
import { Slide } from '../../../packages/core/src/models/slide';
import { SidecarFile } from '../../../packages/core/src/models/sidecar';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal Slide stub for unit-testing validateSlideIds() directly. */
function makeSlide(
  index: number,
  id: string | undefined,
  idExplicit: boolean,
): Partial<Slide> {
  return { index, id, idExplicit } as Partial<Slide>;
}

// ---------------------------------------------------------------------------
// validateSlideIds() — unit
// ---------------------------------------------------------------------------

describe('deckValidator — validateSlideIds() unit', () => {
  it('returns no diagnostics for slides with unique explicit IDs', () => {
    const slides = [
      makeSlide(0, 'intro', true),
      makeSlide(1, 'setup', true),
      makeSlide(2, 'demo', true),
    ] as Slide[];
    expect(validateSlideIds(slides)).to.have.length(0);
  });

  it('returns no diagnostics when all IDs are unique auto-generated', () => {
    const slides = [
      makeSlide(0, 'introduction', false),
      makeSlide(1, 'setup', false),
    ] as Slide[];
    expect(validateSlideIds(slides)).to.have.length(0);
  });

  it('returns no diagnostics for duplicate auto-generated IDs (handled by resolveUniqueIds)', () => {
    const slides = [
      makeSlide(0, 'introduction', false),
      makeSlide(1, 'introduction', false),
    ] as Slide[];
    expect(validateSlideIds(slides)).to.have.length(0);
  });

  it('flags two slides with the same explicit ID', () => {
    const slides = [
      makeSlide(0, 'intro', true),
      makeSlide(1, 'intro', true),
    ] as Slide[];
    const diags = validateSlideIds(slides);
    expect(diags).to.have.length(1);
    expect(diags[0].message).to.include("'intro'");
    expect(diags[0].message).to.include('Duplicate slide id');
    expect(diags[0].severity).to.equal(SlideDiagnosticSeverity.Error);
  });

  it('flags when explicit ID collides with auto-generated ID', () => {
    // One slide has an explicit id, another derives the same string from heading slug
    const slides = [
      makeSlide(0, 'introduction', true),   // explicit
      makeSlide(1, 'introduction', false),  // heading-slugged
    ] as Slide[];
    const diags = validateSlideIds(slides);
    expect(diags).to.have.length(1);
    expect(diags[0].message).to.include("'introduction'");
  });

  it('flags when auto-generated ID collides with later explicit ID', () => {
    // Explicit ID comes after the auto-generated one
    const slides = [
      makeSlide(0, 'introduction', false), // heading-slugged
      makeSlide(1, 'introduction', true),  // explicit
    ] as Slide[];
    const diags = validateSlideIds(slides);
    expect(diags).to.have.length(1);
  });

  it('returns one diagnostic per duplicate pair, not per occurrence', () => {
    // Three slides all claiming the same explicit id
    const slides = [
      makeSlide(0, 'intro', true),
      makeSlide(1, 'intro', true),
      makeSlide(2, 'intro', true),
    ] as Slide[];
    // First collision at index 1, second at index 2 → 2 diagnostics
    const diags = validateSlideIds(slides);
    expect(diags).to.have.length(2);
  });

  it('handles slides with undefined id gracefully', () => {
    const slides = [
      makeSlide(0, undefined, false),
      makeSlide(1, undefined, false),
    ] as Slide[];
    expect(validateSlideIds(slides)).to.have.length(0);
  });

  it('returns Error severity for duplicate explicit IDs', () => {
    const slides = [
      makeSlide(0, 'dup', true),
      makeSlide(1, 'dup', true),
    ] as Slide[];
    const [diag] = validateSlideIds(slides);
    expect(diag.severity).to.equal(SlideDiagnosticSeverity.Error);
    expect(diag.severity).to.equal(0); // vscode.DiagnosticSeverity.Error
  });

  it('sets source to "Deckpilot"', () => {
    const slides = [
      makeSlide(0, 'x', true),
      makeSlide(1, 'x', true),
    ] as Slide[];
    expect(validateSlideIds(slides)[0].source).to.equal('Deckpilot');
  });

  it('points range to line 0 (no source-position tracking on Slide yet)', () => {
    const slides = [
      makeSlide(0, 'y', true),
      makeSlide(1, 'y', true),
    ] as Slide[];
    const { range } = validateSlideIds(slides)[0];
    expect(range.start.line).to.equal(0);
    expect(range.end.line).to.equal(0);
  });

  it('returns no diagnostics for an empty slide array', () => {
    expect(validateSlideIds([])).to.have.length(0);
  });

  it('returns two errors for two independent sets of duplicate explicit IDs', () => {
    // [intro, intro, demo, demo] → two separate collisions, two diagnostics
    const slides = [
      makeSlide(0, 'intro', true),
      makeSlide(1, 'intro', true),
      makeSlide(2, 'demo', true),
      makeSlide(3, 'demo', true),
    ] as Slide[];
    const diags = validateSlideIds(slides);
    expect(diags).to.have.length(2);
    const messages = diags.map(d => d.message);
    expect(messages.some(m => m.includes("'intro'"))).to.be.true;
    expect(messages.some(m => m.includes("'demo'"))).to.be.true;
  });
});

// ---------------------------------------------------------------------------
// parseSlides() + getLastValidationDiagnostics() — integration
// ---------------------------------------------------------------------------

describe('deckValidator — integration via parseSlides()', () => {
  it('no diagnostics for a deck with unique explicit IDs', () => {
    const deck = [
      '<!-- id: intro -->\n# Intro',
      '<!-- id: setup -->\n# Setup',
    ].join('\n\n---\n\n');
    parseSlides(deck);
    expect(getLastValidationDiagnostics()).to.have.length(0);
  });

  it('detects duplicate HTML-comment IDs across slides', () => {
    const deck = [
      '<!-- id: intro -->\n# Slide A',
      '<!-- id: intro -->\n# Slide B',
    ].join('\n\n---\n\n');
    parseSlides(deck);
    const diags = getLastValidationDiagnostics();
    expect(diags).to.have.length(1);
    expect(diags[0].message).to.include("'intro'");
  });

  it('detects duplicate frontmatter IDs across slides', () => {
    const deck = `# Slide A
Content.

---

id: setup

---

# Slide A Content

---

# Slide B
Content.

---

id: setup

---

# Slide B Content`;
    parseSlides(deck);
    const diags = getLastValidationDiagnostics();
    expect(diags).to.have.length(1);
    expect(diags[0].message).to.include("'setup'");
  });

  it('does NOT flag duplicate heading-slug IDs (auto-generated)', () => {
    // Two slides with identical headings → both get slug "introduction"
    // resolveUniqueIds will silently rename the second; no diagnostic needed
    const deck = '# Introduction\n\nSome text.\n\n---\n\n# Introduction\n\nMore text.';
    parseSlides(deck);
    expect(getLastValidationDiagnostics()).to.have.length(0);
  });

  it('diagnostics are reset on each parseSlides() call', () => {
    // First call — has duplicates
    const deckWithDups = [
      '<!-- id: dup -->\n# A',
      '<!-- id: dup -->\n# B',
    ].join('\n\n---\n\n');
    parseSlides(deckWithDups);
    expect(getLastValidationDiagnostics()).to.have.length(1);

    // Second call — clean deck
    const cleanDeck = '<!-- id: unique -->\n# A\n\n---\n\n<!-- id: other -->\n# B';
    parseSlides(cleanDeck);
    expect(getLastValidationDiagnostics()).to.have.length(0);
  });

  it('idExplicit is true for comment-declared IDs on parsed slides', () => {
    const deck = '<!-- id: foo -->\n# Foo';
    const slides = parseSlides(deck);
    expect(slides[0].idExplicit).to.be.true;
  });

  it('idExplicit is true for frontmatter-declared IDs on parsed slides', () => {
    // Bare-YAML frontmatter block between slide delimiters is the correct format
    const deck = `# First
Content.

---

id: bar

---

# Bar
Content.`;
    const slides = parseSlides(deck);
    const barSlide = slides.find(s => s.id === 'bar');
    expect(barSlide).to.exist;
    expect(barSlide!.idExplicit).to.be.true;
  });

  it('idExplicit is falsy for heading-slug-derived IDs', () => {
    const slides = parseSlides('# Getting Started\n\nSome intro text.');
    expect(slides[0].idExplicit).to.not.be.true;
  });

  it('idExplicit is falsy for positional-fallback IDs', () => {
    // Slide with no heading and no id — gets slide-0 positional fallback
    const slides = parseSlides('Just some text without a heading.');
    expect(slides[0].idExplicit).to.not.be.true;
  });
});

// ---------------------------------------------------------------------------
// validateSidecarSlideIds() — DA-10
// ---------------------------------------------------------------------------

/** Build a minimal Slide stub with only id set. */
function makeSlideWithId(index: number, id: string | undefined): Slide {
  return { index, id, idExplicit: true } as unknown as Slide;
}

/** Build a minimal SidecarFile with the given slide id list. */
function makeSidecar(...ids: string[]): SidecarFile {
  return { slides: ids.map(id => ({ id })) };
}

describe('deckValidator — validateSidecarSlideIds() unit (DA-10)', () => {
  it('returns no diagnostics when sidecar has no slides', () => {
    const slides = [makeSlideWithId(0, 'intro'), makeSlideWithId(1, 'setup')];
    expect(validateSidecarSlideIds(slides, {})).to.have.length(0);
  });

  it('returns no diagnostics when sidecar slides array is empty', () => {
    const slides = [makeSlideWithId(0, 'intro')];
    expect(validateSidecarSlideIds(slides, { slides: [] })).to.have.length(0);
  });

  it('returns no diagnostics when all sidecar IDs match deck slides', () => {
    const slides = [makeSlideWithId(0, 'intro'), makeSlideWithId(1, 'demo')];
    const sidecar = makeSidecar('intro', 'demo');
    expect(validateSidecarSlideIds(slides, sidecar)).to.have.length(0);
  });

  it('flags a single unknown sidecar slide ID', () => {
    const slides = [makeSlideWithId(0, 'intro')];
    const sidecar = makeSidecar('intro', 'missing-slide');
    const diags = validateSidecarSlideIds(slides, sidecar);
    expect(diags).to.have.length(1);
    expect(diags[0].message).to.include("'missing-slide'");
    expect(diags[0].message).to.include('no matching slide found in deck');
  });

  it('uses the exact diagnostic message template', () => {
    const slides = [makeSlideWithId(0, 'intro')];
    const sidecar = makeSidecar('ghost-id');
    const [diag] = validateSidecarSlideIds(slides, sidecar);
    expect(diag.message).to.equal(
      "Sidecar references unknown slide id 'ghost-id' — no matching slide found in deck",
    );
  });

  it('flags multiple unknown IDs, one diagnostic each', () => {
    const slides = [makeSlideWithId(0, 'intro'), makeSlideWithId(1, 'setup')];
    const sidecar = makeSidecar('intro', 'bad-one', 'bad-two');
    const diags = validateSidecarSlideIds(slides, sidecar);
    expect(diags).to.have.length(2);
    const messages = diags.map(d => d.message);
    expect(messages.some(m => m.includes("'bad-one'"))).to.be.true;
    expect(messages.some(m => m.includes("'bad-two'"))).to.be.true;
  });

  it('assigns Warning severity (not Error)', () => {
    const slides = [makeSlideWithId(0, 'intro')];
    const sidecar = makeSidecar('unknown');
    const [diag] = validateSidecarSlideIds(slides, sidecar);
    expect(diag.severity).to.equal(SlideDiagnosticSeverity.Warning);
    expect(diag.severity).to.equal(1); // vscode.DiagnosticSeverity.Warning
  });

  it('sets source to "Deckpilot"', () => {
    const slides = [makeSlideWithId(0, 'a')];
    const sidecar = makeSidecar('x');
    expect(validateSidecarSlideIds(slides, sidecar)[0].source).to.equal('Deckpilot');
  });

  it('anchors range to line 0 (no sidecar line-position tracking yet)', () => {
    const slides = [makeSlideWithId(0, 'a')];
    const sidecar = makeSidecar('unknown');
    const { range } = validateSidecarSlideIds(slides, sidecar)[0];
    expect(range.start.line).to.equal(0);
    expect(range.end.line).to.equal(0);
  });

  it('handles slides with undefined id without false-positive matches', () => {
    const slides = [
      makeSlideWithId(0, undefined),
      makeSlideWithId(1, 'real-id'),
    ];
    const sidecar = makeSidecar('real-id');
    expect(validateSidecarSlideIds(slides, sidecar)).to.have.length(0);
  });

  it('returns no diagnostics when deck has no slides but sidecar also has none', () => {
    expect(validateSidecarSlideIds([], {})).to.have.length(0);
  });

  it('flags all sidecar entries as unknown when deck has no slides', () => {
    const sidecar = makeSidecar('intro', 'demo');
    const diags = validateSidecarSlideIds([], sidecar);
    expect(diags).to.have.length(2);
  });

  it('returns no diagnostics for null sidecar (defensive guard)', () => {
    expect(validateSidecarSlideIds([], null as unknown as SidecarFile)).to.have.length(0);
  });

  it('returns no diagnostics for undefined sidecar (defensive guard)', () => {
    expect(validateSidecarSlideIds([], undefined as unknown as SidecarFile)).to.have.length(0);
  });
});

// ---------------------------------------------------------------------------
// validateSidecarSchema() — DA-12
// ---------------------------------------------------------------------------

describe('deckValidator — validateSidecarSchema() unit (DA-12)', () => {

  // --- YAML syntax errors ---

  it('returns no diagnostics for a valid empty file', () => {
    expect(validateSidecarSchema('')).to.have.length(0);
  });

  it('returns no diagnostics for null YAML (empty file with whitespace)', () => {
    expect(validateSidecarSchema('   \n')).to.have.length(0);
  });

  it('returns no diagnostics for a well-formed sidecar', () => {
    const yaml = [
      'deck:',
      '  title: My Talk',
      'slides:',
      '  - id: intro',
      '  - id: demo',
    ].join('\n');
    expect(validateSidecarSchema(yaml)).to.have.length(0);
  });

  it('returns an Error diagnostic for invalid YAML syntax', () => {
    const diags = validateSidecarSchema(': bad: yaml: [unterminated');
    expect(diags).to.have.length(1);
    expect(diags[0].severity).to.equal(SlideDiagnosticSeverity.Error);
    expect(diags[0].message).to.include('YAML parse error');
  });

  it('includes the js-yaml error message in the YAML parse diagnostic', () => {
    const diags = validateSidecarSchema(': bad');
    expect(diags[0].message).to.match(/YAML parse error:/);
  });

  it('stops after YAML parse error — no further diagnostics', () => {
    const diags = validateSidecarSchema(': bad: yaml:');
    expect(diags).to.have.length(1);
  });

  it('sets severity to Error (0) for YAML syntax failures', () => {
    const diags = validateSidecarSchema(': bad');
    expect(diags[0].severity).to.equal(0);
  });

  it('sets source to "Deckpilot" for YAML parse errors', () => {
    const diags = validateSidecarSchema(': bad');
    expect(diags[0].source).to.equal('Deckpilot');
  });

  // --- Top-level structure ---

  it('returns an Error for a YAML scalar at top level', () => {
    const diags = validateSidecarSchema('just a string');
    expect(diags).to.have.length(1);
    expect(diags[0].severity).to.equal(SlideDiagnosticSeverity.Error);
    expect(diags[0].message).to.include('mapping at the top level');
  });

  it('returns an Error for a YAML sequence at top level', () => {
    const diags = validateSidecarSchema('- foo\n- bar');
    expect(diags).to.have.length(1);
    expect(diags[0].severity).to.equal(SlideDiagnosticSeverity.Error);
    expect(diags[0].message).to.include('mapping at the top level');
  });

  // --- Unknown top-level keys ---

  it('returns a Warning for each unknown top-level key', () => {
    const yaml = 'unknown_key: value';
    const diags = validateSidecarSchema(yaml);
    expect(diags).to.have.length(1);
    expect(diags[0].severity).to.equal(SlideDiagnosticSeverity.Warning);
    expect(diags[0].message).to.include("'unknown_key'");
    expect(diags[0].message).to.include('deck, slides, recording, export');
  });

  it('returns a Warning per unknown key (two unknown keys → two Warnings)', () => {
    const yaml = 'foo: 1\nbar: 2';
    const diags = validateSidecarSchema(yaml);
    expect(diags).to.have.length(2);
    expect(diags.every(d => d.severity === SlideDiagnosticSeverity.Warning)).to.be.true;
  });

  it('does not warn for the known top-level keys', () => {
    const yaml = [
      'deck:',
      '  title: Talk',
      'recording:',
      '  autoStart: true',
      'export:',
      '  subtitles: true',
    ].join('\n');
    expect(validateSidecarSchema(yaml)).to.have.length(0);
  });

  it('can flag unknown key alongside missing slide id (both diagnostics returned)', () => {
    const yaml = [
      'typo_key: oops',
      'slides:',
      '  - cues:',
      '    - Do something',
    ].join('\n');
    const diags = validateSidecarSchema(yaml);
    const warnings = diags.filter(d => d.severity === SlideDiagnosticSeverity.Warning);
    const errors   = diags.filter(d => d.severity === SlideDiagnosticSeverity.Error);
    expect(warnings.length).to.be.greaterThan(0);
    expect(errors.length).to.be.greaterThan(0);
  });

  // --- Missing slide id ---

  it('returns an Error when a slide entry is missing id', () => {
    const yaml = 'slides:\n  - cues:\n    - hello';
    const diags = validateSidecarSchema(yaml);
    const errors = diags.filter(d => d.severity === SlideDiagnosticSeverity.Error);
    expect(errors).to.have.length(1);
    expect(errors[0].message).to.include('slides[0]');
    expect(errors[0].message).to.include("required 'id' field");
  });

  it('returns one Error per slide entry missing an id', () => {
    const yaml = [
      'slides:',
      '  - id: intro',
      '  - cues:',
      '    - no id here',
      '  - cues:',
      '    - also no id',
    ].join('\n');
    const diags = validateSidecarSchema(yaml);
    const errors = diags.filter(d => d.severity === SlideDiagnosticSeverity.Error);
    expect(errors).to.have.length(2);
  });

  it('returns no Error when all slides have ids', () => {
    const yaml = 'slides:\n  - id: intro\n  - id: setup\n  - id: demo';
    const diags = validateSidecarSchema(yaml);
    expect(diags.filter(d => d.severity === SlideDiagnosticSeverity.Error)).to.have.length(0);
  });

  it('sets source to "Deckpilot" on all diagnostic types', () => {
    const diags = validateSidecarSchema('unknown_key: x\nslides:\n  - cues: []');
    expect(diags.every(d => d.source === 'Deckpilot')).to.be.true;
  });

  it('YAML parse error carries a non-zero line number for errors on later lines', () => {
    // Error is on line 3 (0-based: line 2 or 3), after two valid lines
    const content = 'deck:\n  title: ok\nslides: [bad_yaml: unclosed';
    const diags = validateSidecarSchema(content);
    expect(diags).to.have.length(1);
    expect(diags[0].severity).to.equal(SlideDiagnosticSeverity.Error);
    expect(diags[0].range.start.line).to.be.greaterThan(0);
  });
});
