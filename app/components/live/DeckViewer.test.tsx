// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { DeckViewer } from './DeckViewer';

const getPage = vi.fn();
const getDocument = vi.fn();
const GlobalWorkerOptions: { workerSrc: string } = { workerSrc: '' };

vi.mock('pdfjs-dist/build/pdf', () => ({ getDocument, GlobalWorkerOptions }));

// jsdom has no ResizeObserver - stub one that reports a fixed non-zero box
// immediately on observe(), matching what a real browser would report for
// an already-laid-out container.
class StubResizeObserver {
  private callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) { this.callback = callback; }
  observe() {
    const entry = { contentRect: { width: 400, height: 300 } } as ResizeObserverEntry;
    this.callback([entry], this as unknown as ResizeObserver);
  }
  unobserve() {}
  disconnect() {}
}

function makeDoc(numPages: number) {
  return { numPages, getPage };
}
function makePage() {
  return {
    getViewport: vi.fn().mockReturnValue({ width: 100, height: 80 }),
    render: vi.fn().mockReturnValue({ promise: Promise.resolve(), cancel: vi.fn() }),
  };
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', StubResizeObserver);
  GlobalWorkerOptions.workerSrc = '';
  getPage.mockReset().mockResolvedValue(makePage());
  getDocument.mockReset().mockReturnValue({ promise: Promise.resolve(makeDoc(5)) });
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({}) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('DeckViewer', () => {
  it('loads the document, sets the worker once, and reports the page count', async () => {
    const onNumPages = vi.fn();
    render(<DeckViewer url="https://example.test/deck.pdf" page={1} onNumPages={onNumPages} />);
    await waitFor(() => expect(onNumPages).toHaveBeenCalledWith(5));
    // disableRange/disableStream: a Range-requesting fetch triggers a CORS
    // preflight that Supabase Storage's public-object endpoint doesn't
    // satisfy, so decks must load via one plain GET instead.
    expect(getDocument).toHaveBeenCalledWith({ url: 'https://example.test/deck.pdf', disableRange: true, disableStream: true });
    expect(GlobalWorkerOptions.workerSrc).toBe('/pdfjs/pdf.worker.min.mjs');
    await waitFor(() => expect(getPage).toHaveBeenCalledWith(1));
  });
  it('clamps an out-of-range page into the document bounds', async () => {
    render(<DeckViewer url="https://example.test/deck.pdf" page={99} />);
    await waitFor(() => expect(getPage).toHaveBeenCalledWith(5));
  });
  it('re-renders the requested page without reloading the document when only the page changes', async () => {
    const { rerender } = render(<DeckViewer url="https://example.test/deck.pdf" page={1} />);
    await waitFor(() => expect(getPage).toHaveBeenCalledWith(1));
    rerender(<DeckViewer url="https://example.test/deck.pdf" page={3} />);
    await waitFor(() => expect(getPage).toHaveBeenCalledWith(3));
    expect(getDocument).toHaveBeenCalledTimes(1);
  });
  it('reloads the document when the url changes', async () => {
    const { rerender } = render(<DeckViewer url="https://example.test/deck-a.pdf" page={1} />);
    await waitFor(() => expect(getDocument).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://example.test/deck-a.pdf' })));
    rerender(<DeckViewer url="https://example.test/deck-b.pdf" page={1} />);
    await waitFor(() => expect(getDocument).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://example.test/deck-b.pdf' })));
    expect(getDocument).toHaveBeenCalledTimes(2);
  });
  it('reports an error and renders nothing when the document fails to load', async () => {
    getDocument.mockReturnValue({ promise: Promise.reject(new Error('bad pdf')) });
    const onError = vi.fn();
    const { container } = render(<DeckViewer url="https://example.test/broken.pdf" page={1} onError={onError} />);
    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(container.querySelector('canvas')).toBeNull();
  });
  it('scales the page to fit its container, not a fixed factor', async () => {
    const page = makePage();
    getPage.mockResolvedValue(page);
    render(<DeckViewer url="https://example.test/deck.pdf" page={1} />);
    await waitFor(() => expect(page.render).toHaveBeenCalled());
    // Unscaled measurement (scale: 1) plus the final contain-fit render call.
    expect(page.getViewport).toHaveBeenCalledWith({ scale: 1 });
    expect(page.getViewport.mock.calls.some(([arg]) => arg.scale !== 1)).toBe(true);
  });
  it('cancels a superseded render instead of letting it surface as an error', async () => {
    const cancel = vi.fn();
    let rejectFirst!: (reason?: unknown) => void;
    const firstRenderPromise = new Promise<void>((_resolve, reject) => { rejectFirst = reject; });
    const page1 = { getViewport: vi.fn().mockReturnValue({ width: 100, height: 80 }), render: vi.fn().mockReturnValue({ promise: firstRenderPromise, cancel }) };
    const page2 = makePage();
    getPage.mockImplementation((pageNumber: number) => Promise.resolve(pageNumber === 1 ? page1 : page2));
    const onError = vi.fn();
    const { rerender } = render(<DeckViewer url="https://example.test/deck.pdf" page={1} onError={onError} />);
    await waitFor(() => expect(page1.render).toHaveBeenCalled());

    rerender(<DeckViewer url="https://example.test/deck.pdf" page={2} onError={onError} />);
    expect(cancel).toHaveBeenCalled();

    // pdf.js rejects a render task's promise once it's actually cancelled -
    // that rejection must not be mistaken for a real load failure.
    rejectFirst(new Error('RenderingCancelledException'));
    await waitFor(() => expect(page2.render).toHaveBeenCalled());
    expect(onError).not.toHaveBeenCalled();
  });
});
