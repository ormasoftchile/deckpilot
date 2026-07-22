import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { renderDiagramSourceToSvg, sanitizeSlideHtml } from '@deckpilot/preview';

interface DiagramViewProps {
  sourceUrl: string;
  source: string;
  onClose: () => void;
}

const MIN_SCALE = 0.1;
const MAX_SCALE = 8;

function fileName(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split('/').filter(Boolean).pop();
    return last ? decodeURIComponent(last) : u.hostname;
  } catch {
    return url;
  }
}

interface Transform {
  scale: number;
  tx: number;
  ty: number;
}

export function DiagramView({ sourceUrl, source, onClose }: DiagramViewProps): JSX.Element {
  const rendered = useMemo(() => {
    const result = renderDiagramSourceToSvg(source);
    return result.ok
      ? ({ ok: true, svg: sanitizeSlideHtml(result.svg) } as const)
      : ({ ok: false, error: result.error } as const);
  }, [source]);

  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [t, setT] = useState<Transform>({ scale: 1, tx: 0, ty: 0 });

  // Intrinsic SVG size from viewBox (falls back to measured box).
  const intrinsicSize = useCallback((): { w: number; h: number } | null => {
    const svg = contentRef.current?.querySelector('svg');
    if (!svg) return null;
    const vb = svg.getAttribute('viewBox');
    if (vb) {
      const p = vb.trim().split(/\s+/).map(Number);
      if (p.length === 4 && p[2] > 0 && p[3] > 0) return { w: p[2], h: p[3] };
    }
    const box = svg.getBoundingClientRect();
    return box.width > 0 && box.height > 0 ? { w: box.width, h: box.height } : null;
  }, []);

  const fit = useCallback(() => {
    const vp = viewportRef.current;
    const size = intrinsicSize();
    if (!vp || !size) return;
    const cw = vp.clientWidth;
    const ch = vp.clientHeight;
    const scale = Math.min(cw / size.w, ch / size.h) * 0.92;
    setT({ scale, tx: (cw - size.w * scale) / 2, ty: (ch - size.h * scale) / 2 });
  }, [intrinsicSize]);

  // Pin the SVG to its intrinsic pixel size so the transform math is stable.
  useEffect(() => {
    if (!rendered.ok) return;
    const svg = contentRef.current?.querySelector('svg');
    if (svg) {
      const vb = svg.getAttribute('viewBox');
      if (vb) {
        const p = vb.trim().split(/\s+/).map(Number);
        if (p.length === 4) {
          svg.setAttribute('width', String(p[2]));
          svg.setAttribute('height', String(p[3]));
        }
      }
      (svg as SVGElement & { style: CSSStyleDeclaration }).style.display = 'block';
    }
    fit();
  }, [rendered, fit]);

  useEffect(() => {
    const onResize = (): void => fit();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [fit]);

  const zoomAround = useCallback((factor: number, cx: number, cy: number) => {
    setT((prev) => {
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.scale * factor));
      const k = scale / prev.scale;
      return { scale, tx: cx - k * (cx - prev.tx), ty: cy - k * (cy - prev.ty) };
    });
  }, []);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const vp = viewportRef.current;
      if (!vp) return;
      const rect = vp.getBoundingClientRect();
      zoomAround(Math.exp(-e.deltaY * 0.0015), e.clientX - rect.left, e.clientY - rect.top);
    },
    [zoomAround],
  );

  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchDist = useRef<number | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const pts = pointers.current;
      const prev = pts.get(e.pointerId);
      if (!prev) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const vp = viewportRef.current;
      if (!vp) return;

      if (pts.size === 1) {
        setT((p) => ({ ...p, tx: p.tx + (e.clientX - prev.x), ty: p.ty + (e.clientY - prev.y) }));
      } else if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const rect = vp.getBoundingClientRect();
        const cx = (a.x + b.x) / 2 - rect.left;
        const cy = (a.y + b.y) / 2 - rect.top;
        if (pinchDist.current != null && pinchDist.current > 0) {
          zoomAround(dist / pinchDist.current, cx, cy);
        }
        pinchDist.current = dist;
      }
    },
    [zoomAround],
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchDist.current = null;
  }, []);

  const zoomButton = useCallback(
    (factor: number) => {
      const vp = viewportRef.current;
      if (!vp) return;
      zoomAround(factor, vp.clientWidth / 2, vp.clientHeight / 2);
    },
    [zoomAround],
  );

  const download = useCallback(() => {
    if (!rendered.ok) return;
    const blob = new Blob([rendered.svg], { type: 'image/svg+xml' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = `${fileName(sourceUrl).replace(/\.(mmd|mermaid)$/i, '')}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(href), 1000);
  }, [rendered, sourceUrl]);

  const name = fileName(sourceUrl);

  return (
    <div className="dp-diagram">
      <header className="dp-viewer-bar">
        <button type="button" className="dp-icon-button" onClick={onClose} title="Back to landing">
          ←
        </button>
        <div className="dp-viewer-title" title={sourceUrl}>
          <strong>{name}</strong>
        </div>
        <div className="dp-viewer-bar-spacer" />
        {rendered.ok && (
          <div className="dp-viewer-nav" aria-label="Diagram controls">
            <button type="button" className="dp-nav-button" onClick={() => zoomButton(1 / 1.2)} title="Zoom out">
              −
            </button>
            <button type="button" className="dp-nav-button" onClick={fit} title="Fit to screen">
              Fit
            </button>
            <button type="button" className="dp-nav-button" onClick={() => zoomButton(1.2)} title="Zoom in">
              +
            </button>
          </div>
        )}
        {rendered.ok && (
          <button type="button" className="dp-icon-button" onClick={download} title="Download SVG">
            Download
          </button>
        )}
        <a
          className="dp-icon-button dp-icon-button-link"
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Open raw diagram"
        >
          Raw
        </a>
      </header>

      {rendered.ok ? (
        <div
          className="dp-diagram-viewport"
          ref={viewportRef}
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div
            className="dp-diagram-content"
            ref={contentRef}
            style={{ transform: `translate(${t.tx}px, ${t.ty}px) scale(${t.scale})` }}
            dangerouslySetInnerHTML={{ __html: rendered.svg }}
          />
        </div>
      ) : (
        <div className="dp-diagram-error" role="alert">
          <div className="dp-diagram-error-header">⚠ Diagram failed to render</div>
          <pre className="dp-diagram-error-message">{rendered.error}</pre>
          <details>
            <summary>Show source</summary>
            <pre className="dp-diagram-source">{source}</pre>
          </details>
        </div>
      )}
    </div>
  );
}
