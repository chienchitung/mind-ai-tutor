'use client';

import { useEffect, useRef, useState } from 'react';

interface DeckViewerProps {
  url: string;
  page: number;
  onNumPages?: (numPages: number) => void;
  onError?: () => void;
  className?: string;
}

// Renders one page of a PDF deck onto a canvas via pdfjs-dist, reusing the
// same worker setup app/ai-quiz/page.tsx already uses for text extraction -
// this is the first spot in the app doing actual visual page rendering.
export function DeckViewer({ url, page, onNumPages, onError, className }: DeckViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [doc, setDoc] = useState<any>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDoc(null);
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
        if (!cancelled) { console.error('DeckViewer: failed to load PDF document', url, cause); setError(true); onError?.(); }
      }
    }
    void load();
    return () => { cancelled = true; };
    // onNumPages/onError are expected to be stable callbacks from the caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    async function render() {
      try {
        const clampedPage = Math.min(Math.max(1, page), doc.numPages);
        const pdfPage = await doc.getPage(clampedPage);
        const viewport = pdfPage.getViewport({ scale: 1.75 });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const context = canvas.getContext('2d');
        if (!context) return;
        await pdfPage.render({ canvasContext: context, viewport }).promise;
      } catch (cause) {
        if (!cancelled) { console.error('DeckViewer: failed to render PDF page', page, cause); setError(true); onError?.(); }
      }
    }
    void render();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, page]);

  if (error) return null;
  return <canvas ref={canvasRef} className={className} />;
}
