/**
 * PreviewPane — a persistent, in-place live deck preview.
 *
 * ## Why not `<DeckViewer key={version}>`?
 * The viewer's `<DeckViewer>` owns its Reveal lifecycle and re-initializes on
 * `[slides]`. Remounting it (via a `key`) on every debounced edit tore down and
 * rebuilt Reveal each keystroke: Reveal briefly re-initialized on slide 1 /
 * blank, then deep-linked back — the visible "flash of another slide then the
 * correct one". Remount-per-edit is the wrong pattern for a live editor.
 *
 * ## What this does instead
 * We host ONE persistent Reveal instance and update it IN PLACE:
 *   - Initialize Reveal ONCE (mount) with the viewer's mobile-hardened config
 *     carried VERBATIM (`embedded`, `scrollActivationWidth:0`, `view:'slide'`,
 *     `overview:false`) plus readiness gating against a 0-height stage.
 *   - On each debounced text change: re-parse → rebuild the `.slides` sections'
 *     innerHTML (sanitized + diagrams rendered) → `reveal.sync()` + `layout()`
 *     → re-run the Triton reveal-fragment init for new figures → CLAMP and
 *     restore the previous slide index. NO `reveal.destroy()`, NO `key` remount.
 *   - A parse error shows a non-destructive banner; the last good Reveal stays
 *     up so recovering from a transient bad edit never flashes.
 *
 * ## Zero-drift reuse
 * The render pipeline is imported from the viewer VERBATIM — sanitizer,
 * action-link rewriter, Triton diagram renderer, fragment runtime — and parsing
 * goes through `parseDeckFromText` (same `@deckpilot/core` parsers as the
 * viewer's `deckLoader`). The host also reuses the viewer's `.dp-viewer` /
 * `.dp-viewer-stage` CSS class names so the viewer stylesheet (imported in
 * `main.tsx`) styles the slides identically — fonts, action buttons, diagrams,
 * fragments — with nothing duplicated here.
 *
 * The editor manages the slide index INTERNALLY (no URL hash router): the editor
 * page owns its own URL, so the viewer's hash routing / NaN-hash guards are N/A
 * here and are deliberately not imported.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Reveal from 'reveal.js';
import 'reveal.js/dist/reveal.css';
import 'reveal.js/dist/theme/black.css';
import { sanitizeSlideHtml, unfragmentLeadingBlock } from '@viewer/lib/sanitize';
import { rewriteActionLinks } from '@viewer/lib/actionRenderer';
import { renderSlideDiagrams } from '@viewer/lib/tritonDiagramRenderer';
import { initializeTritonRevealFragments } from '@viewer/lib/tritonRevealRuntime';
import type { LoadedDeck } from '@viewer/lib/deckLoader';
import { parseDeckFromText, DeckParseError } from '../lib/parseDeckFromText';

interface PreviewPaneProps {
  text: string;
}

interface SlideHtml {
  index: number;
  html: string;
}

/**
 * Sync half of the viewer's `buildRenderedSlides` transform, replicated
 * VERBATIM (rewrite action links → sanitize → un-fragment the leading block).
 * The async diagram pass (`renderSlideDiagrams`) is applied separately.
 */
function buildSlideHtmlSync(loaded: LoadedDeck): SlideHtml[] {
  return loaded.deck.slides.map((slide) => {
    const transformed = rewriteActionLinks(slide.html ?? '');
    const safe = unfragmentLeadingBlock(sanitizeSlideHtml(transformed));
    return { index: slide.index, html: safe };
  });
}

/** Async diagram pass — mirrors the viewer's post-mount `renderSlideDiagrams` map. */
async function renderSlideDiagramsPass(loaded: LoadedDeck, base: SlideHtml[]): Promise<SlideHtml[]> {
  return Promise.all(
    base.map(async (s) => {
      const source = loaded.deck.slides[s.index];
      if (!source) return s;
      const html = await renderSlideDiagrams(s.html, source, loaded.deck);
      return { index: s.index, html };
    }),
  );
}

/** Serialize slide sections into the `.slides` container markup Reveal expects. */
function renderSectionsMarkup(slides: SlideHtml[]): string {
  return slides
    .map((s) => `<section data-slide-index="${s.index}">${s.html}</section>`)
    .join('');
}

