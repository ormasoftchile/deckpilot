# Episode 00 — DeckPilot

<!-- id: intro-deckpilot -->

## Markdown as live content

What if your Markdown was not just documentation?

What if it could *run*?

What if it could present itself, guide onboarding, execute demos, and even produce videos?

---

<!-- id: markdown-live-content -->

Most Markdown today is static.

README files.  
Docs.  
Notes.

Useful — but passive.

DeckPilot explores a different idea:

Markdown as *live content*.

---

<!-- id: problem-technical-demos -->

## The problem with technical demos

Technical demos are fragile.

You switch windows.  
You search for files.  
You copy commands.  
You forget steps.  
Your environment drifts.  
Something breaks.

And onboarding documentation is often worse.

A new engineer follows a README manually, hoping every step still works.

Most teams compensate with:
- meetings
- walkthroughs
- tribal knowledge
- recorded videos that become outdated quickly

---

<!-- id: deckpilot-overview -->

## DeckPilot

DeckPilot is a VS Code extension for executable decks written in Markdown.

A deck is just a `.deck.md` file.

But unlike traditional slides, a DeckPilot deck can:
- open files
- highlight code
- run terminal commands
- launch debuggers
- validate setup steps
- guide onboarding interactively

The deck does not just *describe* the demo.

It drives it.

---

<!-- id: authoring -->

## Authoring

Decks are authored in Markdown.

Slides are separated with `---`.

```
# Intro

Welcome to the demo.

---

## Run tests

[Run tests](action:terminal.run?command=npm%20test)
```

---

<!-- id: structured-actions -->

Actions can also be expressed using structured YAML blocks:

```action
type: terminal.run
label: Run tests
command: npm test
```

This keeps decks readable while allowing richer automation.

---

<!-- id: sidecars -->

## Sidecars

As decks grow, operational metadata can move into a sidecar file.

```
demo.deck.md
demo.deck.yaml
```

The Markdown stays focused on content.

The sidecar stores:
- actions
- cues
- checkpoints
- onboarding metadata
- recording settings
- export configuration

This allows decks to scale without turning Markdown into noise.

---

<!-- id: presenting -->

## Presenting

DeckPilot presentations run directly inside VS Code.

Slides can:
- reveal fragments progressively
- navigate non-linearly
- restore IDE scenes
- undo demo actions
- drive the editor during the presentation

This keeps the presenter inside the real working environment.

No context switching.  
No fake screenshots.  
No disconnected slideware.

---

<!-- id: onboarding -->

## Onboarding

DeckPilot can also operate in onboarding mode.

A deck becomes a guided setup flow.

It can:
- validate commands
- check files
- wait for services
- restore checkpoints
- retry failed steps

Instead of static onboarding docs, teams can create executable onboarding experiences.

---

<!-- id: recording -->

## Recording

DeckPilot can auto-present a deck and export presentation artifacts.

A recording session can produce:
- MP4 video
- SRT subtitles
- narration scripts
- event timelines

Voice-over cues can be embedded directly into the deck:

```html
<!-- voice: Explain what this command does -->
```

This allows the same deck to become:
- a live presentation
- an onboarding flow
- a recorded technical walkthrough

---

<!-- id: sharing-web -->

## Sharing in the Web

Decks can also be rendered in the browser.

A lightweight viewer allows public sharing without requiring VS Code installation.

The same source deck can support:
- live presentation
- async reading
- onboarding
- recorded media
- browser-based viewing

One source.  
Multiple consumption modes.

---

<!-- id: ai-assisted-authoring -->

## AI-assisted authoring

DeckPilot also includes an `@deck` chat participant.

It can:
- generate decks
- convert Markdown into decks
- enrich decks with cues and actions
- assist with layouts and onboarding flows

But the goal is not to replace authorship.

The goal is to reduce friction when building executable content.

---

<!-- id: why-this-matters -->

## Why this matters

Most technical knowledge today exists in disconnected layers:
- code
- docs
- demos
- onboarding
- videos

They drift constantly.

DeckPilot explores the idea that these can converge into a single executable artifact.

A deck becomes:
- documentation
- presentation
- automation
- onboarding
- recording source

At the same time.

---

<!-- id: the-end -->

## The End

DeckPilot is an experiment in making Markdown operational.

Not just readable.

Executable.
