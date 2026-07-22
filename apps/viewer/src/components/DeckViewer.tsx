import { useRef, useState } from 'react';
import type { LoadedDeck } from '../lib/deckLoader';
import {
  DeckPreview,
  readSlideFromHash,
  type DeckPreviewHandle,
  type RenderedSlide,
} from '@deckpilot/preview';
import { PresenterNotes } from './PresenterNotes';

interface DeckViewerProps {
  loaded: LoadedDeck;
  onClose: () => void;
}

/**
 * Viewer chrome around the deck-rendering surface.
 *
 * All slide rendering + the hardened Reveal lifecycle live in
 * `<DeckPreview>` (@deckpilot/preview). This component owns only the app-shell
 * chrome: the header bar, the slide-nav controls (header + on-canvas overlay),
 * presenter notes, and parse warnings. It drives `DeckPreview` imperatively via
 * `previewRef` and mirrors the active index / slide metadata from its callbacks.
 */
export function DeckViewer({ loaded, onClose }: DeckViewerProps): JSX.Element {
  const previewRef = useRef<DeckPreviewHandle>(null);
  const [showNotes, setShowNotes] = useState(false);
  // Mirror of the preview's active index + slide metadata, fed by DeckPreview's
  // callbacks. Initialized from the deep-link hash so the counter is correct on
  // first paint (before Reveal reports ready).
  const [currentIndex, setCurrentIndex] = useState(() => readSlideFromHash());
  const [slides, setSlides] = useState<RenderedSlide[]>([]);
  const [diagOn, setDiagOn] = useState(false);

  const deckTitle = loaded.deck.title ?? loaded.deck.metadata?.title ?? 'Untitled deck';
  const totalSlides = slides.length;
  const clampedIndex = Math.min(Math.max(currentIndex, 0), Math.max(totalSlides - 1, 0));
  const currentSlide = slides[clampedIndex];
  const canGoBack = clampedIndex > 0;
  const canGoForward = clampedIndex < totalSlides - 1;

  const goToSlide = (index: number): void => {
    previewRef.current?.goToSlide(index);
  };

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
        <button
          type="button"
          onClick={() =>
            setDiagOn((v) => {
              const next = !v;
              previewRef.current?.toggleDiagnostics(next);
              return next;
            })
          }
          title="Diagnostics"
          aria-pressed={diagOn}
          style={{
            border: '1px solid rgba(148, 163, 184, 0.45)',
            borderRadius: '999px',
            background: diagOn ? 'rgba(59, 130, 246, 0.28)' : 'rgba(15, 23, 42, 0.78)',
            color: '#e5e7eb',
            cursor: 'pointer',
            font: '600 0.8rem system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            lineHeight: 1,
            minHeight: '1.8rem',
            minWidth: '1.8rem',
            padding: '0.35rem 0.5rem',
          }}
        >
          ⓘ
        </button>
      </header>

      <DeckPreview
        ref={previewRef}
        deck={loaded.deck}
        enableHashRouting
        onIndexChange={setCurrentIndex}
        onSlidesChange={setSlides}
      >
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
      </DeckPreview>

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
            <summary>
              {loaded.warnings.length} parse warning{loaded.warnings.length === 1 ? '' : 's'}
            </summary>
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
