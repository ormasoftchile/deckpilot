import { useEffect, useRef, useState } from 'react';
import Reveal from 'reveal.js';
import 'reveal.js/dist/reveal.css';
import 'reveal.js/dist/theme/black.css';
import type { LoadedDeck } from '../lib/deckLoader';
import { sanitizeSlideHtml } from '../lib/sanitize';
import { rewriteActionLinks } from '../lib/actionRenderer';
import { readSlideFromHash, writeSlideToHash, onHashChange } from '../lib/hashRouter';
import { renderSlideDiagrams } from '../lib/tritonDiagramRenderer';
import { initializeTritonRevealFragments } from '../lib/tritonRevealRuntime';
import { PresenterNotes } from './PresenterNotes';

interface DeckViewerProps {
  loaded: LoadedDeck;
  onClose: () => void;
}

interface RenderedSlide {
  index: number;
  title: string;
  html: string;
  notes: string;
  voiceCues: string[];
}

function buildRenderedSlides(loaded: LoadedDeck): RenderedSlide[] {
  return loaded.deck.slides.map((slide) => {
    const transformed = rewriteActionLinks(slide.html ?? '');
    const safe = sanitizeSlideHtml(transformed);
    const title =
      slide.frontmatter?.title?.toString().trim() ||
      extractFirstHeading(slide.content) ||
      `Slide ${slide.index + 1}`;
    const voiceCues = (slide.voiceCues ?? []).map((c) => c.text).filter(Boolean);
    return {
      index: slide.index,
      title,
      html: safe,
      notes: slide.speakerNotes ?? '',
      voiceCues,
    };
  });
}

