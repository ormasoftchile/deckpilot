# DA-23: Extract Metadata to Sidecar — Design Decisions

**Author:** De Unamuno  
**Date:** 2026-06-12  
**Task:** DA-23 — `deckpilot.extractMetadataToSidecar` command

---

## What is extracted

The command calls `parseDeck()` on the active `.deck.md` file and builds a `.deck.yaml` from the resulting merged `Deck` object. This means **merged values** are extracted — sidecar-wins-over-inline and inline-wins-over-defaults precedences are already applied. The generated sidecar captures the current authoritative state.

### Exported fields

| Source field | Sidecar output | Condition |
|---|---|---|
| `deck.metadata.title` | `deck.title` | if present |
| `deck.metadata.theme` | `deck.theme` | if present |
| `deck.metadata.recording` | `recording:` | if non-empty object |
| `deck.metadata.export` | `export:` | if non-empty object |
| `slide.id` | `slides[].id` | required for slide entry |
| `slide.cues` | `slides[].cues` | if non-empty |
| `slide.duration` | `slides[].duration` | if present |
| `slide.checkpoint` | `slides[].checkpoint` | if present |
| `slide.sidecarActions` | `slides[].actions` | if non-empty (round-trip) |

### NOT extracted (by design)

| What | Why |
|---|---|
| Inline action links `[Label](action:...)` | R3 scope exclusion: do not parse markdown body for actions |
| Slides with no exportable metadata | Avoids bloat; id-only entries have no merge value |
| Slides without an `id` | No stable merge target without an id |
| `slide.voiceCues` (HTML comment cues) | These are inline author content; not sidecar metadata |
| `slide.speakerNotes` / `frontmatter.notes` | Same — inline content, belongs in the .deck.md |
| `slide.onEnterActions` | These are resolved Action objects; sidecarActions is the raw form |

---

## sidecarActions re-export (round-trip preservation)

`slide.sidecarActions` is populated by DA-07 from an EXISTING sidecar. If the user is overwriting a sidecar, re-exporting `sidecarActions` as `actions:` preserves those entries. This is NOT action link extraction from the markdown body. R3 applies exclusively to inline `[Label](action:...)` links.

---

## Overwrite guard

If a `.deck.yaml` sibling already exists, a non-modal `showWarningMessage` prompt requires explicit "Overwrite" confirmation before proceeding. Dismissing the prompt aborts silently with no changes.

---

## Pure logic separation

`buildSidecarContent(deck: Deck): string` is exported as a pure function with no VS Code API imports. This enables unit testing without the extension host. The VS Code I/O layer (`extractMetadataToSidecar()`) is a thin wrapper that handles editor validation, file existence check, parse invocation, write, and open.

---

## Serialization

Uses `js-yaml` `dump()` — already a project dependency. Output is clean block-style YAML with `lineWidth: 120`. No hand-rolled serialization.
