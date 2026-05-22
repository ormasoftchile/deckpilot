import { useState, type FormEvent } from 'react';

interface LandingProps {
  recent: string[];
  onOpen: (url: string) => void;
}

const SAMPLE_URL = `${window.location.origin}${window.location.pathname.replace(/\/$/, '')}/sample.deck.md`;

export function Landing({ recent, onOpen }: LandingProps): JSX.Element {
  const [value, setValue] = useState('');

  const handleSubmit = (e: FormEvent): void => {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) onOpen(trimmed);
  };

  return (
    <main className="dp-landing">
      <header className="dp-landing-hero">
        <h1>Deckpilot Viewer</h1>
        <p>
          Read-only browser viewer for <code>.deck.md</code> presentations. Paste a public URL to
          render a deck — no install, no execution, no auth.
        </p>
      </header>

      <form className="dp-landing-form" onSubmit={handleSubmit}>
        <label htmlFor="deck-url" className="dp-landing-label">Deck URL</label>
        <div className="dp-landing-input-row">
          <input
            id="deck-url"
            type="url"
            className="dp-landing-input"
            placeholder="https://raw.githubusercontent.com/org/repo/main/demo.deck.md"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
          <button type="submit" className="dp-landing-submit" disabled={!value.trim()}>
            Open
          </button>
        </div>
        <p className="dp-landing-hint">
          Supports public HTTPS URLs (GitHub raw, Azure Blob, GitHub Pages, generic static hosting).
        </p>
      </form>

      <section className="dp-landing-section">
        <h2>Try a sample</h2>
        <button type="button" className="dp-landing-link" onClick={() => onOpen(SAMPLE_URL)}>
          {SAMPLE_URL}
        </button>
      </section>

      {recent.length > 0 && (
        <section className="dp-landing-section">
          <h2>Recent decks</h2>
          <ul className="dp-landing-recent">
            {recent.map((url) => (
              <li key={url}>
                <button type="button" className="dp-landing-link" onClick={() => onOpen(url)}>
                  {url}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="dp-landing-footer">
        <p>
          Actions (terminal, debug, VS Code commands) are <strong>displayed only</strong>. They never
          execute in the browser — open the deck in Deckpilot for VS Code to run them.
        </p>
      </footer>
    </main>
  );
}
