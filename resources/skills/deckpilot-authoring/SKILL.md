---
name: deckpilot-authoring
description: '**WORKFLOW SKILL** — Author Deckpilot presentations (`.deck.md` + optional `.deck.yaml` sidecar) for VS Code. USE FOR: creating a new deck from a topic/outline/description ("create a deck about X", "make slides for Y"); converting an existing Markdown file into a deck ("turn this README into a presentation"); enriching an existing deck with fragments, layouts, voice cues, narration, audio cues, executable actions, or a `.deck.yaml` sidecar ("add audio cues to this deck", "add narration to these slides", "add a demo step here", "wire this up to run npm test", "extract metadata to a sidecar"). DO NOT USE FOR: presenting/recording a deck (those are Deckpilot extension commands), editing slide prose the user already wrote (just edit it), generating standalone slides for tools other than Deckpilot (use Slidev/Marp/Reveal docs instead).'
---

# Deckpilot Authoring

Deckpilot decks are Markdown files split into slides by `#` or `##` headings.

## Keep the task narrow

- Use the named or attached file. For "this deck", use the active editor. If none exists, ask once.
- A plain `.md` is a deck when the user says it is. Never choose another deck because it already has a sidecar.
- Read only the target deck, its companion sidecar when present, and files explicitly needed by requested actions.
- Do not inspect Deckpilot's source code, tests, `package.json`, settings, or Git history to learn the format. This skill and its references are complete.
- Do not run repository-wide searches. Make only the requested edits.

## Load only what the task needs

- Narration/audio cues: use the recipe below; no reference file is needed.
- Actions: read `references/actions.md`.
- Layouts, fragments, scenes, or render directives: read `references/format.md`.
- New deck: read `references/format.md` and `references/examples/basic.deck.md`.
- Markdown conversion: read `references/format.md` and the source document.

## Add narration or audio cues

"Audio cues" means spoken narration unless the user explicitly asks for sound effects or audio files.

1. Read the target deck and only its companion sidecar: both `talk.md` and `talk.deck.md` use `talk.deck.yaml`.
2. Create or merge the `.deck.yaml`. Preserve unrelated sidecar metadata and existing cues.
3. Add concise spoken cues using heading-derived IDs: lowercase the heading, replace spaces with hyphens, and remove other punctuation.

```yaml
items:
  - id: introduction
    cues:
      - Introduce the topic.
```

Do not edit the Markdown to add ID anchors. An explicit `<!-- id: ... -->` is needed only when there is no useful heading or the ID must survive a heading rename. Timed video cues use `{ at: 2s, text: Explain this moment. }`.

Verify directly that the sidecar parses as YAML, every sidecar item ID matches a slide or video item ID, requested cues exist, and unrelated metadata remains. Report only validation failures; do not invoke or search for extension commands.

## Other edits

- Create decks as `<topic>.deck.md`; keep slides concise and add actions only for real workspace files or commands.
- Convert well-structured Markdown with a wrapper deck containing `content: ./source.md`; copy and restructure only when requested.
- Use `[Label](action:type?param=value)` for simple actions and an `action` fence for complex actions.
- Preserve existing prose, order, and style unless the user asks to change them.

Write files directly, validate once, and report the changed paths.
