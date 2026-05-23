# Sidecar (`.deck.yaml`) Reference

The sidecar separates **operational metadata** (voice cues, timing, recording settings, hidden actions) from **slide content** in the `.deck.md`. Use it when the deck is being recorded or narrated — otherwise the `.deck.md` alone is enough.

## File pairing

A sidecar must be named `<base>.deck.yaml` next to `<base>.deck.md`. Example:

```
my-talk.deck.md
my-talk.deck.yaml
```

The deck file must mark slides with `<!-- id: <slide-id> -->` anchors so the sidecar can reference them.

## Schema

```yaml
deck:
  title: My Talk            # optional override; .deck.md frontmatter wins on conflict
  theme: dark

slides:
  - id: intro               # matches <!-- id: intro --> in the .deck.md
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

recording:
  autoStart: false
  format: mp4

export:
  subtitles: true
  video: true
  srtFormat: srt
```

## Field reference

### `deck`

| Field | Type | Notes |
|-------|------|-------|
| `title` | string | Optional. The `.deck.md` frontmatter title takes precedence. |
| `theme` | string | `dark` or `light`. |

### `slides[]`

Each entry corresponds to a slide by `id`.

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | **Required.** Must match a `<!-- id: ... -->` anchor in the deck. |
| `cues` | string[] | Voice/talk-track lines. One per beat. |
| `actions` | action[] | Same shape as inline actions, but hidden from the slide UI. Use for `onEnter` automation. |
| `duration` | string | Target duration (`8s`, `1m30s`). Used by the auto-recorder. |
| `checkpoint` | string | Named checkpoint for retake/recovery during recording. |

### `recording`

| Field | Type | Notes |
|-------|------|-------|
| `autoStart` | bool | Begin recording when the deck opens. |
| `format` | string | `mp4` or `webm`. |

### `export`

| Field | Type | Notes |
|-------|------|-------|
| `subtitles` | bool | Generate SRT/VTT from `cues`. |
| `srtFormat` | string | `srt` or `vtt`. |
| `video` | bool | Export the recorded video. |

## Authoring guidance

- Keep cues **short and spoken-style** — they become subtitles. One sentence per cue.
- Set `duration` only after at least one practice run — guessing produces bad pacing.
- Use `checkpoint` between major sections so retake recovery has clean cut points.
- `actions` in the sidecar are for automation that should happen automatically (e.g. open a file when the slide loads). User-clickable buttons stay in the `.deck.md`.

## Extracting an existing deck to a sidecar

If the user has a `.deck.md` with inline actions and wants to "extract metadata":

1. Run `Deckpilot: Extract Metadata to Sidecar` command from the palette — the extension does this safely.
2. Or manually: add `<!-- id: ... -->` anchors to each slide, move actions into the sidecar's `slides[].actions[]`, and remove them from the `.deck.md`. Do not delete render directives or speaker notes.
