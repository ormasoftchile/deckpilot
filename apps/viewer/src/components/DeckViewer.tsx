import { useEffect, useRef, useState, useMemo } from 'react';
import Reveal from 'reveal.js';
import 'reveal.js/dist/reveal.css';
import 'reveal.js/dist/theme/black.css';
import type { LoadedDeck } from '../lib/deckLoader';
import { sanitizeSlideHtml } from '../lib/sanitize';
import { rewriteActionLinks } from '../lib/actionRenderer';
import { readSlideFromHash, writeSlideToHash, onHashChange } from '../lib/hashRouter';
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

export function DeckViewer({ loaded, onClose }: DeckViewerProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef<Reveal | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(() => readSlideFromHash());

  const slides = useMemo(() => buildRenderedSlides(loaded), [loaded]);
  const deckTitle = loaded.deck.title ?? loaded.deck.metadata?.title ?? 'Untitled deck';

  // Initialize reveal.js once per deck load.
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const reveal = new Reveal(el, {
      hash: false, // we manage the hash ourselves to keep ?url= intact
      controls: true,
      progress: true,
      slideNumber: 'c/t',
      transition: 'slide',
      keyboard: true,
      touch: true,
      center: false,
      embedded: false,
    });
    revealRef.current = reveal;
    void reveal.initialize().then(() => {
      const target = Math.min(Math.max(readSlideFromHash(), 0), slides.length - 1);
      if (target > 0) reveal.slide(target);
      const handleChange = (): void => {
        const idx = reveal.getIndices().h;
        setCurrentIndex(idx);
        writeSlideToHash(idx);
      };
      reveal.on('slidechanged', handleChange);
      handleChange();
    });

    // External hash changes (deep link refresh, manual edits) drive reveal.
    const unsubscribeHash = onHashChange((idx) => {
      const clamped = Math.min(Math.max(idx, 0), slides.length - 1);
      if (revealRef.current && revealRef.current.getIndices().h !== clamped) {
        revealRef.current.slide(clamped);
      }
    });

    return () => {
      unsubscribeHash();
      try {
        reveal.destroy();
      } catch {
        // ignore double-destroy in StrictMode
      }
      revealRef.current = null;
    };
  }, [slides]);

  const currentSlide = slides[currentIndex];

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

      <div className="dp-viewer-stage">
        <div className="reveal" ref={containerRef}>
          <div className="slides">
            {slides.map((s) => (
              <section key={s.index} data-slide-index={s.index} dangerouslySetInnerHTML={{ __html: s.html }} />
            ))}
          </div>
        </div>
      </div>

      {showNotes && currentSlide && (
        <PresenterNotes
          slideIndex={currentIndex}
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
