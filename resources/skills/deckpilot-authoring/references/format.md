# Deck Format Reference

The full reference for `.deck.md` files. The parser in `@deckpilot/core/parser` is the final arbiter — when in doubt, run `Deckpilot: Validate Deck`.

## File anatomy

```markdown
---
title: "My Talk"           # required
basePath: ..                # optional — base for render:* and action paths (defaults to deck dir)
content: ./talk.md          # optional — import body from another file (overrides slides below)
scenes:                     # optional — named jump points
  - name: intro
    slide: 1
  - name: demo
    slide: 4
---

Slide 1 content

---

Slide 2 content
```

- Slides are separated by `---` on its own line (Markdown horizontal rule).
- Frontmatter is YAML. `title` is required. All other fields optional.
- `content: <path>` imports body Markdown from another file. Use this for "wrapper decks" — keep the prose in a plain `.md` and wrap with thin frontmatter.

## Slide ID anchors

Add a hidden anchor to reference a slide from a sidecar or scene:

```markdown
---
<!-- id: setup -->

# Setup
```

Slide IDs must be unique within a deck. They are referenced by `.deck.yaml` sidecar entries.

## Layout containers

Layouts are HTML comments that wrap a region of the slide. They nest.

| Layout | Purpose |
|--------|---------|
| `<!-- center -->...<!-- /center -->` | Vertically + horizontally centered. Use for title slides and section dividers. |
| `<!-- columns -->` with `<!-- left -->` / `<!-- right -->` inside | Two-column layout. Pair code with explanation. |
| `<!-- advanced -->...<!-- /advanced -->` | Collapsed by default; audience clicks to expand. Use for optional deep-dives. |
| `<!-- optional -->...<!-- /optional -->` | Visible but visually marked as skippable. |
| `<!-- group -->...<!-- /group -->` | Keeps adjacent blocks together when fragments are on. |

Example:

```markdown
<!-- columns -->
<!-- left -->
### Source
```ts
console.log("hi");
```
<!-- /left -->
<!-- right -->
### What it does
Prints a greeting.
<!-- /right -->
<!-- /columns -->
```

## Fragments

By default, **each block-level element on a slide reveals one step at a time** as the presenter presses `→`. Use `<!-- group -->` to reveal multiple blocks together. There is no opt-in marker — fragments are the default.

## Speaker notes

Use HTML comments at the bottom of a slide. They never render on the slide, but appear in the presenter view.

```markdown
# Setup

Install dependencies.

<!--
Mention the lockfile commit. Move quickly past this slide.
-->
```

## Render directives (live content)

Embed live files, diffs, or command output. Resolved at presentation time — no stale copy-paste.

| Directive | Example | Notes |
|-----------|---------|-------|
| `render:file` | `[](render:file?path=src/foo.ts&lines=1-20&format=typescript)` | Embeds file contents. `lines` and `format` optional. |
| `render:diff` | `[](render:diff?path=src/foo.ts&ref=HEAD~1)` | Shows git diff against `ref`. |
| `render:command` | `[](render:command?cmd=ls&args=-la)` | Runs command, embeds output. Use sparingly — runs every time the slide renders. |

Paths are resolved relative to `basePath` (frontmatter) or the deck file's directory.

## Scenes

Named jump points. Bound to `Cmd+R` in the presenter. Use for skipping ahead during Q&A or recovering from a derailed demo.

```yaml
scenes:
  - name: intro
    slide: 1
  - name: demo
    slide: 5
  - name: outro
    slide: 12
```

## Title slide convention

```markdown
<!-- center -->
# Deckpilot

### Live-code presentations inside VS Code

Press **→** to start
<!-- /center -->
```

## Anti-patterns

- Don't put YAML frontmatter on any slide except the first one.
- Don't nest the same layout type (e.g. `<!-- center -->` inside `<!-- center -->`).
- Don't use `---` inside fenced code blocks expecting it to be a slide break — it won't be (code blocks are protected).
- Don't put more than one `#` heading on a slide. Use `##` or split.
