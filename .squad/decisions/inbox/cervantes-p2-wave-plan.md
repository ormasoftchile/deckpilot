# Phase 2 Wave Plan — Dual Authoring Model

**Proposed by:** Cervantes (Lead)  
**Date:** 2026-07-23  
**Status:** Ready for execution  
**Baseline:** 788 tests passing (P1 complete)

---

## P2 Scope (from PRD)

1. **Recording/export settings in sidecar** — extend `SidecarRecording` and `SidecarExport` with full field sets, wire through merge engine
2. **Environment/platform overrides in sidecar** — `SidecarEnvironment` type, platform-conditional env values
3. **"Deckpilot: Extract Metadata to Sidecar" command** — scaffolds a `.deck.yaml` from existing inline metadata
4. **"Deckpilot: Show Resolved Deck Model" command** — JSON viewer of the final merged `Deck` object (authoring aid)

---

## Work Items

### DA-19: Recording Settings in Sidecar Types

| Field | Value |
|---|---|
| **Owner** | Cervantes |
| **Description** | Extend `SidecarRecording` with `outputDir?: string`, `format?: string`, `codec?: string`, `framerate?: number`, `windowScope?: 'focused' \| 'screen'`. Extend `SidecarExport` with `outputDir?: string`, `srtFormat?: 'srt' \| 'vtt'`, `voiceScript?: boolean`. |
| **Input files** | `src/models/sidecar.ts` |
| **Output files** | `src/models/sidecar.ts` (updated types) |
| **Dependencies** | None |

---

### DA-20: Recording/Export Merge into DeckMetadata

| Field | Value |
|---|---|
| **Owner** | De Unamuno |
| **Description** | Add `recording?: SidecarRecording` and `export?: SidecarExport` fields to `DeckMetadata`. Extend `mergeSidecarDeckMetadata()` in merge engine to merge these sections. Inline-wins precedence for each sub-field. |
| **Input files** | `src/models/deck.ts`, `src/parser/mergeEngine.ts` |
| **Output files** | Same (modified) |
| **Dependencies** | DA-19 |

---

### DA-21: Environment/Platform Override Types

| Field | Value |
|---|---|
| **Owner** | Cervantes |
| **Description** | Add `SidecarEnvironment` interface: `{ platform?: Record<'darwin' \| 'linux' \| 'win32', Record<string, string>>, common?: Record<string, string> }`. Add `environment?: SidecarEnvironment` to `SidecarFile`. Validate allowed top-level key `environment` in `validateSidecarSchema()`. |
| **Input files** | `src/models/sidecar.ts`, `src/parser/deckValidator.ts` |
| **Output files** | Same (modified) |
| **Dependencies** | None |

---

### DA-22: Environment Override Resolution

| Field | Value |
|---|---|
| **Owner** | De Unamuno |
| **Description** | Integrate sidecar `environment` section into `resolveEnvironment()` in `envResolver.ts`. Precedence: `.deck.env` file > sidecar platform-specific > sidecar common > system env. Inject `process.platform` for testability. |
| **Input files** | `src/parser/envResolver.ts`, `src/parser/mergeEngine.ts` (optional helper) |
| **Output files** | `src/parser/envResolver.ts` (modified) |
| **Dependencies** | DA-21 |

---

### DA-23: "Extract Metadata to Sidecar" Command

| Field | Value |
|---|---|
| **Owner** | De Unamuno |
| **Description** | Register `deckpilot.extractMetadataToSidecar` command in `extension.ts`. Reads active `.deck.md`, extracts frontmatter `env`, slide `cues`, `duration`, `actions` (action links), and deck-level `title`/`theme`/`recording`/`export`. Generates `.deck.yaml` with stable slide IDs. Opens generated file in editor. If sidecar exists, show confirmation before overwrite. |
| **Input files** | `src/extension.ts`, `src/parser/DeckParser.ts` |
| **Output files** | `src/commands/extractMetadata.ts` (new), `src/extension.ts` (modified) |
| **Dependencies** | DA-20, DA-21 |

---

### DA-24: "Show Resolved Deck Model" Command

| Field | Value |
|---|---|
| **Owner** | De Vega |
| **Description** | Register `deckpilot.showResolvedDeckModel` command in `extension.ts`. Calls `parseDeck()` on active `.deck.md`, serializes merged `Deck` object to JSON (excluding circular refs), opens read-only virtual document in editor with JSON syntax highlighting. Useful for debugging merge issues. |
| **Input files** | `src/extension.ts` |
| **Output files** | `src/commands/showResolvedModel.ts` (new), `src/extension.ts` (modified) |
| **Dependencies** | DA-20, DA-21 (must be mergeable before showing) |

---

### DA-25: P2 Test Coverage

