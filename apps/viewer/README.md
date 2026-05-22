# @deckpilot/viewer

Public, read-only browser viewer for Deckpilot `.deck.md` presentations.

Paste any public `https://` deck URL into the viewer to render it — no VS Code,
no install, no auth.

```
https://viewer.example.com/?url=https://raw.githubusercontent.com/org/repo/main/demo.deck.md
```

## Key properties

- **Browser-only.** No backend, no database, no auth. Deploys as a pure static site.
- **Safe by design.** Actions (`terminal.run`, `debug.start`, `vscode.command`,
  `file.open`, etc.) are rendered as **disabled buttons**. They never execute.
- **Shares code with the extension.** Parsing, models, fragment/voice-cue
  extraction, and sidecar merging come from `@deckpilot/core` — the same package
  the VS Code extension uses.
- **Reveal.js** renders the slides with fragments, transitions, and keyboard nav.
- **Sanitized HTML.** Every slide is run through DOMPurify before rendering.
- **Sidecar discovery.** If `demo.deck.md` has a sibling `demo.deck.yaml`, it's
  auto-loaded and merged.
- **Deep links.** The current slide is reflected in the URL hash (`#slide=N`).

## Usage

```
https://your-host/?url=<public-deck-url>#slide=<n>
```

Supported sources (browser must receive permissive CORS headers — most public
static hosts do):

- GitHub raw URLs (`raw.githubusercontent.com`)
- Azure Blob / Static Web Apps
- GitHub Pages
- Any generic HTTPS static host

`http://` is rejected except for `localhost` / `127.0.0.1`. `file:`, `data:`,
`javascript:`, etc. are rejected outright.

## Architecture

```
apps/viewer/
  src/
    App.tsx                # routing between landing / loading / viewer / error
    components/            # Landing, DeckViewer, PresenterNotes, ErrorView
    lib/
      urlValidator.ts      # URL scheme / host allow-list + sidecar URL derivation
      deckLoader.ts        # fetch deck + optional sidecar, parse via @deckpilot/core
      sanitize.ts          # DOMPurify wrapper for slide HTML
      actionRenderer.ts    # rewrites `action:` anchors → disabled buttons
      hashRouter.ts        # #slide=N deep link sync
    stubs/                 # fs/path/gray-matter shims so @deckpilot/core runs in browser
```

Shared with the extension:

```
packages/core/             # @deckpilot/core — models, parser, env, renderer pieces
```

The viewer **deliberately bypasses** core's `parseDeck` (which calls into the
filesystem for sidecars and `.deck.env`) and instead calls `parseSlides` +
`mergeSidecarIntoSlides` directly after fetching everything over HTTP.

## Development

From the repo root:

```sh
npm install
npm run --workspace @deckpilot/viewer dev
```

This serves the viewer on http://localhost:5173. The sample deck is available
at http://localhost:5173/sample.deck.md.

## Production build

```sh
npm run --workspace @deckpilot/viewer build
```

Output lands in `apps/viewer/dist/` — a fully static, single-page bundle.

## Deployment

### Azure Static Web Apps (Free plan)

1. Create a Static Web App and connect it to this repo.
2. Configure build:
   - **App location:** `apps/viewer`
   - **Output location:** `dist`
   - **Api location:** *(leave blank — no backend needed)*
3. Azure SWA picks up [`staticwebapp.config.json`](./staticwebapp.config.json),
   which sets:
   - SPA fallback to `/index.html`
   - Strict CSP headers
   - Correct MIME types for `.deck.md` / `.deck.yaml`

### GitHub Pages

```sh
npm run --workspace @deckpilot/viewer build
# publish apps/viewer/dist/ to gh-pages branch
```

You'll need a `404.html` fallback if you want clean deep links — or simply
keep all routing in the URL query (`?url=...`) and hash (`#slide=N`), which
this viewer already does.

### Generic static hosting

Any host that can serve a directory of static files works (Netlify, Cloudflare
Pages, Vercel static, S3 + CloudFront, plain nginx). Ensure:

- SPA fallback routes `/` and unknown paths to `index.html` (or just rely on
  `?url=` query strings and skip path-based routing entirely).
- Files served with permissive CORS so external decks can be fetched.

## Security model

- All deck content is treated as **untrusted input**.
- Markdown is rendered via `markdown-it` (in `@deckpilot/core`).
- The resulting HTML is run through **DOMPurify** with `<script>`, `<iframe>`,
  inline event handlers, and other XSS vectors stripped.
- `action:` URIs are rewritten to disabled `<button>` elements *before*
  sanitization, so even if a deck contained a malicious anchor it would lose
  its `href`.
- The viewer never calls `eval`, never executes terminal commands, never
  invokes VS Code commands. There is no runtime that *could* — the action
  registry is not bundled into this app.
- A strict CSP is set via `staticwebapp.config.json` for Azure deployments.

## Non-goals

- Terminal execution, debug launching, VS Code APIs
- Auth, private repos, collaborative editing
- Server-side persistence
- TTS generation, recording

These belong in the VS Code extension.

## License

MIT — see repository root.
