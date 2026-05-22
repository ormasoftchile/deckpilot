# Deckpilot - GitHub Copilot Instructions

## Project Overview

Deckpilot is a VS Code extension that transforms Markdown-based presentations (`.deck.md` files) into executable narratives with interactive code demonstrations.

## Technology Stack

- **Language**: TypeScript 5.x (strict mode)
- **Platform**: VS Code Extension API 1.85+
- **Parser**: gray-matter (YAML frontmatter), markdown-it (Markdown rendering)
- **Testing**: @vscode/test-electron, Mocha
- **Architecture**: Three-Layer (Webview → Conductor → VS Code API)

## Core Architecture

```
Webview (Presentation UI)
    │ postMessage protocol
    ▼
Conductor Layer (Orchestration)
    │
    ├── Action Registry (executor dispatch)
    ├── State Stack (undo/redo, 50 max snapshots)
    └── Deck Parser (gray-matter + custom action links)
    │
    ▼
VS Code API Layer (window, workspace, debug, terminal)
```

## Repository Layout

This is an npm monorepo (workspaces). The VS Code extension and the web app share a `@deckpilot/core` package.

```
packages/
  core/        # @deckpilot/core — pure, platform-agnostic
    src/
      models/        # action, deck, slide, env, sidecar, recording, onboarding, snapshot, actionSchema
      parser/        # gray-matter / markdown-it parsing of .deck.md + sidecars
      env/           # env file loaders, resolver, scrubber, expander
      renderer/      # pure renderer pieces: renderDirectiveParser, blockElementRenderer
    dist/            # tsc output (referenced via package.json exports)
  extension/   # VS Code extension source (compiled to /out)
    src/
      extension.ts
      conductor/, actions/, browser/, chat/, commands/,
      providers/, recording/, renderer/ (vscode-coupled), validation/,
      webview/, utils/
  web/         # Vite-based public web app (work in progress)
    src/

test/          # unit + integration tests (stays at repo root)
out/           # compiled extension output (./out/packages/extension/src/extension.js)
```

The root `package.json` is the VS Code extension manifest; it depends on `@deckpilot/core` via npm workspaces. Extension code imports shared logic as:

```ts
import { parseDeck } from '@deckpilot/core/parser';
import type { Deck } from '@deckpilot/core/models/deck';
```

Core MUST NOT import from extension code. If a piece of logic needs `vscode`, `child_process`, or other VS Code-only APIs, it belongs in `packages/extension`.

## Key Files

- `packages/extension/src/extension.ts` - Extension entry point
- `packages/extension/src/conductor/conductor.ts` - Main orchestrator
- `packages/extension/src/conductor/stateStack.ts` - Undo/redo management
- `packages/extension/src/actions/registry.ts` - Action executor registry
- `packages/core/src/parser/deckParser.ts` - .deck.md file parser
- `packages/extension/src/webview/webviewProvider.ts` - Presentation UI

## Action Types

- `file.open` - Opens file in editor (no trust required)
- `editor.highlight` - Highlights lines (no trust required)
- `terminal.run` - Runs terminal command (requires Workspace Trust)
- `debug.start` - Starts debug session (requires Workspace Trust)
- `sequence` - Executes multiple actions in order

## Coding Standards

1. **Three-Layer Architecture**: Webview communicates only via postMessage to Conductor
2. **Action Registry**: All actions must go through ActionRegistry, never call VS Code APIs directly from Webview
3. **Stateful Demo Management**: Every navigation/action must capture state snapshot before execution
4. **Test-First**: Write tests before implementation
5. **Presentation-First UX**: Never block presentation flow with modal dialogs

## Message Protocol

Webview → Extension Host:
- `navigate`, `executeAction`, `undo`, `redo`, `close`, `ready`

Extension Host → Webview:
- `slideChanged`, `actionStatusChanged`, `deckLoaded`, `error`, `trustStatusChanged`

## Security Model

- Actions with `requiresTrust: true` blocked in untrusted workspaces
- Use `vscode.workspace.isTrusted` to check trust status
- Show user-friendly error when trust blocks action

## File Conventions

- Presentation files: `*.deck.md`
- Slide delimiter: `---` (horizontal rule)
- Action links: `[Label](action:type?param=value)`
