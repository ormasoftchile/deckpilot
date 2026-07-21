/// <reference types="vite/client" />

declare const __DECKPILOT_VERSION__: string;

// ─────────────────────────────────────────────────────────────────────────
// Reveal.js ambient augmentation — copied VERBATIM from apps/viewer so the
// imported viewer `DeckViewer` (with its mobile-hardened config: embedded,
// view, scrollActivationWidth, overview) typechecks under the editor's tsconfig.
// Phase 2 extraction into @deckpilot/preview will own this instead.
// ─────────────────────────────────────────────────────────────────────────
declare module 'reveal.js' {
  interface RevealConfig {
    hash?: boolean;
    embedded?: boolean;
    controls?: boolean;
    progress?: boolean;
    slideNumber?: boolean | string;
    transition?: string;
    history?: boolean;
    keyboard?: boolean;
    touch?: boolean;
    center?: boolean;
    width?: number | string;
    height?: number | string;
    margin?: number;
    minScale?: number;
    maxScale?: number;
    [key: string]: unknown;
  }

  export default class Reveal {
    constructor(element: HTMLElement, config?: RevealConfig);
    initialize(config?: RevealConfig): Promise<void>;
    destroy(): void;
    slide(h: number, v?: number, f?: number): void;
    getIndices(): { h: number; v: number; f?: number };
    on(event: string, listener: (event: unknown) => void): void;
    off(event: string, listener: (event: unknown) => void): void;
    layout(): void;
    sync(): void;
  }
}

declare module 'reveal.js/dist/reveal.css';
declare module 'reveal.js/dist/theme/black.css';
