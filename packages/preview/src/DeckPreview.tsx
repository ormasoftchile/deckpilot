/// <reference path="./reveal.d.ts" />
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import Reveal from 'reveal.js';
import 'reveal.js/dist/reveal.css';
import 'reveal.js/dist/theme/black.css';
import './styles.css';
import type { Deck } from '@deckpilot/core/models/deck';
import { buildSlides, type RenderedSlide } from './buildSlides';
import { renderSlideDiagrams } from './diagramRenderer';
import { initializeTritonRevealFragments } from './tritonRevealRuntime';
import { readSlideFromHash, writeSlideToHash, onHashChange } from './hashRouter';

export interface DeckPreviewProps {
  /** The deck to render. Changing this reference triggers an in-place content sync. */
  deck: Deck;
  /** Extra class appended to the `.dp-viewer-stage` root. */
  className?: string;
  /**
   * Read/write `#slide=N` deep links. Default true (the public viewer). The
   * editor passes false so the URL hash is never touched. Reveal itself always
   * runs with `hash:false` — routing is layered on top via the hashRouter.
   */
  enableHashRouting?: boolean;
  /** Overlay chrome rendered inside the stage (e.g. an on-canvas nav). */
  children?: ReactNode;
  /** Fires whenever the active slide index changes (nav, tap, keyboard, hash). */
  onIndexChange?: (index: number) => void;
  /** Fires when slide metadata (title/notes/cues) is (re)built — once per deck. */
  onSlidesChange?: (slides: RenderedSlide[]) => void;
  /** Fires when the underlying Reveal instance becomes ready / is torn down. */
  onReadyChange?: (ready: boolean) => void;
}

export interface DeckPreviewHandle {
  goToSlide(index: number): void;
  next(): void;
  prev(): void;
  getIndex(): number;
  getTotalSlides(): number;
  isReady(): boolean;
  toggleDiagnostics(force?: boolean): void;
  /** Replace the deck content in place (no Reveal teardown). */
  updateContent(deck: Deck): void;
}

function renderSectionsHtml(slides: RenderedSlide[]): string {
  // `s.html` is already sanitized by buildSlides / renderSlideDiagrams.
  return slides
    .map((s) => `<section data-slide-index="${s.index}">${s.html}</section>`)
    .join('');
}

async function renderDiagramsForAll(built: RenderedSlide[], deck: Deck): Promise<RenderedSlide[]> {
  return Promise.all(
    built.map(async (rendered) => {
      const sourceSlide = deck.slides[rendered.index];
      if (!sourceSlide) {
        return rendered;
      }
      const html = await renderSlideDiagrams(rendered.html, sourceSlide, deck);
      return { ...rendered, html };
    }),
  );
}

function formatRevealError(err: unknown): string {
  if (err instanceof Error) {
    return err.stack || err.message;
  }
  return String(err);
}

