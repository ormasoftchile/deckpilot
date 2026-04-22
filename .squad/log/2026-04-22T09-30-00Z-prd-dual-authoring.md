# Session Log: Dual Authoring Model PRD

**Timestamp:** 2026-04-22T09:30:00Z  
**Focus:** Dual Authoring Model PRD analysis, decomposition, and team decisions

---

## Session Goals

1. Analyze Dual Authoring Model PRD for architectural fit
2. Decompose into discrete work items across P1 and P2
3. Identify risks and mitigation strategies
4. Recommend PR sequencing and first PR scope
5. Document all decisions in team records

---

## PRD Overview

**Input:** Dual Authoring Model (Mode A: Inline, Mode B: Sidecar) PRD  
**Scope:** Support both inline `.deck.md` frontmatter-based authoring AND external `.deck.yaml` sidecar files for metadata, actions, cues, and deck-level config.

**Key Requirement:** Backward compatibility — existing inline-only decks must work unchanged.

---

## Architectural Analysis

### Existing System

The parsing pipeline is already format-agnostic:

```
parseDeck() 
  → extractDeckFrontmatter() [gray-matter YAML]
    → parseSlides() [per-slide parsing]
      → frontmatter extraction, checkpoint parsing, voice cues, action blocks, markdown rendering
    → InteractiveElement/onEnterActions synthesis
  → return Deck { DeckMetadata, Slide[] }
```

The **Conductor** receives a `Deck` object and never touches raw Markdown. It's completely decoupled from source format.

### Feature Fit

The Dual Authoring feature maps cleanly to the parser layer:

```
.deck.md (inline)          .deck.yaml (sidecar)
     ↓                           ↓
DeckParser.parseDeck()    SidecarLoader.load()
     ↓                           ↓
     └────────→ MergeEngine.merge() [NEW]
                      ↓
              Deck (canonical)
                      ↓
              Conductor [UNCHANGED]
```

**Critical insight:** The Conductor and Webview are completely unchanged. This is a parser-only feature.

### Model Extensions

Minimal changes to existing types:

```typescript
// Slide model
interface Slide {
  // ... existing fields ...
  id?: string;                    // NEW: stable ID for sidecar refs
  cues?: string[];                // NEW: voice cues from sidecar
  timingHint?: string;            // NEW: pacing metadata from sidecar
  duration?: string;              // NEW: duration target from sidecar
}

// DeckMetadata model
interface DeckMetadata {
  // ... existing fields ...
  recording?: {                   // NEW: recording config
    outputFormat?: string;
    environment?: string;
  };
  export?: {                      // NEW: export config
    format?: string;
  };
  environment?: Record<string, unknown>;  // NEW: env overrides
}
```

**Note:** `ActionDefinition` already supports all needed action types. No changes needed there.

### Merge Strategy

**Precedence rule (simple shallow merge per slide):**
```
inline frontmatter > sidecar YAML > global defaults
```

**Example:**
- Slide 1 frontmatter defines `notes: "inline note"`
- Sidecar defines `notes: "sidecar note"` for same slide
- Result: `notes: "inline note"` (inline wins)

If inline doesn't define `notes`, sidecar value is used. If neither, default applies.

This is **not** a cascading or deeply inherited system. Each field is evaluated independently.

---

## Risk Assessment

### R1: Slide ID Stability (Medium)

**Problem:** Auto-generating IDs from content hashes or positions is fragile. If user reorders slides, all sidecar references break.

**Mitigation:**
- Use explicit `<!-- id: intro -->` HTML comments in slides (ideal)
- Use frontmatter `id:` field (acceptable)
- Auto-generate as fallback (`slide-0`, `slide-1`, etc.)
- Warn loudly when auto-generating
- Plan Phase 2 command "Generate Missing Slide IDs" to batch-add IDs

**Verdict:** Medium risk, medium mitigation cost. Manageable in Phase 1 with clear warning.

### R2: Sidecar File Watcher Complexity (Low)

**Problem:** Need to re-parse when `.deck.yaml` changes, invalidate cache, update diagnostics.

**Mitigation:** Already have `.deck.env` file watcher pattern. Reuse same approach.

**Verdict:** Low risk — pattern is proven.

### R3: Scope Creep in Phase 2 & 3 (High)

**Problem:** PRD mentions "Reusable metadata templates" (Phase 3) and "multi-file deck imports" (Phase 3). These are unbounded features that could eat months.

**Decision:** ✅ **DEFER Phase 3 entirely.** Don't even design for it yet. Phase 1 + 2 ship all the user value. If users ask for templates in production, we'll design it then.

**Verdict:** High risk, decisive mitigation: kill Phase 3 from all planning.