| Field | Value |
|---|---|
| **Owner** | Delibes |
| **Description** | Add tests for: (1) extended `SidecarRecording`/`SidecarExport` merge, (2) environment platform override resolution, (3) "Extract Metadata" command output correctness, (4) "Show Resolved Model" JSON structure. Target: 25+ new tests. |
| **Input files** | All DA-19 through DA-24 output files |
| **Output files** | `test/unit/parser/mergeEngine.test.ts` (extended), `test/unit/parser/envResolver.test.ts` (extended), `test/unit/commands/extractMetadata.test.ts` (new), `test/unit/commands/showResolvedModel.test.ts` (new) |
| **Dependencies** | DA-20, DA-22, DA-23, DA-24 |

---

## Dependency Graph

```
DA-19 ────┐
          ├──▶ DA-20 ───┬──▶ DA-23 ──┐
DA-21 ────┘             │            │
          ├──▶ DA-22 ───┤            ├──▶ DA-25
                        │            │
                        └──▶ DA-24 ──┘
```

---

## Wave Plan

### Wave 1 (Parallel — No Dependencies)
| ID | Title | Owner |
|---|---|---|
| DA-19 | Recording settings types | Cervantes |
| DA-21 | Environment/platform override types | Cervantes |

### Wave 2 (Depends on Wave 1)
| ID | Title | Owner |
|---|---|---|
| DA-20 | Recording/export merge | De Unamuno |
| DA-22 | Environment override resolution | De Unamuno |

### Wave 3 (Depends on Wave 2)
| ID | Title | Owner |
|---|---|---|
| DA-23 | Extract Metadata command | De Unamuno |
| DA-24 | Show Resolved Model command | De Vega |

### Wave 4 (Final — Full Integration)
| ID | Title | Owner |
|---|---|---|
| DA-25 | P2 test coverage | Delibes |

---

## Risks & Architectural Decisions

### R1: Platform Detection Testability
**Risk:** `envResolver.ts` may use `process.platform` directly, making unit tests platform-specific.  
**Mitigation:** DA-22 must inject platform as a parameter or use a mockable getter. Pattern: `getPlatform()` function that tests can stub.

### R2: Circular Reference in Deck Serialization
**Risk:** `Deck` object may have circular refs (e.g., Slide → Deck → Slide).  
**Mitigation:** DA-24 must use a safe serializer. Recommend `JSON.stringify(deck, (key, value) => key === 'deck' ? undefined : value, 2)` or a whitelist approach.

### R3: Extract Metadata Command — Action Link Parsing
**Risk:** Extracting actions from `[label](action:type?params)` requires re-parsing rendered HTML or tracking source positions.  
**Decision:** For MVP, only extract frontmatter-declared actions and voice cues. Action links embedded in markdown are left in place (they're already inline — no need to move them).

### R4: Schema Validation Scope Creep
**Risk:** Adding `environment` and extended `recording`/`export` sections increases validation complexity.  
**Decision:** Keep `validateSidecarSchema` lenient (warn on unknown keys, not error). Full strict mode deferred to Phase 3 if demanded.

---

## SQL-Ready Work Items

```
INSERT INTO todos (id, title, description, status) VALUES
  ('DA-19', 'Recording settings types', 'Extend SidecarRecording/SidecarExport in sidecar.ts with full field sets', 'pending'),
  ('DA-20', 'Recording/export merge', 'Add recording/export to DeckMetadata, extend mergeSidecarDeckMetadata()', 'pending'),
  ('DA-21', 'Environment override types', 'Add SidecarEnvironment type with platform overrides, validate in schema', 'pending'),
  ('DA-22', 'Environment override resolution', 'Wire sidecar env section into envResolver.ts, inject platform', 'pending'),
  ('DA-23', 'Extract Metadata command', 'deckpilot.extractMetadataToSidecar scaffolds .deck.yaml from inline', 'pending'),
  ('DA-24', 'Show Resolved Model command', 'deckpilot.showResolvedDeckModel shows merged Deck as JSON', 'pending'),
  ('DA-25', 'P2 test coverage', '25+ tests for merge, env resolution, and both commands', 'pending');

INSERT INTO todo_deps (todo_id, depends_on) VALUES
  ('DA-20', 'DA-19'),
  ('DA-22', 'DA-21'),
  ('DA-23', 'DA-20'),
  ('DA-23', 'DA-21'),
  ('DA-24', 'DA-20'),
  ('DA-24', 'DA-21'),
  ('DA-25', 'DA-20'),
  ('DA-25', 'DA-22'),
  ('DA-25', 'DA-23'),
  ('DA-25', 'DA-24');
```

---

## Acceptance Criteria

- [ ] All 7 work items completed
- [ ] Test count ≥ 813 (788 + 25)
- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] Both new commands functional in VS Code
- [ ] Sidecar with `recording`, `export`, `environment` sections loads without warnings