export const DeckPreview = forwardRef<DeckPreviewHandle, DeckPreviewProps>(function DeckPreview(
  { deck, className, enableHashRouting = true, children, onIndexChange, onSlidesChange, onReadyChange },
  ref,
): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const slidesRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef<Reveal | null>(null);
  const revealReadyRef = useRef(false);
  const initPhaseRef = useRef('mount');
  const mountedRef = useRef(false);
  // Latest slide metadata + index, kept in refs so the persistent Reveal
  // instance and async diagram pass read current values without re-subscribing.
  const slidesDataRef = useRef<RenderedSlide[]>([]);
  const currentIndexRef = useRef(enableHashRouting ? readSlideFromHash() : 0);
  // Latest deck + callbacks + routing flag, refreshed every render so the
  // mount-once effect and stable callbacks never close over stale values.
  const deckRef = useRef(deck);
  const enableHashRoutingRef = useRef(enableHashRouting);
  const callbacksRef = useRef({ onIndexChange, onSlidesChange, onReadyChange });
  // Reference-identity guard so the [deck] update effect fires ONLY on a real
  // deck change — not on mount and not on a StrictMode double-invoke (refs
  // persist across the re-run, so a naive mountedRef guard would misfire).
  const prevDeckRef = useRef(deck);
  // Monotonic sequence so a slow diagram pass from a superseded deck is ignored.
  const seqRef = useRef(0);
  // Pointer-gesture tracker so tap-to-advance only fires on a DELIBERATE TAP,
  // never on a swipe/drag/scroll. On touch, a swipe ends in a synthetic click;
  // without this the deck would advance while the user is just sliding a finger.
  const gestureRef = useRef<{
    startX: number;
    startY: number;
    startTime: number;
    moved: boolean;
    multiTouch: boolean;
  } | null>(null);

  const [currentIndex, setCurrentIndex] = useState(() => (enableHashRouting ? readSlideFromHash() : 0));
  const [revealError, setRevealError] = useState<string | null>(null);
  const [revealReady, setRevealReady] = useState(false);
  const [initPhase, setInitPhase] = useState('mount');
  const [showDiag, setShowDiag] = useState(false);
  const [diagDismissed, setDiagDismissed] = useState(false);

  // Refresh latest values each render (read by refs above).
  deckRef.current = deck;
  enableHashRoutingRef.current = enableHashRouting;
  callbacksRef.current = { onIndexChange, onSlidesChange, onReadyChange };

  const setPhase = (phase: string): void => {
    initPhaseRef.current = phase;
    setInitPhase(phase);
  };

  // ---- Stable, ref-reading primitives (identity never changes) ----

  const injectSections = useCallback((built: RenderedSlide[]) => {
    if (slidesRef.current) {
      slidesRef.current.innerHTML = renderSectionsHtml(built);
    }
  }, []);

  const applyFragments = useCallback(() => {
    const root = containerRef.current;
    if (!root) return;
    // Fail-soft: a throw here must not blank the deck — worst case fragments
    // are skipped but slide content still shows.
    try {
      initializeTritonRevealFragments(root);
    } catch (err) {
      console.error('[preview] initializeTritonRevealFragments failed', err);
    }
  }, []);

  const safeLayout = useCallback(() => {
    if (!mountedRef.current || !revealRef.current) return;
    try {
      revealRef.current.layout();
    } catch (err) {
      console.error('[preview] reveal.layout failed', err);
    }
  }, []);

  const applyContentSync = useCallback(
    (built: RenderedSlide[], notify: boolean) => {
      slidesDataRef.current = built;
      injectSections(built);
      applyFragments();
      if (notify) {
        callbacksRef.current.onSlidesChange?.(built);
      }
    },
    [injectSections, applyFragments],
  );

  const syncRevealToCurrent = useCallback(() => {
    const reveal = revealRef.current;
    if (!revealReadyRef.current || !reveal) return;
    const total = slidesDataRef.current.length;
    const idx = Math.min(Math.max(currentIndexRef.current, 0), Math.max(total - 1, 0));
    try {
      reveal.sync();
      reveal.slide(idx);
    } catch (err) {
      console.error('[preview] reveal.sync/slide failed', err);
    }
    safeLayout();
  }, [safeLayout]);

  const runDiagramPass = useCallback(
    (targetDeck: Deck, built: RenderedSlide[]) => {
      const seq = (seqRef.current += 1);
      void renderDiagramsForAll(built, targetDeck).then((next) => {
        if (!mountedRef.current || seq !== seqRef.current) return;
        slidesDataRef.current = next;
        injectSections(next);
        applyFragments();
        // Diagram resolution changes only slide HTML, not title/notes/cues, so
        // we DO NOT re-notify onSlidesChange (host metadata is unchanged).
        syncRevealToCurrent();
      });
    },
    [injectSections, applyFragments, syncRevealToCurrent],
  );

  const updateContent = useCallback(
    (nextDeck: Deck) => {
      deckRef.current = nextDeck;
      const built = buildSlides(nextDeck);
      applyContentSync(built, true);
      syncRevealToCurrent();
      runDiagramPass(nextDeck, built);
    },
    [applyContentSync, syncRevealToCurrent, runDiagramPass],
  );

  const goToSlide = useCallback((index: number) => {
    const total = slidesDataRef.current.length;
    if (total === 0) return;
    const nextIndex = Math.min(Math.max(index, 0), total - 1);
    // Eagerly update index so counters + button state stay responsive even if
    // Reveal's slidechanged event is delayed (iOS Safari).
    setCurrentIndex(nextIndex);
    currentIndexRef.current = nextIndex;
    callbacksRef.current.onIndexChange?.(nextIndex);
    if (revealReadyRef.current && revealRef.current) {
      // Navigate; slidechanged reconciles the index and writes the hash once
      // (no eager hash write here — that re-triggered onHashChange -> double nav).
      revealRef.current.slide(nextIndex);
      return;
    }
    if (enableHashRoutingRef.current) {
      writeSlideToHash(nextIndex);
    }
  }, []);

  const next = useCallback(() => {
    if (revealReadyRef.current && revealRef.current) {
      revealRef.current.next();
      return;
    }
    goToSlide(currentIndexRef.current + 1);
  }, [goToSlide]);

  const prev = useCallback(() => {
    if (revealReadyRef.current && revealRef.current) {
      revealRef.current.prev();
      return;
    }
    goToSlide(currentIndexRef.current - 1);
  }, [goToSlide]);

  // Initialize Reveal ONCE. Content changes are synced in place (never a
  // destroy/recreate), so the persistent instance survives deck updates.
  useEffect(() => {
    mountedRef.current = true;
    const el = containerRef.current;
    if (!el) return;

    revealReadyRef.current = false;
    setRevealReady(false);
    callbacksRef.current.onReadyChange?.(false);
    setRevealError(null);
    setPhase('mount');
    setShowDiag(false);
    setDiagDismissed(false);

    // Build + inject the initial content synchronously so Reveal initializes
    // against real DOM. Diagrams resolve asynchronously below and are synced in
    // place — Reveal is NEVER re-created for a content change.
    const built = buildSlides(deckRef.current);
    applyContentSync(built, true);

    let reveal: Reveal | null = null;
    let cancelled = false;
    let initFrame = 0;
    let layoutFrame = 0;
    let watchdogTimeout = 0;
    let forceStartTimeout = 0;
    let contentDiagTimeout = 0;
    let startCalled = false;
    const layoutTimeouts: number[] = [];
    let resizeObserver: ResizeObserver | null = null;

    const scheduleSettleLayouts = (): void => {
      layoutFrame = requestAnimationFrame(safeLayout);
      for (const delay of [150, 400, 900]) {
        layoutTimeouts.push(window.setTimeout(safeLayout, delay));
      }
    };

    const checkForZeroSizeContent = (): void => {
      if (cancelled || !revealReadyRef.current) return;
      const presentRect = containerRef.current?.querySelector('.slides section.present')?.getBoundingClientRect();
      const slidesRect = containerRef.current?.querySelector('.slides')?.getBoundingClientRect();
      const rect = presentRect ?? slidesRect;
      if (rect && (rect.width < 4 || rect.height < 4)) {
        setShowDiag(true);
      }
    };

    const wireEvents = (instance: Reveal): void => {
      const total = slidesDataRef.current.length;
      const initial = enableHashRoutingRef.current ? readSlideFromHash() : 0;
      const target = Math.min(Math.max(initial, 0), Math.max(total - 1, 0));
      // ALWAYS activate the initial slide so a `.present` section exists after
      // ready — including the cold-load target=0 case. We cannot rely on
      // Reveal's internal init-time activation (readURL -> slide(0)) surviving:
      // the async diagram pass re-injects the section HTML in place, detaching
      // the node Reveal marked `.present`. If that re-injection resolves before
      // the `ready` event, syncRevealToCurrent() early-returns (not ready yet),
      // so an explicit activation here is the only thing that repaints present
      // on the live sections. reveal.slide() -> updateSlides() re-applies the
      // present/past/future classes even when the index is unchanged. Deep
      // links (#slide=N) land on their target the same way.
      instance.slide(target);
      const handleChange = (): void => {
        const idx = instance.getIndices().h;
        setCurrentIndex(idx);
        currentIndexRef.current = idx;
        callbacksRef.current.onIndexChange?.(idx);
        if (enableHashRoutingRef.current) writeSlideToHash(idx);
      };
      instance.on('ready', safeLayout);
      instance.on('slidechanged', () => {
        handleChange();
        safeLayout();
      });
      handleChange();
    };

    const startReveal = (): void => {
      if (cancelled || startCalled) return;
      startCalled = true;
      setPhase('startReveal');
      try {
        reveal = new Reveal(el, {
          hash: false, // routing is layered on top via hashRouter to keep ?url= intact
          // Reveal 5 with controls:false skips building its control DOM
          // (controlsLeft et al.), then throws "controlsLeft is not iterable"
          // on the first .slide() call. We keep controls:true and hide the
          // built controls via CSS (`.reveal .controls { display:none }`) — the
          // chrome supplies its own nav, so this is visibly identical.
          controls: true,
          progress: true,
          slideNumber: false,
          transition: 'slide',
          keyboard: true,
          touch: true,
          center: false,
          embedded: true,
          // Reveal 5 auto-activates its "scroll view" below scrollActivationWidth
          // (default 435px). That scroll mode is incompatible with the custom
          // chrome + injected sections and triggers infinite recursion
          // (layout -> syncScrollPosition -> activatePage) on narrow / mobile
          // viewports. Force classic slide view and disable the auto scroll-mode
          // threshold so the deck stays stable at every width.
          view: 'slide',
          scrollActivationWidth: 0,
          // Read-only preview: disable the Esc/'o' slide-grid overview. It's a
          // presenter feature (tiny tiles, hidden fragments) that renders broken
          // inside the custom chrome.
          overview: false,
        });
        setPhase('constructed');
        setPhase('initialize-called');
        void reveal
          .initialize()
          .then(() => {
            if (cancelled || !reveal) return;
            revealRef.current = reveal;
            revealReadyRef.current = true;
            setRevealReady(true);
            callbacksRef.current.onReadyChange?.(true);
            setPhase('ready');
            if (watchdogTimeout) {
              window.clearTimeout(watchdogTimeout);
              watchdogTimeout = 0;
            }
            setShowDiag(false);
            wireEvents(reveal);
            // iOS Safari can keep changing the usable viewport height for a
            // short period after Reveal reports ready. Re-layout through the
            // settle window so the computed scale catches up to real height.
            scheduleSettleLayouts();
            contentDiagTimeout = window.setTimeout(checkForZeroSizeContent, 1000);
          })
          .catch((err) => {
            console.error('[preview] reveal.initialize failed', err);
            if (!cancelled) {
              const message = formatRevealError(err);
              revealReadyRef.current = false;
              setRevealReady(false);
              callbacksRef.current.onReadyChange?.(false);
              setPhase(`initialize-error: ${message}`);
              setRevealError(message);
              setDiagDismissed(false);
            }
          });
      } catch (err) {
        console.error('[preview] Reveal setup failed', err);
        if (!cancelled) {
          const message = formatRevealError(err);
          revealReadyRef.current = false;
          setRevealReady(false);
          callbacksRef.current.onReadyChange?.(false);
          setPhase(`setup-error: ${message}`);
          setRevealError(message);
          setDiagDismissed(false);
        }
      }
    };

    const forceStartReveal = (): void => {
      if (cancelled || startCalled || revealReadyRef.current) return;
      resizeObserver?.disconnect();
      resizeObserver = null;
      startReveal();
    };

    watchdogTimeout = window.setTimeout(() => {
      if (!revealReadyRef.current) {
        setShowDiag(true);
      }
    }, 1800);

    // Guard against 0-height init: on iOS the flex stage can measure 0px at the
    // instant Reveal reads clientHeight, which scales every slide into a
    // 0-height box (universal blank, no thrown error). Defer until the stage
    // reports a real height.
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
      // Fallback in case the observer never fires with a non-zero height.
      initFrame = requestAnimationFrame(() => {
        if (cancelled || revealReadyRef.current) return;
        if (el.clientHeight > 0) {
          resizeObserver?.disconnect();
          resizeObserver = null;
          startReveal();
        }
      });
      forceStartTimeout = window.setTimeout(forceStartReveal, 1500);
    } else {
      initFrame = requestAnimationFrame(() => {
        if (cancelled || revealReadyRef.current) return;
        if (el.clientHeight > 0) {
          startReveal();
        }
      });
      forceStartTimeout = window.setTimeout(forceStartReveal, 1500);
    }

    // External hash changes (deep link refresh, manual edits) drive reveal.
    let unsubscribeHash = (): void => {};
    if (enableHashRoutingRef.current) {
      unsubscribeHash = onHashChange((idx) => {
        const total = slidesDataRef.current.length;
        const clamped = Math.min(Math.max(idx, 0), Math.max(total - 1, 0));
        setCurrentIndex(clamped);
        currentIndexRef.current = clamped;
        callbacksRef.current.onIndexChange?.(clamped);
        if (revealReadyRef.current && revealRef.current && revealRef.current.getIndices().h !== clamped) {
          revealRef.current.slide(clamped);
        }
      });
    }

    // Re-layout on viewport changes — iOS toolbar show/hide, rotation, and
    // visual-viewport resizes all change the usable height after init.
    window.addEventListener('resize', safeLayout);
    window.addEventListener('orientationchange', safeLayout);
    const visualViewport = window.visualViewport;
    visualViewport?.addEventListener('resize', safeLayout);
    const stage = stageRef.current;
    stage?.addEventListener('touchend', safeLayout, { once: true, passive: true });

    // Resolve diagrams asynchronously now that the DOM + lifecycle are wired.
    runDiagramPass(deckRef.current, built);

    return () => {
      mountedRef.current = false;
      cancelled = true;
      if (initFrame) cancelAnimationFrame(initFrame);
      if (layoutFrame) cancelAnimationFrame(layoutFrame);
      if (watchdogTimeout) window.clearTimeout(watchdogTimeout);
      if (forceStartTimeout) window.clearTimeout(forceStartTimeout);
      if (contentDiagTimeout) window.clearTimeout(contentDiagTimeout);
      for (const timeout of layoutTimeouts) window.clearTimeout(timeout);
      resizeObserver?.disconnect();
      resizeObserver = null;
      window.removeEventListener('resize', safeLayout);
      window.removeEventListener('orientationchange', safeLayout);
      visualViewport?.removeEventListener('resize', safeLayout);
      stage?.removeEventListener('touchend', safeLayout);
      unsubscribeHash();
      try {
        reveal?.destroy();
      } catch {
        // ignore double-destroy in StrictMode
      }
      revealRef.current = null;
      revealReadyRef.current = false;
      setRevealReady(false);
      callbacksRef.current.onReadyChange?.(false);
    };
    // Deps are all stable useCallbacks — this effect runs exactly once (twice
    // under StrictMode, guarded by the destroy() cleanup).
  }, [applyContentSync, runDiagramPass, safeLayout]);

  // In-place content sync on a real deck-reference change (skips mount +
  // StrictMode re-run: prevDeckRef persists across both).
  useEffect(() => {
    if (prevDeckRef.current === deck) return;
    prevDeckRef.current = deck;
    updateContent(deck);
  }, [deck, updateContent]);

  useImperativeHandle(
    ref,
    () => ({
      goToSlide,
      next,
      prev,
      getIndex: () => currentIndexRef.current,
      getTotalSlides: () => slidesDataRef.current.length,
      isReady: () => revealReadyRef.current,
      toggleDiagnostics: (force?: boolean) => {
        setDiagDismissed(false);
        setShowDiag((v) => force ?? !v);
      },
      updateContent,
    }),
    [goToSlide, next, prev, updateContent],
  );

  const totalSlides = slidesDataRef.current.length;
  const clampedIndex = Math.min(Math.max(currentIndex, 0), Math.max(totalSlides - 1, 0));

  // Tap discrimination thresholds. A tap advances only if the pointer barely
  // moved and lifted quickly; anything larger/slower is a swipe/drag/scroll.
  const TAP_MOVE_THRESHOLD = 10; // px of movement allowed for a tap
  const TAP_MAX_DURATION = 500; // ms between pointer down and up for a tap

  const handleStagePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    // Ignore non-left mouse buttons; touch/pen always report button 0.
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const active = gestureRef.current;
    if (active) {
      // A second concurrent pointer means a pinch/zoom/multi-touch gesture —
      // never a tap. Disqualify the in-flight gesture.
      active.multiTouch = true;
      active.moved = true;
      return;
    }
    gestureRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startTime: event.timeStamp,
      moved: false,
      multiTouch: false,
    };
  };

  const handleStagePointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const g = gestureRef.current;
    if (!g || g.moved) return;
    const dx = event.clientX - g.startX;
    const dy = event.clientY - g.startY;
    if (dx * dx + dy * dy > TAP_MOVE_THRESHOLD * TAP_MOVE_THRESHOLD) {
      // Moved past the tap threshold: this is a swipe/drag, not a tap.
      g.moved = true;
    }
  };

  const handleStagePointerCancel = (): void => {
    // Scroll / gesture takeover cancels the pointer — never treat as a tap.
    const g = gestureRef.current;
    if (g) g.moved = true;
  };

  const handleStageClick = (event: MouseEvent<HTMLDivElement>): void => {
    // Consume the gesture recorded by the preceding pointer sequence. The
    // synthetic click that trails a touch swipe is suppressed here because the
    // gesture is flagged `moved` (so we return before advancing).
    const g = gestureRef.current;
    gestureRef.current = null;

    const target = event.target;
    if (!(target instanceof Element)) return;
    if (
      target.closest(
        'a,button,.dp-action,[data-action],.dp-viewer-bar,.dp-viewer-nav,.dp-notes',
      )
    ) {
      return;
    }

    // Only a deliberate tap advances. If a pointer gesture was tracked, require
    // it to be a clean single-pointer tap: little movement AND short duration.
    if (g) {
      if (g.moved || g.multiTouch) return;
      const duration = event.timeStamp - g.startTime;
      if (duration > TAP_MAX_DURATION) return;
      // Backstop distance check against the click coordinates, in case a mouse
      // drag produced no intermediate pointermove between down and click.
      const dx = event.clientX - g.startX;
      const dy = event.clientY - g.startY;
      if (dx * dx + dy * dy > TAP_MOVE_THRESHOLD * TAP_MOVE_THRESHOLD) return;
    }
    // If g is null (e.g. a click with no preceding pointerdown), treat it as a
    // benign tap and fall through — desktop mouse clicks land here with g set.

    const rect = event.currentTarget.getBoundingClientRect();
    const previousZone = event.clientX - rect.left < rect.width * 0.25;
    if (revealReadyRef.current && revealRef.current) {
      if (previousZone) {
        revealRef.current.prev();
      } else {
        revealRef.current.next();
      }
      return;
    }
    goToSlide(previousZone ? currentIndexRef.current - 1 : currentIndexRef.current + 1);
  };

  const buildDiagnosticLines = (): string[] => {
    const slidesRect = containerRef.current?.querySelector('.slides')?.getBoundingClientRect();
    const presentRect = containerRef.current?.querySelector('.slides section.present')?.getBoundingClientRect();
    const computedRevealHeight =
      containerRef.current && typeof window !== 'undefined'
        ? window.getComputedStyle(containerRef.current).height
        : 'n/a';
    return [
      `phase: ${initPhase}`,
      `revealReady: ${revealReady}`,
      `revealError: ${revealError ?? 'none'}`,
      `slides: ${totalSlides}`,
      `currentIndex / clampedIndex: ${currentIndex} / ${clampedIndex}`,
      `container (.reveal) WxH: ${containerRef.current?.clientWidth ?? 'n/a'} x ${containerRef.current?.clientHeight ?? 'n/a'}`,
      `stage WxH: ${stageRef.current?.clientWidth ?? 'n/a'} x ${stageRef.current?.clientHeight ?? 'n/a'}`,
      `window.innerHeight: ${typeof window !== 'undefined' ? window.innerHeight : 'n/a'}`,
      `visualViewport.height: ${typeof window !== 'undefined' ? window.visualViewport?.height ?? 'n/a' : 'n/a'}`,
      `100dvh supported: ${typeof CSS !== 'undefined' && CSS.supports?.('height', '100dvh') ? 'true' : 'false'}`,
      `.slides section count in DOM: ${containerRef.current?.querySelectorAll('.slides > section').length ?? 'n/a'}`,
      `reveal totalSlides (if ready): ${
        revealReadyRef.current ? revealRef.current?.getTotalSlides() ?? 'n/a' : 'n/a'
      }`,
      `reveal scale: ${revealRef.current?.getScale() ?? 'n/a'}`,
      `.slides rect WxH: ${slidesRect ? `${slidesRect.width} x ${slidesRect.height}` : 'n/a'}`,
      `present section rect WxH: ${presentRect ? `${presentRect.width} x ${presentRect.height}` : 'none'}`,
      `.reveal computed height: ${computedRevealHeight}`,
    ];
  };

  return (
    <div
      className={`dp-viewer-stage${className ? ` ${className}` : ''}`}
      ref={stageRef}
      onPointerDown={handleStagePointerDown}
      onPointerMove={handleStagePointerMove}
      onPointerUp={handleStagePointerMove}
      onPointerCancel={handleStagePointerCancel}
      onClick={handleStageClick}
    >
      <div className="reveal" ref={containerRef}>
        <div className="slides" ref={slidesRef} />
      </div>

      {revealError && (
        <div
          role="alert"
          style={{
            position: 'absolute',
            zIndex: 20,
            left: '1rem',
            right: '1rem',
            top: '1rem',
            maxHeight: '60vh',
            overflow: 'auto',
            WebkitOverflowScrolling: 'touch',
            background: 'rgba(17, 24, 39, 0.96)',
            color: '#fecaca',
            borderLeft: '4px solid #ef4444',
            borderRadius: '0.5rem',
            boxShadow: '0 1rem 2rem rgba(0, 0, 0, 0.35)',
            padding: '0.75rem 1rem',
            whiteSpace: 'pre-wrap',
            font: '12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          }}
        >
          {revealError}
        </div>
      )}

      {(showDiag || (revealError && !diagDismissed)) && (
        <div
          role="status"
          style={{
            position: 'absolute',
            zIndex: 30,
            left: '1rem',
            right: '1rem',
            top: '1rem',
            maxHeight: '70vh',
            overflow: 'auto',
            WebkitOverflowScrolling: 'touch',
            background: 'rgba(3, 7, 18, 0.96)',
            color: '#e5e7eb',
            border: '1px solid rgba(148, 163, 184, 0.45)',
            borderRadius: '0.5rem',
            boxShadow: '0 1rem 2rem rgba(0, 0, 0, 0.35)',
            padding: '0.75rem 1rem',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
            font: '12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setShowDiag(false);
              setDiagDismissed(true);
            }}
            style={{
              float: 'right',
              marginLeft: '0.75rem',
              border: '1px solid rgba(229, 231, 235, 0.45)',
              borderRadius: '0.25rem',
              background: 'rgba(15, 23, 42, 0.9)',
              color: '#e5e7eb',
              font: 'inherit',
              padding: '0.125rem 0.4rem',
            }}
          >
            close
          </button>
          {buildDiagnosticLines().join('\n')}
        </div>
      )}

      {children}
    </div>
  );
});