### R4: Existing Decks Must Not Break (Critical)

**Problem:** All existing `.deck.md` files have no sidecar. `parseDeck()` must behave identically when `.deck.yaml` is absent.

**Mitigation:**
- Sidecar path optional at every level
- `SidecarResolver` returns `undefined` if `.deck.yaml` doesn't exist
- `MergeEngine` no-ops when sidecar is `undefined`
- Model fields are optional (`id?: string`, not `id: string`)
- Auto-generated IDs don't change slide order or behavior

**Verdict:** Critical risk, fully mitigated. Zero breaking changes.

### R5: Validation Diagnostics Scope (Medium)

**Problem:** PRD lists 7+ validation rules (unknown IDs, duplicates, malformed YAML, etc.). Tempting to ship all upfront. But validation is lower priority than the core feature working.

**Mitigation:** Ship validation incrementally. Phase 1 includes basic validation (DA-10 through DA-13). More sophisticated diagnostics in Phase 2 if needed.

**Verdict:** Medium risk, managed by phasing validation.

---

## Decomposition: 25 Work Items

### Phase 1: Foundation (18 items)

Core feature delivery. Everything needed for sidecar to work end-to-end.

**Model & Parsing:**
- DA-01: Add `id` field to `Slide` model
- DA-02: Slide ID parser (inline comments + frontmatter)
- DA-04: Sidecar YAML loader + TypeScript types
- DA-09: Sidecar deck metadata → `DeckMetadata` extension

**Sidecar Loading & Merging:**
- DA-03: Sidecar file discovery (`.deck.md` → `.deck.yaml`)
- DA-05: Merge engine (precedence rules, shallow merge)
- DA-06: Integrate sidecar into `parseDeck()` pipeline
- DA-13: File watcher for `.deck.yaml`

**Sidecar → Deck Mapping:**
- DA-07: Sidecar actions → `interactiveElements` (via existing `createAction()`)
- DA-08: Sidecar cues → `voiceCues`

**Validation & Diagnostics:**
- DA-10: Unknown slide ID refs → warnings
- DA-11: Duplicate slide IDs → error
- DA-12: Malformed sidecar YAML → diagnostics

**Testing:**
- DA-14: Unit tests: slide ID parsing
- DA-15: Unit tests: sidecar loader
- DA-16: Unit tests: merge engine
- DA-17: Unit tests: sidecar validation
- DA-18: Integration test: full round-trip (parse `.deck.md` + `.deck.yaml`, verify merged Deck)

**Rationale for Phase 1:** All items are blocking on each other (parser foundation → loader → merge → mapping → validation → tests). Ship as one unit. ~500 lines production code, ~1000 lines tests.

### Phase 2: Tooling & UX (7 items)

Features that extend Phase 1 but don't block core sidecar functionality.

**Metadata Extensions:**
- DA-19: Extend `DeckMetadata` for recording/export fields
- DA-20: Environment/platform overrides in sidecar (wire to EnvResolver)

**VS Code Commands:**
- DA-21: "Extract Metadata to Sidecar" command (read inline, write `.deck.yaml`, strip from `.deck.md`)
- DA-22: "Show Resolved Deck Model" command (dump merged Deck as JSON)
- DA-23: "Generate Missing Slide IDs" command (batch-add `<!-- id: slide-N -->` to `.deck.md`)

**UI:**
- DA-24: Webview status indicator (badge showing sidecar loaded)

**Testing:**
- DA-25: Unit tests for all Phase 2 commands

**Rationale for Phase 2:** These are convenience features and developer tools. Nice-to-have after Phase 1 ships. Lower priority for MVP.

### Phase 3: DEFERRED ✋

**Items:** "Reusable metadata templates" and "multi-file deck imports"

**Decision:** Do not schedule. Do not design. Do not create work items. If users request in production, design then.

**Rationale:** These are solutions looking for problems we don't have yet. They add unbounded complexity (inheritance hierarchies, import graph resolution, etc.). Phase 1 + 2 deliver all immediate user value.

---

## PR Sequencing Recommendation

### PR #1: Slide ID Support ⭐ START HERE

**Items:** DA-01 + DA-02 + DA-14

**What it does:** Adds stable slide IDs to the model, parser support, and full test coverage.

