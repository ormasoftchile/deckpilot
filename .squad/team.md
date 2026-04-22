# Squad Team

> executable-talk

## Coordinator

| Name | Role | Notes |
|------|------|-------|
| Squad | Coordinator | Routes work, enforces handoffs and reviewer gates. |

## Members

| Name | Role | Charter | Status |
|------|------|---------|--------|
| Cervantes | Lead | .squad/agents/cervantes/charter.md | 🟢 Active |
| De Vega | Frontend Dev | .squad/agents/de-vega/charter.md | 🟢 Active |
| De Unamuno | Backend Dev | .squad/agents/de-unamuno/charter.md | 🟢 Active |
| Delibes | Tester | .squad/agents/delibes/charter.md | 🟢 Active |
| Cercas | Screen Recording Specialist | .squad/agents/cercas/charter.md | 🟢 Active |
| Scribe | Session Logger | .squad/agents/scribe/charter.md | 🟢 Active |
| Ralph | Work Monitor | .squad/agents/ralph/charter.md | 🟢 Active |

## PRD

- **Title:** Dual Authoring Model (Inline Deck + Sidecar)
- **Source:** Inline (pasted 2026-04-22)
- **Status:** Phase 1 complete (2026-06-12) — 788 tests passing
- **Summary:** Support two authoring modes — rich single-file `.deck.md` and basic Markdown + `.deck.yaml` sidecar — both compiling into one canonical runtime model. Three-phase MVP. Phase 1 (DA-01 through DA-18) ships the full parser pipeline, ID system, merge engine, validation layer, and file watcher.

## Project Context

- **Project:** executable-talk — VS Code extension that transforms .deck.md Markdown files into executable presentations
- **Owner:** ormasoftchile
- **Stack:** TypeScript 5.x, VS Code Extension API 1.85+, gray-matter, markdown-it, Mocha
- **Universe:** Spanish Literature
- **Created:** 2026-04-11
- **Focus:** Visual/theming, presentation rendering, video recording, subtitle production, automation
