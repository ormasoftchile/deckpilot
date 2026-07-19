import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  componentStack: string | null;
}

/**
 * Top-level error boundary for the viewer.
 *
 * Without this, any throw during render/commit (e.g. Reveal.js init on iOS
 * Safari) silently unmounts the whole React tree and the page goes blank with
 * zero diagnostics. This boundary instead surfaces the real error — name,
 * message, and stack — in a readable, scrollable dark panel so the failure can
 * be diagnosed directly on the device.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null, componentStack: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface for remote/desktop debugging in addition to the visible panel.
    // eslint-disable-next-line no-console
    console.error('[viewer] Uncaught render error', error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? null });
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    const { error, componentStack } = this.state;
    if (!error) {
      return this.props.children;
    }

    return (
      <div className="dp-crash" role="alert">
        <div className="dp-crash-panel">
          <h1 className="dp-crash-title">Something crashed while rendering</h1>
          <p className="dp-crash-subtitle">
            The viewer hit an unexpected error. The details below are captured so this can be fixed.
          </p>
          <div className="dp-crash-name">{error.name}</div>
          <pre className="dp-crash-message">{error.message}</pre>
          {error.stack && (
            <details className="dp-crash-details" open>
              <summary>Stack trace</summary>
              <pre className="dp-crash-stack">{error.stack}</pre>
            </details>
          )}
          {componentStack && (
            <details className="dp-crash-details">
              <summary>Component stack</summary>
              <pre className="dp-crash-stack">{componentStack}</pre>
            </details>
          )}
          <div className="dp-crash-actions">
            <button type="button" className="dp-button" onClick={this.handleReload}>
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
