'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

interface DeckViewerProps {
  url: string;
  page: number;
  onNumPages?: (numPages: number) => void;
  onError?: () => void;
  /** Sizes the viewer itself - give it an explicit height (e.g. "h-full" inside a flex-1 parent, or "h-[60vh]") so there's a real box to fill. */
  className?: string;
  /** Annotation surface, aligned to the rendered PDF rather than its outer box. */
  overlay?: ReactNode;
}

// Renders one page of a PDF deck onto a canvas via pdfjs-dist, reusing the
// same worker setup app/ai-quiz/page.tsx already uses for text extraction -
// this is the first spot in the app doing actual visual page rendering.
export function DeckViewer({ url, page, onNumPages, onError, className, overlay }: DeckViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pages = useRef(new Map<string, HTMLCanvasElement>());
  const [doc, setDoc] = useState<any>(null);
  const [error, setError] = useState(false);
  const [rendered, setRendered] = useState<{
    url: string;
    page: number;
    width: number;
    height: number;
  } | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // The deck should fill whatever box it's given (a small card, or a
  // fullscreen presentation view) rather than render at one fixed scale -
  // a fixed scale left it looking tiny with huge empty margins in fullscreen.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setContainerSize((previous) =>
        previous.width === width && previous.height === height ? previous : { width, height },
      );
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setDoc(null);
    setRendered(null);
    pages.current.clear();
    setError(false);
    async function load() {
      try {
        const pdfjsLib = await import('pdfjs-dist/build/pdf');
        if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
        }
        // pdf.js defaults to HTTP Range requests to stream large PDFs
        // progressively, which sends a Range header on a cross-origin fetch -
        // that triggers a CORS preflight requiring the server to explicitly
        // allow the Range header and expose Content-Range/Accept-Ranges,
        // which Supabase Storage's public-object endpoint doesn't. A single
        // plain GET (no Range) sidesteps that entirely; decks are capped at
        // 20MB so losing progressive loading isn't a real cost here.
        const pdf = await pdfjsLib.getDocument({ url, disableRange: true, disableStream: true }).promise;
        if (cancelled) return;
        setDoc(pdf);
        onNumPages?.(pdf.numPages);
      } catch (cause) {
        if (!cancelled) {
          console.error('DeckViewer: failed to load PDF document', url, cause);
          setError(true);
          onError?.();
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
    // onNumPages/onError are expected to be stable callbacks from the caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => {
    if (!doc || containerSize.width < 1 || containerSize.height < 1) return;
    let cancelled = false;
    // pdf.js refuses to run two render() calls against the same canvas at
    // once - flipping pages quickly used to start a new render before the
    // previous one finished, which threw and surfaced as "could not load
    // this deck". Tracking the task lets cleanup actually cancel it instead
    // of just ignoring its result.
    let renderTask: any = null;
    async function render() {
      try {
        const clampedPage = Math.min(Math.max(1, page), doc.numPages);
        const key = `${url}:${clampedPage}:${containerSize.width}:${containerSize.height}`;
        const show = (image: HTMLCanvasElement) => {
          const canvas = canvasRef.current;
          if (!canvas || cancelled) return;
          canvas.width = image.width; canvas.height = image.height;
          canvas.getContext('2d')?.drawImage(image, 0, 0);
          setRendered({ url, page, width: image.width, height: image.height });
        };
        const cached = pages.current.get(key);
        if (cached) { pages.current.delete(key); pages.current.set(key, cached); show(cached); return; }
        const pdfPage = await doc.getPage(clampedPage);
        if (cancelled) return;
        // Contain-fit: scale so the page is as large as possible without
        // overflowing the box in either dimension, then render at exactly
        // that resolution (crisp, no CSS upscaling blur).
        const unscaled = pdfPage.getViewport({ scale: 1 });
        const scale = Math.min(containerSize.width / unscaled.width, containerSize.height / unscaled.height);
        const viewport = pdfPage.getViewport({ scale: Math.max(scale, 0.1) });
        // Render offscreen so the previous slide stays visible until the new one is ready.
        const canvas = document.createElement('canvas');
        if (cancelled) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const context = canvas.getContext('2d');
        if (!context) return;
        renderTask = pdfPage.render({ canvasContext: context, viewport });
        await renderTask.promise;
        if (!cancelled) {
          pages.current.set(key, canvas);
          if (pages.current.size > 3) pages.current.delete(pages.current.keys().next().value!);
          show(canvas);
        }
      } catch (cause) {
        // A render we cancelled ourselves rejects too (RenderingCancelledException) -
        // that's expected when the page changed again mid-render, not a real failure.
        if (!cancelled) {
          console.error('DeckViewer: failed to render PDF page', page, cause);
          setError(true);
          onError?.();
        }
      }
    }
    void render();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, page, containerSize.width, containerSize.height]);

  if (error) return null;
  return (
    <div ref={containerRef} className={`flex items-center justify-center ${className ?? ''}`}>
      <div
        className="relative max-h-full max-w-full"
        style={rendered ? { width: rendered.width, height: rendered.height } : undefined}
      >
        <canvas ref={canvasRef} className="block max-h-full max-w-full" />
        {rendered?.url === url && rendered.page === page ? overlay : null}
      </div>
    </div>
  );
}
