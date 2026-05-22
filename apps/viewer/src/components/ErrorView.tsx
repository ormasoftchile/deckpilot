interface ErrorViewProps {
  url: string;
  message: string;
  onRetry: () => void;
  onHome: () => void;
}

export function ErrorView({ url, message, onRetry, onHome }: ErrorViewProps): JSX.Element {
  return (
    <main className="dp-error">
      <h1>Could not load deck</h1>
      <p className="dp-error-message">{message}</p>
      <p className="dp-error-url">{url}</p>
      <div className="dp-error-actions">
        <button type="button" className="dp-button" onClick={onRetry}>Retry</button>
        <button type="button" className="dp-button dp-button-secondary" onClick={onHome}>Back to viewer</button>
      </div>
      <details className="dp-error-help">
        <summary>Common causes</summary>
        <ul>
          <li>The URL must be publicly accessible (no auth, no private repos).</li>
          <li>The server must send permissive CORS headers (<code>Access-Control-Allow-Origin: *</code>). GitHub raw and most static hosts do.</li>
          <li>Only <code>https://</code> URLs are accepted (and <code>http://localhost</code> for development).</li>
          <li>Malformed deck frontmatter or YAML sidecar can prevent parsing.</li>
        </ul>
      </details>
    </main>
  );
}
