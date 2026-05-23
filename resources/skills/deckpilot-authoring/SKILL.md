---
name: deckpilot-authoring
description: '**WORKFLOW SKILL** — Author Deckpilot presentations (`.deck.md` + optional `.deck.yaml` sidecar) for VS Code. USE FOR: creating a new deck from a topic/outline/description ("create a deck about X", "make slides for Y"); converting an existing Markdown file into a deck ("turn this README into a presentation"); enriching an existing deck with fragments, layouts, voice cues, executable actions, or a `.deck.yaml` sidecar ("add a demo step here", "wire this up to run npm test", "extract metadata to a sidecar"). DO NOT USE FOR: presenting/recording a deck (those are Deckpilot extension commands), editing slide prose the user already wrote (just edit it), generating standalone slides for tools other than Deckpilot (use Slidev/Marp/Reveal docs instead).'
---

# Deckpilot Authoring

Deckpilot turns Markdown into executable presentations inside VS Code. A deck is a `.deck.md` file split into slides by `---`. Buttons and inline links can open files, highlight code, run terminal commands, start debug sessions — orchestrating the real IDE during a talk.

This skill covers three workflows. Use the section that matches the user's intent.

## Before you write anything

1. **Read the references** colocated with this skill — they are the source of truth:
   - `references/format.md` — slide structure, frontmatter, layouts, fragments, scenes, render directives, speaker notes
   - `references/actions.md` — every action type with required/optional params and trust requirements
   - `references/sidecar.md` — `.deck.yaml` sidecar format
   - `references/examples/` — minimal real decks to copy patterns from
2. **Match an example.** Pick the example in `references/examples/` closest to the user's request and base your output on it. Few-shot patterns beat improvisation.
3. **Save in the workspace.** Decks belong in the workspace root or a `decks/` folder if one already exists. Never write outside the workspace.
4. **Validate when done.** After writing, suggest the user run the `Deckpilot: Validate Deck` command (or invoke it via `run_vscode_command` if available) — the parser is the final arbiter of correctness.

## Workflow: Create a new deck

Triggered by: "create a deck about X", "make a presentation for Y", "scaffold slides for Z".

1. **Clarify only if needed** — audience, length, whether it includes a live code demo. One concise question, then proceed.
2. **Pick slide count**: 5–9 for a lightning talk, 10–15 for a session. >20 is almost always wrong.
3. **Outline first** (bulleted), confirm unless the user said "just write it".
4. **Write the deck** — follow `references/format.md`, copy structure from `references/examples/basic.deck.md`.
5. **Add actions only if there is a real demo** in the workspace to point at. Don't fabricate `terminal.run` for a deck the user will present without the source repo.
6. **Save as `<topic-slug>.deck.md`**.

## Workflow: Convert an existing Markdown file

Triggered by: "convert this README to a deck", "turn this doc into a presentation", "make slides from this file".

1. **Identify the source.** The user must have attached or named a specific `.md` file — if ambiguous, ask. Do not guess from the active editor.
2. **Read the source** and outline its sections.
3. **Decide cut points.** Each `##` heading typically becomes a slide; long sections may need to be split or summarised. Bullet-heavy sections often need consolidation.
4. **Two options for the output:**
   - **Wrapper deck** (preferred when the source is well-structured prose): create `<source-name>.deck.md` containing only frontmatter + `content: ./<source-name>.md`. The deck inherits the Markdown body verbatim and splits on `---`. Insert `---` into the source where needed, OR ask the user if they want the wrapper to embed split markers.
   - **Standalone deck**: copy + restructure into a new `.deck.md`. Use when the source needs significant rewriting for pacing.
5. **Add layout containers** (`<!-- center -->` for title/section slides, `<!-- columns -->` to pair code with explanation) where they improve pacing.
6. **Save next to the source** as `<source-name>.deck.md`.

## Workflow: Enrich an existing deck

Triggered by: "add a terminal action here", "wire this slide up to run X", "extract metadata to a sidecar", "add fragments", "make this slide two columns", "add voice cues".

1. **Read the current deck.** Understand the existing structure before adding anything.
2. **Make minimal changes.** Insert exactly what the user asked for. Don't restyle, reorder, or rewrite prose they didn't touch.
3. **For actions:** use the inline link form `[Label](action:type?param=value)` for single buttons; use the fenced ` ```action ` block (YAML body) for multi-param or `sequence` actions. See `references/actions.md`.
4. **For voice cues, timing, or recording metadata**: these belong in a `.deck.yaml` **sidecar**, not in the `.deck.md`. If no sidecar exists, create one named exactly `<base>.deck.yaml` next to the deck and add `<!-- id: <slide-id> -->` comments to the matching slides. See `references/sidecar.md`.
5. **Trust-gated actions** (`terminal.run`, `debug.start`, `vscode.command`): warn the user once if the workspace is not yet trusted — these will be blocked at presentation time.

## Output conventions

- Write files directly. Use absolute paths.
- After writing, state the file path and one-line suggestion: *"Run `Deckpilot: Start Presentation` (Cmd+Shift+P) to preview."*
- Do not generate `.deck.yaml` unless the user asked for voice cues, timing, or recording metadata — or if you needed it for sidecar-only fields. Keep `.deck.md` self-contained when possible.

## Anti-patterns

- Don't dump an outline as one slide per bullet — group related bullets.
- Don't write speaker notes longer than slide content. Speaker notes use HTML comments: `<!-- talk track here -->`.
- Don't use `<!-- advanced -->` to hide things that should be cut.
- Don't add `terminal.run` actions that depend on files not in the user's workspace.
- Don't fabricate render targets — `render:file?path=...` paths must exist relative to `basePath` (deck frontmatter) or the deck file's directory.
- Don't ask the user to confirm format details that are documented in `references/`. Read the reference instead.
