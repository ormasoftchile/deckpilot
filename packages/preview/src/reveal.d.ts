/**
 * Ambient types for reveal.js — the library ships no official type
 * declarations. The package OWNS these so its lifecycle code needs no `as`
 * casts (richer than a consumer stub: adds next/prev/getTotalSlides/getScale).
 *
 * IMPORTANT: exactly one `declare module 'reveal.js'` may exist per TypeScript
 * program (duplicate default exports otherwise). DeckPreview.tsx force-includes
 * this file via `/// <reference path="./reveal.d.ts" />`, and consumers (the
 * viewer) MUST NOT also declare `reveal.js` in their own env typings.
 */

declare module 'reveal.js' {
  export interface RevealConfig {
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
    overview?: boolean;
    view?: string;
    scrollActivationWidth?: number;
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
    getTotalSlides(): number;
    getScale(): number;
    next(): void;
    prev(): void;
    on(event: string, listener: (event: unknown) => void): void;
    off(event: string, listener: (event: unknown) => void): void;
    layout(): void;
    sync(): void;
  }
}

declare module 'reveal.js/dist/reveal.css';
declare module 'reveal.js/dist/theme/black.css';
