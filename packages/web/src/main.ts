/**
 * Web host — equivalent of Conductor + WebviewProvider in the browser.
 *
 * Flow:
 *  1. Page loads → index.html defines window.acquireVsCodeApi (the stub)
 *  2. presentation.js runs, calls acquireVsCodeApi(), calls init()
 *  3. init() sends { type: 'ready' } via vscode.postMessage → captured by stub
 *     → dispatched as CustomEvent('webview-to-host') on window
 *  4. This module handles 'ready' by fetching + parsing the selected deck
 *     and sending a deckLoaded message back via window.postMessage
 *  5. presentation.js handles deckLoaded and renders the first slide
 *  6. Navigate messages are handled here and slideChanged is sent back
 */

import { parseDeck } from '../../../src/parser/deckParser';
import { injectBlockElements } from '../../../src/renderer/blockElementRenderer';
import type { Deck } from '../../../src/models/deck';
import type { Slide } from '../../../src/models/slide';

// ── Types ────────────────────────────────────────────────────────────────────

interface WebviewMessage {
  type: string;
  payload?: Record<string, unknown>;
  messageId?: string;
}

interface SlideData {
  index: number;
  content: string;
  hasActions: boolean;
  speakerNotes?: string;
  checkpoint?: string;
}

// ── State ────────────────────────────────────────────────────────────────────

let currentDeck: Deck | null = null;
let currentSlideIndex = 0;

// ── Messaging ────────────────────────────────────────────────────────────────

/** Send a message to presentation.js (host → webview direction) */
function sendToPresentation(msg: WebviewMessage): void {
  window.postMessage(msg, '*');
}

/** Receive messages from presentation.js (webview → host direction) */
window.addEventListener('webview-to-host', ((e: CustomEvent<WebviewMessage>) => {
  handleFromPresentation(e.detail);
}) as EventListener);

function handleFromPresentation(msg: WebviewMessage): void {
  switch (msg.type) {
    case 'ready':
      // presentation.js is ready; if a deck is already loaded, send it
      if (currentDeck) {
        sendDeckLoaded(currentDeck);
      }
      break;

    case 'navigate': {
      const { direction, slideIndex, showAllFragments } = msg.payload as {
        direction: 'next' | 'prev' | 'first' | 'last' | 'goto';
        slideIndex?: number;
        showAllFragments?: boolean;
      };
      if (!currentDeck) return;
      const total = currentDeck.slides.length;
      switch (direction) {
        case 'next':  currentSlideIndex = Math.min(currentSlideIndex + 1, total - 1); break;
        case 'prev':  currentSlideIndex = Math.max(currentSlideIndex - 1, 0); break;
        case 'first': currentSlideIndex = 0; break;
        case 'last':  currentSlideIndex = total - 1; break;
        case 'goto':  currentSlideIndex = Math.max(0, Math.min(slideIndex ?? 0, total - 1)); break;
      }
      sendSlideChanged(currentDeck, currentSlideIndex, showAllFragments);
      break;
    }

    case 'executeAction':
      // No-op in web viewer — actions are VS Code specific
      break;

    case 'close':
      // No-op in web viewer
      break;
  }
}

// ── Deck loading ─────────────────────────────────────────────────────────────

export async function loadDeck(filePath: string): Promise<void> {
  const indicator = document.getElementById('deck-loading-indicator');
  if (indicator) indicator.style.display = 'block';

  try {
    const res = await fetch(`/api/file?path=${encodeURIComponent(filePath)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const content = await res.text();

    const result = await parseDeck(content, filePath);
    if (!result.deck) {
      console.error('[web-host] Parse error:', result.error);
      sendToPresentation({
        type: 'error',
        payload: { message: result.error ?? 'Failed to parse deck' },
      });
      return;
    }

    currentDeck = result.deck;
    currentSlideIndex = 0;
    sendDeckLoaded(currentDeck);
  } catch (err) {
    console.error('[web-host] Failed to load deck:', err);
    sendToPresentation({
      type: 'error',
      payload: { message: String(err) },
    });
  } finally {
    if (indicator) indicator.style.display = 'none';
  }
}

function buildSlides(deck: Deck): SlideData[] {
  return deck.slides.map((slide: Slide, index: number) => ({
    index,
    content: injectBlockElements(slide.html, slide),
    hasActions: slide.onEnterActions.length > 0 || slide.interactiveElements.length > 0,
    speakerNotes: slide.speakerNotes,
    checkpoint: slide.checkpoint,
  }));
}

function sendDeckLoaded(deck: Deck): void {
  const slides = buildSlides(deck);
  const firstSlide = slides[0];
  sendToPresentation({
    type: 'deckLoaded',
    payload: {
      totalSlides: deck.slides.length,
      slides,
      slideHtml: firstSlide?.content ?? '',
      slideIndex: 0,
    },
  });
}

function sendSlideChanged(deck: Deck, index: number, showAllFragments?: boolean): void {
  const slides = buildSlides(deck);
  const slide = slides[index];
  sendToPresentation({
    type: 'slideChanged',
    payload: {
      slideIndex: index,
      totalSlides: deck.slides.length,
      slideHtml: slide?.content ?? '',
      showAllFragments: showAllFragments ?? false,
      navigationHistory: [],
      canGoBack: false,
      totalHistoryEntries: 0,
    },
  });
}

// ── Deck picker sidebar ───────────────────────────────────────────────────────

export async function initDeckPicker(): Promise<void> {
  const list = document.getElementById('deck-list');
  if (!list) return;

  let decks: string[] = [];
  try {
    const res = await fetch('/api/decks');
    decks = await res.json() as string[];
  } catch {
    list.innerHTML = '<li class="deck-picker-error">Could not load deck list</li>';
    return;
  }

  if (decks.length === 0) {
    list.innerHTML = '<li class="deck-picker-empty">No .deck.md files found</li>';
    return;
  }

  list.innerHTML = '';
  for (const deck of decks) {
    const li = document.createElement('li');
    li.className = 'deck-picker-item';
    li.textContent = deck.replace(/^.*\//, '').replace('.deck.md', '');
    li.title = deck;
    li.addEventListener('click', () => {
      document.querySelectorAll('.deck-picker-item').forEach(el => el.classList.remove('active'));
      li.classList.add('active');
      // Update URL for shareability / page refreshes
      const url = new URL(window.location.href);
      url.searchParams.set('deck', deck);
      window.history.pushState({}, '', url);
      void loadDeck(deck);
    });
    list.appendChild(li);
  }

  // Auto-load deck from URL param or first deck
  const urlDeck = new URLSearchParams(window.location.search).get('deck');
  const toLoad = urlDeck && decks.includes(urlDeck) ? urlDeck : decks[0];
  const autoItem = list.querySelector(`[title="${toLoad}"]`) as HTMLElement | null;
  autoItem?.classList.add('active');
  void loadDeck(toLoad);
}
