# Sidecar (`.deck.yaml`) Reference

The sidecar separates **operational metadata** (voice cues, timing, recording settings, hidden actions) from **slide content** in the `.deck.md`. Use it when the deck is being recorded or narrated — otherwise the `.deck.md` alone is enough.

## File pairing

A sidecar must be named `<base>.deck.yaml` next to the Markdown deck. Both
`my-talk.deck.md` and plain `my-talk.md` resolve to `my-talk.deck.yaml`:

```
my-talk.deck.md
my-talk.deck.yaml
```

Use the ID Deckpilot derives from each slide heading (`## Getting Started` becomes
`getting-started`). Explicit `<!-- id: ... -->` anchors are optional and only
needed when a slide has no useful heading-derived ID or must keep its ID after a
heading rename.
When a sidecar already exists, parse and merge it. Preserve unrelated deck,
item, scene, recording, export, and environment metadata.

## Schema

```yaml
deck:
  title: My Talk            # optional override; .deck.md frontmatter wins on conflict
  theme: dark

items:
  - id: intro               # matches an "Intro" heading slug
    cues:
      - Welcome the audience and frame the problem
      - Mention the 60-second teaser, then pause
    duration: 12s
    checkpoint: intro-end

  - id: setup
    actions:
      - type: terminal.run
        command: npm install
    cues:
      - Walk through dependency output, point out the lockfile commit
    duration: 18s

  - id: execution-demo
    cues:
      - Introduce the video clip
      - at: 8.5s
        text: Point out the updated output

recording:
  autoStart: false
  format: mp4

export:
  subtitles: true
  video: true
  srtFormat: srt
```

`items[]` is canonical for new decks and may reference either Markdown slides
or `:::video` item IDs. The legacy `slides[]` key remains supported.

## Field reference

### `deck`

| Field | Type | Notes |
|-------|------|-------|
| `title` | string | Optional. The `.deck.md` frontmatter title takes precedence. |
| `theme` | string | `dark` or `light`. |

### `items[]`

Each entry corresponds to a slide or video item by `id`.

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | **Required.** Must match the parsed slide ID, normally its heading slug. |
| `cues` | array | Ordered narration beats. Slides use strings for entry/fragment/action events. Videos use a first string plus `{ at, text }` timed cues. |
| `actions` | action[] | Same shape as inline actions. Rendered as interactive elements and driven by Auto-Pilot. |
| `duration` | string | Authored target duration (`8s`, `1m30s`). Stored as metadata; Auto-Pilot currently paces from cue word count instead. |
| `checkpoint` | string | Named checkpoint for retake/recovery during recording. |

### `recording`

These fields are parsed as deck metadata but do not currently configure or
start the external recorder. Configure `deckPilot.recording.*` in VS Code
settings and invoke a recording command explicitly.

| Field | Type | Notes |
|-------|------|-------|
| `autoStart` | bool | Begin recording when the deck opens. |
| `format` | string | `mp4` or `webm`. |

### `export`

These fields are parsed as deck metadata but do not currently suppress or
select exports. Stopping a recording exports all supported narration artifacts.

| Field | Type | Notes |
|-------|------|-------|
| `subtitles` | bool | Generate SRT/VTT from `cues`. |
| `srtFormat` | string | `srt` or `vtt`. |
| `video` | bool | Export the recorded video. |

## Authoring guidance

- Keep cues **short and spoken-style** — they become subtitles. One sentence per cue.
- Set `duration` only after at least one practice run — guessing produces bad pacing.
- Use `checkpoint` between major sections so retake recovery has clean cut points.
- `actions` in the sidecar become interactive presentation elements and are also driven by Auto-Pilot. They are not executed automatically when the slide loads.

## Validation checklist

After adding or changing cues:

1. Confirm the resolved companion `.deck.yaml` exists and parses as YAML.
2. Confirm every `items[].id` (or legacy `slides[].id`) resolves to a parsed slide or video item ID.
3. Confirm requested cues are present and unrelated sidecar metadata remains intact.
4. Run `Deckpilot: Validate Deck`.

## Extracting an existing deck to a sidecar

If the user has a `.deck.md` with inline actions and wants to "extract metadata":

1. Run `Deckpilot: Extract Metadata to Sidecar` command from the palette — the extension does this safely.
2. Or manually: add `<!-- id: ... -->` anchors to each slide, move actions into the sidecar's `slides[].actions[]`, and remove them from the `.deck.md`. Do not delete render directives or speaker notes.
