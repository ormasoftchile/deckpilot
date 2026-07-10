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

# Slide 1 Title

Slide 1 content

# Slide 2 Title

Slide 2 content
```

- **Slides are separated by headings.** Every `#` (h1) or `##` (h2) starts a new slide — this is the default (`slideBreak: heading`, levels 1–2). Do **not** put a `---` between slides: a bare `---` is a *deprecated* separator and the parser emits a warning (`The `---` slide separator is deprecated`). Just start the next slide with a heading.
- Frontmatter is YAML delimited by `---` fences (this is the one place `---` is correct — it opens and closes the frontmatter block, nothing else). `title` is required. All other fields optional.
- `content: <path>` imports body Markdown from another file. Use this for "wrapper decks" — keep the prose in a plain `.md` (whose own `##` headings already delimit the slides) and wrap with thin frontmatter.

## Slide ID anchors

Add a hidden anchor to reference a slide from a sidecar or scene. Place it **after** the slide's heading — anything above the heading belongs to the previous slide, so an anchor placed before the heading is orphaned onto the wrong slide:

```markdown
# Setup

<!-- id: setup -->

Install dependencies…
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

> **Heading caveat:** A layout wrapper must **not** contain a slide-splitting heading (`#` or `##`). Those headings start a new slide, which splits the wrapper across two slides and orphans the opening comment. Inside a wrapper, use `###`+ (h3 and deeper) for headings. To give a slide a title, put the `#`/`##` heading first, then open the wrapper below it.

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

A **bullet/numbered list reveals in one step** (the list is a single block). To make each item reveal on its own step, add `<!-- .fragment-each -->` anywhere in the list:

```markdown
- First <!-- .fragment-each -->
- Then
- Finally
```

For finer control, put `<!-- .fragment -->` on individual items to fragment only those. Both accept an optional animation name, e.g. `<!-- .fragment-each slide-up -->`.

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

The first slide is just a leading heading. In the default heading mode the `#` starts slide 1 — don't wrap it in `<!-- center -->` (the heading would split out of the wrapper). Follow it with a subtitle and a call to advance:

```markdown
# Deckpilot

Live-code presentations inside VS Code.

Press **→** to start
```

## Anti-patterns

- Don't put YAML frontmatter on any slide except the first one.
- Don't put a `---` between slides — it's a deprecated separator that triggers a parser warning. Start the next slide with a `#`/`##` heading instead.
- Don't place `<!-- id: … -->` anchors or layout-open comments (`<!-- center -->`, `<!-- columns -->`, …) *above* a slide's heading. The heading starts a new slide and orphans them onto the previous slide — put them **after** the heading.
- Don't wrap a `#`/`##` heading inside a layout container — the heading splits the slide. Use `###`+ inside wrappers.
- Don't nest the same layout type (e.g. `<!-- center -->` inside `<!-- center -->`).