function extractFirstHeading(content: string): string | null {
  const m = content.match(/^\s*#{1,6}\s+(.+?)\s*$/m);
  return m ? m[1].trim() : null;
}

function formatRevealError(err: unknown): string {
  if (err instanceof Error) {
    return err.stack || err.message;
  }
  return String(err);
}

export function DeckViewer({ loaded, onClose }: DeckViewerProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef<Reveal | null>(null);
  const revealReadyRef = useRef(false);
  const initPhaseRef = useRef('mount');
  const [showNotes, setShowNotes] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(() => readSlideFromHash());
  const [slides, setSlides] = useState<RenderedSlide[]>(() => buildRenderedSlides(loaded));
  const [revealError, setRevealError] = useState<string | null>(null);
  const [revealReady, setRevealReady] = useState(false);
  const [initPhase, setInitPhase] = useState('mount');
  const [showDiag, setShowDiag] = useState(false);
  const [diagDismissed, setDiagDismissed] = useState(false);

  const deckTitle = loaded.deck.title ?? loaded.deck.metadata?.title ?? 'Untitled deck';
  const setPhase = (phase: string): void => {
    initPhaseRef.current = phase;
    setInitPhase(phase);
  };

  useEffect(() => {
    let cancelled = false;
    const initialSlides = buildRenderedSlides(loaded);
    setSlides(initialSlides);

    void Promise.all(
      initialSlides.map(async (rendered) => {
        const sourceSlide = loaded.deck.slides[rendered.index];
        if (!sourceSlide) {
          return rendered;
        }
        const html = await renderSlideDiagrams(rendered.html, sourceSlide, loaded.deck);
        return { ...rendered, html };
      }),
    ).then((nextSlides) => {
      if (!cancelled) {
        setSlides(nextSlides);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loaded]);

  // Initialize reveal.js once per deck load.
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    revealReadyRef.current = false;
    setRevealReady(false);
    setRevealError(null);
    setPhase('mount');
    setShowDiag(false);
    setDiagDismissed(false);

    // Fail-soft: a throw here must not unmount the whole tree (blank screen).
    // Worst case the fragment runtime is skipped but slide content still shows.
    try {
      initializeTritonRevealFragments(el);
    } catch (err) {
      console.error('[viewer] initializeTritonRevealFragments failed', err);
    }

    let reveal: Reveal | null = null;
    let cancelled = false;
    let initFrame = 0;
    let layoutFrame = 0;
    let watchdogTimeout = 0;
    let resizeObserver: ResizeObserver | null = null;

    const safeLayout = (): void => {
      if (cancelled || !revealRef.current) return;
      try {
        revealRef.current.layout();
      } catch (err) {
        console.error('[viewer] reveal.layout failed', err);
      }
    };

    const wireEvents = (instance: Reveal): void => {
      const target = Math.min(Math.max(readSlideFromHash(), 0), slides.length - 1);
      if (target > 0) instance.slide(target);
      const handleChange = (): void => {
        const idx = instance.getIndices().h;
        setCurrentIndex(idx);
        writeSlideToHash(idx);
      };
      instance.on('slidechanged', handleChange);
      handleChange();
      // iOS Safari frequently reports a settled layout only after the first
      // frame (dynamic toolbar / viewport not stable during initialize()).
      // Kick a layout on the next frame so slides are scaled to real height.
      layoutFrame = requestAnimationFrame(safeLayout);
    };

    const startReveal = (): void => {
      if (cancelled) return;
      setPhase('startReveal');
      try {
        reveal = new Reveal(el, {
          hash: false, // we manage the hash ourselves to keep ?url= intact
          controls: false,
          progress: true,
          slideNumber: false,
          transition: 'slide',
          keyboard: true,
          touch: true,
          center: false,
          embedded: true,
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
            setPhase('ready');
            if (watchdogTimeout) {
              window.clearTimeout(watchdogTimeout);
              watchdogTimeout = 0;
            }
            setShowDiag(false);
            wireEvents(reveal);
          })
          .catch((err) => {
            console.error('[viewer] reveal.initialize failed', err);
            if (!cancelled) {
              const message = formatRevealError(err);
              revealReadyRef.current = false;
              setRevealReady(false);
              setPhase(`initialize-error: ${message}`);
              setRevealError(message);
              setDiagDismissed(false);
            }
          });
      } catch (err) {
        console.error('[viewer] Reveal setup failed', err);
        if (!cancelled) {
          const message = formatRevealError(err);
          revealReadyRef.current = false;
          setRevealReady(false);
          setPhase(`setup-error: ${message}`);
          setRevealError(message);
          setDiagDismissed(false);
        }
      }
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
        resizeObserver?.disconnect();
        resizeObserver = null;
        startReveal();
      });
    } else {
      initFrame = requestAnimationFrame(startReveal);
    }

    // External hash changes (deep link refresh, manual edits) drive reveal.
    const unsubscribeHash = onHashChange((idx) => {
      const clamped = Math.min(Math.max(idx, 0), slides.length - 1);
      setCurrentIndex(clamped);
      if (revealReadyRef.current && revealRef.current && revealRef.current.getIndices().h !== clamped) {
        revealRef.current.slide(clamped);
      }
    });

    // Re-layout on viewport changes — iOS toolbar show/hide, rotation, and
    // visual-viewport resizes all change the usable height after init.
    window.addEventListener('resize', safeLayout);
    window.addEventListener('orientationchange', safeLayout);
    const visualViewport = window.visualViewport;
    visualViewport?.addEventListener('resize', safeLayout);

    return () => {
      cancelled = true;
      if (initFrame) cancelAnimationFrame(initFrame);
      if (layoutFrame) cancelAnimationFrame(layoutFrame);
      if (watchdogTimeout) window.clearTimeout(watchdogTimeout);
      resizeObserver?.disconnect();
      resizeObserver = null;
      window.removeEventListener('resize', safeLayout);
      window.removeEventListener('orientationchange', safeLayout);
      visualViewport?.removeEventListener('resize', safeLayout);
      unsubscribeHash();
      try {
        reveal?.destroy();
      } catch {
        // ignore double-destroy in StrictMode
      }
      revealRef.current = null;
      revealReadyRef.current = false;
      setRevealReady(false);
    };
  }, [slides]);

  const totalSlides = slides.length;
  const clampedIndex = Math.min(Math.max(currentIndex, 0), Math.max(totalSlides - 1, 0));
  const currentSlide = slides[clampedIndex];
  const canGoBack = clampedIndex > 0;
  const canGoForward = clampedIndex < totalSlides - 1;

  const goToSlide = (index: number): void => {
    if (totalSlides === 0) return;
    const next = Math.min(Math.max(index, 0), totalSlides - 1);
    setCurrentIndex(next);
    writeSlideToHash(next);
    if (revealReadyRef.current && revealRef.current) {
      revealRef.current.slide(next);
    }
  };

  const buildDiagnosticLines = (): string[] => [
    `phase: ${initPhase}`,
    `revealReady: ${revealReady}`,
    `revealError: ${revealError ?? 'none'}`,
    `slides: ${slides.length}`,
    `currentIndex / clampedIndex: ${currentIndex} / ${clampedIndex}`,
    `container (.reveal) WxH: ${containerRef.current?.clientWidth ?? 'n/a'} x ${containerRef.current?.clientHeight ?? 'n/a'}`,
    `stage WxH: ${stageRef.current?.clientWidth ?? 'n/a'} x ${stageRef.current?.clientHeight ?? 'n/a'}`,
    `window.innerHeight: ${typeof window !== 'undefined' ? window.innerHeight : 'n/a'}`,
    `visualViewport.height: ${typeof window !== 'undefined' ? window.visualViewport?.height ?? 'n/a' : 'n/a'}`,
    `100dvh supported: ${typeof CSS !== 'undefined' && CSS.supports?.('height', '100dvh') ? 'true' : 'false'}`,
    `.slides section count in DOM: ${containerRef.current?.querySelectorAll('.slides > section').length ?? 'n/a'}`,
    `reveal totalSlides (if ready): ${
      revealReadyRef.current
        ? (revealRef.current as unknown as { getTotalSlides?: () => number } | null)?.getTotalSlides?.() ?? 'n/a'
        : 'n/a'
    }`,
  ];

  return (
    <div className="dp-viewer">
      <header className="dp-viewer-bar">
        <button type="button" className="dp-icon-button" onClick={onClose} title="Back to landing">
          ←
        </button>
        <div className="dp-viewer-title" title={loaded.sourceUrl}>
          <strong>{deckTitle}</strong>
          {loaded.deck.author && <span className="dp-viewer-author"> · {loaded.deck.author}</span>}
        </div>
        <div className="dp-viewer-bar-spacer" />
        {loaded.deck.metadata?.mode === 'onboarding' && (
          <span className="dp-badge" title="Onboarding deck">Onboarding</span>
        )}
        {loaded.sidecarUrl && (
          <span className="dp-badge" title={`Sidecar: ${loaded.sidecarUrl}`}>Sidecar</span>
        )}
        <button
          type="button"
          className="dp-icon-button"
          onClick={() => setShowNotes((v) => !v)}
          title="Toggle presenter notes"
          aria-pressed={showNotes}
        >
          {showNotes ? 'Hide notes' : 'Notes'}
        </button>
        <div className="dp-viewer-nav dp-viewer-nav-header" aria-label="Slide navigation">
          <button type="button" className="dp-nav-button" onClick={() => goToSlide(0)} disabled={!canGoBack} title="First slide">
            ⏮
          </button>
          <button type="button" className="dp-nav-button" onClick={() => goToSlide(clampedIndex - 1)} disabled={!canGoBack} title="Previous slide">
            ◀
          </button>
          <span className="dp-nav-position" aria-live="polite">
            {clampedIndex + 1} / {totalSlides}
          </span>
          <button type="button" className="dp-nav-button" onClick={() => goToSlide(clampedIndex + 1)} disabled={!canGoForward} title="Next slide">
            ▶
          </button>
          <button type="button" className="dp-nav-button" onClick={() => goToSlide(totalSlides - 1)} disabled={!canGoForward} title="Last slide">
            ⏭
          </button>
        </div>
        <a
          className="dp-icon-button dp-icon-button-link"
          href={loaded.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Open raw deck"
        >
          Raw
        </a>
      </header>

      <div className="dp-viewer-stage" ref={stageRef}>
        <div className="reveal" ref={containerRef}>
          <div className="slides">
            {slides.map((s) => (
              <section key={s.index} data-slide-index={s.index} dangerouslySetInnerHTML={{ __html: s.html }} />
            ))}
          </div>
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

        <nav className="dp-viewer-nav dp-viewer-nav-overlay" aria-label="Slide navigation">
          <button type="button" className="dp-nav-button" onClick={() => goToSlide(0)} disabled={!canGoBack} title="First slide">
            ⏮
          </button>
          <button type="button" className="dp-nav-button" onClick={() => goToSlide(clampedIndex - 1)} disabled={!canGoBack} title="Previous slide">
            ◀
          </button>
          <span className="dp-nav-position" aria-live="polite">
            {clampedIndex + 1} / {totalSlides}
          </span>
          <button type="button" className="dp-nav-button" onClick={() => goToSlide(clampedIndex + 1)} disabled={!canGoForward} title="Next slide">
            ▶
          </button>
          <button type="button" className="dp-nav-button" onClick={() => goToSlide(totalSlides - 1)} disabled={!canGoForward} title="Last slide">
            ⏭
          </button>
        </nav>
      </div>

      {showNotes && currentSlide && (
        <PresenterNotes
          slideIndex={clampedIndex}
          total={slides.length}
          title={currentSlide.title}
          notes={currentSlide.notes}
          voiceCues={currentSlide.voiceCues}
        />
      )}

      {loaded.warnings.length > 0 && (
        <aside className="dp-warnings" role="status">
          <details>
            <summary>{loaded.warnings.length} parse warning{loaded.warnings.length === 1 ? '' : 's'}</summary>
            <ul>
              {loaded.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </details>
        </aside>
      )}
    </div>
  );
}
