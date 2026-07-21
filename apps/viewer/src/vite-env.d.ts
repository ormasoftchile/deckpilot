/// <reference types="vite/client" />

declare const __DECKPILOT_VERSION__: string;

// NOTE: the `reveal.js` module + reveal CSS ambient declarations now live in
// @deckpilot/preview (packages/preview/src/reveal.d.ts). <DeckPreview> pulls
// them into this program via a triple-slash reference, so redeclaring
// `reveal.js` here would create a duplicate default export. Do not re-add.