**Why first:**
- Foundation for all downstream sidecar features
- Small & isolated (150 lines production, 200 lines tests)
- Zero risk to existing decks (field is optional, auto-gen doesn't change behavior)
- Clean merge because all later PRs depend on this only

**Deliverables:**
- `id?: string` field in `Slide` interface
- `parseSlideId()` function in `slideParser.ts` (parse comments + frontmatter)
- Fallback auto-generation (`slide-0`, `slide-1`)
- Duplicate ID detection & logging
- Unit test coverage (comments, frontmatter, auto-gen, duplicates, edge cases)

**Example tests:**
```typescript
it('parses ID from HTML comment', () => {
  const slide = parseSlide('<!-- id: my-slide -->\n# Title');
  expect(slide.id).toBe('my-slide');
});

it('auto-generates fallback ID', () => {
  const slide = parseSlide('# Title');
  expect(slide.id).toBe('slide-N'); // N = position
});

it('detects duplicate IDs and warns', () => {
  const slides = [
    parseSlide('<!-- id: intro -->\n# Intro'),
    parseSlide('<!-- id: intro -->\n# Oops'),
  ];
  expect(logger.warn).toHaveBeenCalledWith('Duplicate slide ID');
});
```

**Merge criteria:** All tests pass, no existing tests break, type definitions are sound.

### PR #2: Sidecar Discovery & Loader

**Items:** DA-03 + DA-04

**What it does:** Pure addition — build sidecar discovery and YAML parsing infrastructure.

**Why second:**
- Builds on Slide ID support
- No existing code modified
- Establishes TypeScript types for sidecar schema
- Low risk, high confidence building

### PR #3: Merge Engine & Integration

**Items:** DA-05 + DA-06 + DA-07 + DA-08 + DA-09 + DA-18

**What it does:** Merges sidecar into Deck, integrates into parser pipeline, maps sidecar fields to Deck model.

**Why third:**
- By now, foundation is solid
- This is the "big one" but scope is clear
- Integration test (DA-18) proves everything works end-to-end

### Continue: Validation

**Items:** DA-10 + DA-11 + DA-12 + DA-13 + DA-17

**What it does:** Diagnostics, file watching, validation rules.

**Why after:** Validation is important but doesn't block core feature. Can ship incrementally.

### Final: Phase 2

**Items:** DA-19 through DA-25

**What it does:** Recording/export config, developer commands, UI status.

**Why final:** Nice-to-have tooling. Depends on Phase 1 solid. Lower priority for MVP.

---

## Key Decisions

✅ **Sidecar is optional.** If `.deck.yaml` doesn't exist, behavior is identical to today. Backward compat 100%.

✅ **Merge is shallow.** No inheritance, no cascading, no complex rules. Precedence: inline > sidecar > defaults.

✅ **Parser layer only.** Conductor and Webview unchanged. Minimal architectural surface.

✅ **Phase 3 deferred.** Templates and multi-file imports are out of scope. Design when users ask.

✅ **First PR is DA-01+DA-02+DA-14.** Small, isolated, foundation for everything else.

---

## What's Not Changing

- `Conductor` class — still format-agnostic, still receives `Deck` object
- `WebviewProvider` — still sends/receives same messages
- Parser pipeline structure — just adding a merge step
- Existing action/cue/metadata handling — reusing existing `createAction()` etc.
- Any Electron/VS Code API surface

---

## Success Criteria

By end of Phase 1:
- ✅ Existing `.deck.md` files work unchanged
- ✅ New `.deck.yaml` files are discovered and loaded
- ✅ Slide IDs can be explicit or auto-generated
- ✅ Sidecar metadata is merged with correct precedence
- ✅ Actions, cues, metadata from sidecar work identically to inline
- ✅ File watcher detects sidecar changes
- ✅ Validation catches unknown IDs, duplicates, malformed YAML
- ✅ Full test coverage (unit + integration)
- ✅ Zero production code regressions

By end of Phase 2:
- ✅ Recording/export config in sidecar works
- ✅ Environment overrides wired to EnvResolver
- ✅ All VS Code commands implemented and tested
- ✅ Webview shows sidecar status

---

## Open Questions for Team

1. **Sidecar file naming:** Always `.deck.yaml`? Or allow `.deck.yml` and `.sidecar.yaml` variants?
2. **Schema versioning:** Should sidecar schema have a `version:` field for future evolution?
3. **Validation diagnostics:** Errors only, or warnings+info? How prominent in output?
4. **Phase 2 commands:** Which is highest priority? (Extract, Show Model, Generate IDs?)
5. **Recording/export config in sidecar:** What format/structure? (Free-form YAML or predefined keys?)

---

## Conclusion

The PRD is well-scoped. The decomposition is clean. The risks are understood and mitigated. Phase 1 is ready to execute. Phase 2 tooling can follow. Phase 3 is wisely deferred.

**Recommend:** Proceed with Phase 1 as outlined. Approve first PR scope (DA-01 + DA-02 + DA-14).

---

**Recorded by:** Scribe  
**Approved by:** [Team decision pending]
