import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
// Import the viewer's stylesheet VERBATIM so the embedded <DeckViewer> gets its
// layout chain (.dp-viewer flex column → .dp-viewer-stage flex:1 min-height:0 →
// .reveal height:100%). Without it the stage collapses to ~0 and Reveal never
// reaches ready. It MUST load *before* the editor's own sheet: the viewer sheet
// also carries html/body/#root + :root token + `.dp-viewer{height:100dvh}` rules
// that would fight the split-pane shell; the editor sheet redefines those at
// equal specificity, so being last in source order lets the editor overrides
// win without editing apps/viewer.
import '@viewer/styles.css';
import './styles.css';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Deckpilot Editor: #root element not found.');
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