function messageFor(err: unknown): string {
  if (err instanceof DeckParseError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Unknown parse error.';
}

// Reveal API surface not fully covered by the shipped typings.
type RevealExt = Reveal & {
  sync?: () => void;
  getTotalSlides?: () => number;
};

function currentIndex(reveal: RevealExt): number {
  try {
    const h = reveal.getIndices?.().h;
    return typeof h === 'number' && Number.isFinite(h) ? h : 0;
  } catch {
    return 0;
  }
}

function totalSlides(reveal: RevealExt): number {
  try {
    const n = reveal.getTotalSlides?.();
    return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 1;
  } catch {
    return 1;
  }
}

export function PreviewPane({ text }: PreviewPaneProps): JSX.Element {
  const stageRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null); // .reveal
  const slidesRef = useRef<HTMLDivElement>(null); // .slides (managed imperatively)
  const revealRef = useRef<RevealExt | null>(null);
  const revealReadyRef = useRef(false);
  // Most recently built slides — the choke point the ready handler re-applies if
  // content arrived while Reveal was still initializing.
  const latestSlidesRef = useRef<SlideHtml[] | null>(null);
  // Monotonic edit token so a slow async diagram render for edit N never clobbers
  // the newer edit N+1.
  const seqRef = useRef(0);

  const [parseError, setParseError] = useState<string | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);

  /**
   * The single DOM choke point. Writes section markup, re-runs the Triton
   * fragment init for any new figures, then — only if Reveal is already ready —
   * syncs in place and restores the (clamped) current slide. When Reveal is not
   * ready yet, the content is buffered and the init's ready handler applies it.
   */
  const applyToDom = useCallback((slides: SlideHtml[]): void => {
    latestSlidesRef.current = slides;
    const slidesEl = slidesRef.current;
    if (!slidesEl) return;

    slidesEl.innerHTML = renderSectionsMarkup(slides);

    // Fail-soft: fragment runtime throwing must not break the slide content.
    try {
      initializeTritonRevealFragments(slidesEl);
    } catch (err) {
      console.error('[editor-preview] initializeTritonRevealFragments failed', err);
    }

    const reveal = revealRef.current;
    if (!revealReadyRef.current || !reveal) return;

    // In-place update: preserve the CURRENT slide across the edit. Read the
    // index BEFORE sync, clamp to the (possibly shorter) new range AFTER.
    const prev = currentIndex(reveal);
    try {
      reveal.sync?.();
    } catch (err) {
      console.error('[editor-preview] reveal.sync failed', err);
    }
    const target = Math.min(Math.max(prev, 0), totalSlides(reveal) - 1);
    try {
      reveal.slide(target);
    } catch (err) {
      console.error('[editor-preview] reveal.slide restore failed', err);
    }
    try {
      reveal.layout();
    } catch (err) {
      console.error('[editor-preview] reveal.layout failed', err);
    }
  }, []);

  // ── Reveal lifecycle: initialize ONCE, destroy ONLY on unmount. ────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;
    let reveal: RevealExt | null = null;
    let startCalled = false;
    let initFrame = 0;
    let forceStartTimeout = 0;
    const layoutTimeouts: number[] = [];
    let resizeObserver: ResizeObserver | null = null;

    const safeLayout = (): void => {
      if (cancelled || !revealRef.current) return;
      try {
        revealRef.current.layout();
      } catch (err) {
        console.error('[editor-preview] reveal.layout failed', err);
      }
    };

    // iOS/flex layout can keep changing usable height briefly after ready — a
    // few settle-layouts let the computed scale catch up (carried from viewer).
    const scheduleSettleLayouts = (): void => {
      for (const delay of [150, 400, 900]) {
        layoutTimeouts.push(window.setTimeout(safeLayout, delay));
      }
    };

    const startReveal = (): void => {
      if (cancelled || startCalled) return;
      startCalled = true;
      try {
        reveal = new Reveal(el, {
          hash: false, // editor owns its own URL — no hash routing
          // Spike request: keep controls ON so Reveal's nav state is live, but
          // hide the arrows via CSS (see .dp-live-preview .controls). Keyboard
          // navigation stays available when the preview is focused.
          controls: true,
          progress: true,
          slideNumber: false,
          transition: 'slide',
          keyboard: true,
          touch: true,
          center: false,
          // ── Mobile-hardened config carried VERBATIM from the viewer ──
          embedded: true,
          // Reveal 5 auto-activates a "scroll view" below scrollActivationWidth
          // (default 435px) that recurses (layout → syncScrollPosition →
          // activatePage) inside React-managed sections. Force classic slide
          // view and disable the threshold so the deck is stable at any width.
          view: 'slide',
          scrollActivationWidth: 0,
          // Read-only preview: the Esc/'o' slide-grid overview renders broken
          // in embedded chrome.
          overview: false,
        }) as RevealExt;

        void reveal
          .initialize()
          .then(() => {
            if (cancelled || !reveal) return;
            revealRef.current = reveal;
            revealReadyRef.current = true;
            setFatalError(null);
            // Content may have been built while init was in flight — apply the
            // latest now (fragment-init + sync + index restore happen inside).
            if (latestSlidesRef.current) {
              applyToDom(latestSlidesRef.current);
            } else {
              safeLayout();
            }
            scheduleSettleLayouts();
          })
          .catch((err) => {
            console.error('[editor-preview] reveal.initialize failed', err);
            if (!cancelled) {
              revealReadyRef.current = false;
              setFatalError(err instanceof Error ? err.message : String(err));
            }
          });
      } catch (err) {
        console.error('[editor-preview] Reveal setup failed', err);
        if (!cancelled) {
          revealReadyRef.current = false;
          setFatalError(err instanceof Error ? err.message : String(err));
        }
      }
    };

    // Readiness gate: never init against a 0-height stage (scales every slide
    // into a 0px box — a silent universal blank). Defer until the stage reports
    // a real height, with a force-start backstop.
    if (el.clientHeight > 0) {
      startReveal();
    } else if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.height > 0) {
            resizeObserver?.disconnect();
            resizeObserver = null;
            startReveal();
            break;
          }
        }
      });
      resizeObserver.observe(el);
      forceStartTimeout = window.setTimeout(() => {
        if (cancelled || startCalled) return;
        resizeObserver?.disconnect();
        resizeObserver = null;
        startReveal();
      }, 1500);
    } else {
      initFrame = requestAnimationFrame(startReveal);
    }

    window.addEventListener('resize', safeLayout);
    window.addEventListener('orientationchange', safeLayout);
    const visualViewport = window.visualViewport;
    visualViewport?.addEventListener('resize', safeLayout);

    return () => {
      cancelled = true;
      if (initFrame) cancelAnimationFrame(initFrame);
      if (forceStartTimeout) window.clearTimeout(forceStartTimeout);
      for (const t of layoutTimeouts) window.clearTimeout(t);
      resizeObserver?.disconnect();
      resizeObserver = null;
      window.removeEventListener('resize', safeLayout);
      window.removeEventListener('orientationchange', safeLayout);
      visualViewport?.removeEventListener('resize', safeLayout);
      try {
        reveal?.destroy();
      } catch {
        // ignore double-destroy under StrictMode
      }
      revealRef.current = null;
      revealReadyRef.current = false;
    };
    // Mount-only: the persistent instance is created here and torn down solely
    // on unmount. `applyToDom` is ref-stable (useCallback []).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyToDom]);

  // ── Content: re-parse + apply IN PLACE on each debounced text change. ──────
  useEffect(() => {
    const seq = ++seqRef.current;

    let loaded: LoadedDeck;
    try {
      loaded = parseDeckFromText(text);
    } catch (err) {
      // Non-destructive: keep the last good Reveal up, just surface the error.
      setParseError(messageFor(err));
      return;
    }
    setParseError(null);

    // Fast paint with the sync transform, then swap in rendered diagrams.
    const base = buildSlideHtmlSync(loaded);
    applyToDom(base);

    void renderSlideDiagramsPass(loaded, base)
      .then((full) => {
        if (seq !== seqRef.current) return; // a newer edit superseded this one
        applyToDom(full);
      })
      .catch((err) => {
        console.error('[editor-preview] diagram render failed', err);
      });
  }, [text, applyToDom]);

  return (
    <div className="dp-viewer dp-live-preview">
      <div className="dp-viewer-stage" ref={stageRef}>
        <div className="reveal" ref={containerRef}>
          <div className="slides" ref={slidesRef} />
        </div>
        {parseError && (
          <div className="dp-live-preview-banner" role="status">
            {parseError}
          </div>
        )}
        {fatalError && (
          <div className="dp-live-preview-banner dp-live-preview-banner--error" role="alert">
            Preview failed to initialize: {fatalError}
          </div>
        )}
      </div>
    </div>
  );
}
