import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Missing #root mount point');
}

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

/**
 * Dependency-free last-resort diagnostics.
 *
 * If a throw escapes React entirely (e.g. during commit) the tree can unmount
 * and leave #root empty — a silent blank screen with no clue as to why. These
 * handlers detect an empty/blank root and paint the raw error text directly
 * into the DOM so failures are visible even on devices with no console access.
 */
function renderGlobalFallback(title: string, detail: string): void {
  const mount = document.getElementById('root');
  // Only take over if React has produced nothing visible. If the ErrorBoundary
  // (or the app) already rendered content, leave it alone.
  if (!mount || mount.childElementCount > 0) {
    return;
  }
  const panel = document.createElement('div');
  panel.setAttribute('role', 'alert');
  panel.style.cssText =
    'box-sizing:border-box;max-width:760px;margin:0 auto;padding:40px 20px;' +
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
    'color:#e6e8eb;';
  const heading = document.createElement('h1');
  heading.textContent = title;
  heading.style.cssText = 'color:#ff6b6b;font-size:1.25rem;margin:0 0 12px;';
  const pre = document.createElement('pre');
  pre.textContent = detail;
  pre.style.cssText =
    'white-space:pre-wrap;word-break:break-word;background:#16181d;border-left:3px solid #ff6b6b;' +
    'border-radius:6px;padding:12px 16px;font-size:0.8rem;overflow:auto;max-height:70vh;' +
    '-webkit-overflow-scrolling:touch;';
  panel.appendChild(heading);
  panel.appendChild(pre);
  mount.appendChild(panel);
}

window.addEventListener('error', (event) => {
  const err = event.error as Error | undefined;
  const detail = err?.stack || `${err?.name ?? 'Error'}: ${err?.message ?? event.message}`;
  renderGlobalFallback('Unhandled error', detail || String(event.message));
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason as unknown;
  let detail: string;
  if (reason instanceof Error) {
    detail = reason.stack || `${reason.name}: ${reason.message}`;
  } else {
    detail = typeof reason === 'string' ? reason : JSON.stringify(reason);
  }
  renderGlobalFallback('Unhandled promise rejection', detail);
});
