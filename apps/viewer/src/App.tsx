import { useEffect, useState, useCallback } from 'react';
import { Landing } from './components/Landing';
import { DeckViewer } from './components/DeckViewer';
import { DiagramView } from './components/DiagramView';
import { ErrorView } from './components/ErrorView';
import {
  loadDeckFromUrl,
  loadMermaidFromUrl,
  isMermaidUrl,
  DeckLoadError,
  type LoadedDeck,
} from './lib/deckLoader';

const RECENT_KEY = 'deckpilot.viewer.recent';
const RECENT_LIMIT = 8;

function getInitialUrl(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get('url')?.trim() ?? '';
}

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function saveRecent(url: string): void {
  try {
    const existing = loadRecent().filter((u) => u !== url);
    const next = [url, ...existing].slice(0, RECENT_LIMIT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

type State =
  | { kind: 'landing' }
  | { kind: 'loading'; url: string }
  | { kind: 'ready'; deck: LoadedDeck }
  | { kind: 'diagram'; sourceUrl: string; source: string }
  | { kind: 'error'; url: string; message: string };

export function App(): JSX.Element {
  const [state, setState] = useState<State>(() => {
    const url = getInitialUrl();
    return url ? { kind: 'loading', url } : { kind: 'landing' };
  });
  const [recent, setRecent] = useState<string[]>(() => loadRecent());

  const load = useCallback(async (url: string, controller: AbortController) => {
    setState({ kind: 'loading', url });
    try {
      if (isMermaidUrl(url)) {
        const { sourceUrl, source } = await loadMermaidFromUrl(url, controller.signal);
        if (controller.signal.aborted) return;
        saveRecent(url);
        setRecent(loadRecent());
        setState({ kind: 'diagram', sourceUrl, source });
        return;
      }
      const params = new URLSearchParams(window.location.search);
      const split = params.get('split') ?? params.get('slideBreak') ?? undefined;
      const deck = await loadDeckFromUrl(url, controller.signal, split ? { slideBreak: split } : undefined);
      if (controller.signal.aborted) return;
      saveRecent(url);
      setRecent(loadRecent());
      setState({ kind: 'ready', deck });
    } catch (err) {
      if (controller.signal.aborted) return;
      const message = err instanceof DeckLoadError ? err.message : err instanceof Error ? err.message : 'Unknown error';
      setState({ kind: 'error', url, message });
    }
  }, []);

  useEffect(() => {
    if (state.kind !== 'loading') return;
    const controller = new AbortController();
    void load(state.url, controller);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.kind === 'loading' ? state.url : null]);

  const handleOpen = useCallback((url: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set('url', url);
    window.history.pushState(null, '', `${window.location.pathname}?${params.toString()}${window.location.hash}`);
    setState({ kind: 'loading', url });
  }, []);

  const handleReset = useCallback(() => {
    window.history.pushState(null, '', window.location.pathname);
    setState({ kind: 'landing' });
  }, []);

  if (state.kind === 'landing') {
    return <Landing recent={recent} onOpen={handleOpen} />;
  }
  if (state.kind === 'loading') {
    return (
      <div className="dp-loading" role="status" aria-live="polite">
        <div className="dp-spinner" aria-hidden="true" />
        <p>Loading deck…</p>
        <p className="dp-loading-url">{state.url}</p>
      </div>
    );
  }
  if (state.kind === 'error') {
    return <ErrorView url={state.url} message={state.message} onRetry={() => handleOpen(state.url)} onHome={handleReset} />;
  }
  if (state.kind === 'diagram') {
    return <DiagramView sourceUrl={state.sourceUrl} source={state.source} onClose={handleReset} />;
  }
  return <DeckViewer loaded={state.deck} onClose={handleReset} />;
}
