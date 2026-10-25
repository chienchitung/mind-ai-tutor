'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

// Current page, both neighbours and one recently shown page.
const MAX_CACHED_PAGES = 4;

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
        const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
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
    const keyFor = (pageNumber: number) => `${url}:${pageNumber}:${containerSize.width}:${containerSize.height}`;
    const remember = (key: string, canvas: HTMLCanvasElement) => {
      pages.current.delete(key);
      pages.current.set(key, canvas);
      while (pages.current.size > MAX_CACHED_PAGES) pages.current.delete(pages.current.keys().next().value!);
    };
    // Renders one page offscreen (so the visible slide stays put until the
    // new one is ready) and caches it.
    async function draw(pageNumber: number): Promise<HTMLCanvasElement | null> {
      const key = keyFor(pageNumber);
      const cached = pages.current.get(key);
      if (cached) { remember(key, cached); return cached; }
      const pdfPage = await doc.getPage(pageNumber);
      if (cancelled) return null;
      // Contain-fit: scale so the page is as large as possible without
      // overflowing the box in either dimension, then render at exactly
      // that resolution (crisp, no CSS upscaling blur).
      const unscaled = pdfPage.getViewport({ scale: 1 });
      const scale = Math.min(containerSize.width / unscaled.width, containerSize.height / unscaled.height);
      const viewport = pdfPage.getViewport({ scale: Math.max(scale, 0.1) });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext('2d');
      if (!context) return null;
      renderTask = pdfPage.render({ canvasContext: context, viewport });
      await renderTask.promise;
      renderTask = null;
      if (cancelled) return null;
      remember(key, canvas);
      return canvas;
    }
    async function render() {
      const clampedPage = Math.min(Math.max(1, page), doc.numPages);
      try {
        const image = await draw(clampedPage);
        const canvas = canvasRef.current;
        if (!image || !canvas || cancelled) return;
        canvas.width = image.width; canvas.height = image.height;
        canvas.getContext('2d')?.drawImage(image, 0, 0);
        setRendered({ url, page, width: image.width, height: image.height });
      } catch (cause) {
        // A render we cancelled ourselves rejects too (RenderingCancelledException) -
        // that's expected when the page changed again mid-render, not a real failure.
        if (!cancelled) {
          console.error('DeckViewer: failed to render PDF page', page, cause);
          setError(true);
          onError?.();
        }
        return;
      }
      // Warm the neighbours once the current slide is on screen, so the
      // next page turn (the presenter's or the projected window's) paints
      // from cache instead of waiting on pdf.js. Failures here are harmless.
      for (const neighbour of [clampedPage + 1, clampedPage - 1]) {
        if (cancelled || neighbour < 1 || neighbour > doc.numPages) continue;
        await new Promise((resolve) => setTimeout(resolve, 30));
        if (cancelled) return;
        await draw(neighbour).catch(() => null);
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
