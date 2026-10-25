// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { clearDeckDocuments, DeckViewer } from './DeckViewer';

const getPage = vi.fn();
const getDocument = vi.fn();
const GlobalWorkerOptions: { workerSrc: string } = { workerSrc: '' };

vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({ getDocument, GlobalWorkerOptions }));

// jsdom has no ResizeObserver - stub one that reports a fixed non-zero box
// immediately on observe(), matching what a real browser would report for
// an already-laid-out container.
class StubResizeObserver {
  private callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
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
  clearDeckDocuments();
  vi.stubGlobal('ResizeObserver', StubResizeObserver);
  GlobalWorkerOptions.workerSrc = '';
  getPage.mockReset().mockResolvedValue(makePage());
  getDocument.mockReset().mockReturnValue({ promise: Promise.resolve(makeDoc(5)) });
  HTMLCanvasElement.prototype.getContext = vi
    .fn()
    .mockReturnValue({drawImage: vi.fn()}) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('DeckViewer', () => {
  it('pre-renders the neighbouring pages so the next turn paints from cache', async () => {
    const {rerender}=render(<DeckViewer url="https://example.test/prefetch.pdf" page={3} overlay={<span>page-three</span>} />);
    await waitFor(()=>expect(getPage.mock.calls.map(([n])=>n)).toEqual([3, 4, 2]));
    rerender(<DeckViewer url="https://example.test/prefetch.pdf" page={4} overlay={<span>page-four</span>} />);
    await waitFor(()=>expect(document.body.textContent).toContain('page-four'));
    // Page 4 came from the cache; only its unseen neighbour (5) is rendered.
    await waitFor(()=>expect(getPage.mock.calls.map(([n])=>n)).toEqual([3, 4, 2, 5]));
  });
  it('reuses a recently rendered page at the same size', async () => {
    const {rerender}=render(<DeckViewer url="https://example.test/cache.pdf" page={1} overlay={<span>page-one</span>} />);
    await waitFor(()=>expect(document.body.textContent).toContain('page-one'));
    rerender(<DeckViewer url="https://example.test/cache.pdf" page={2} overlay={<span>page-two</span>} />);
    await waitFor(()=>expect(document.body.textContent).toContain('page-two'));
    const calls=getPage.mock.calls.length;
    rerender(<DeckViewer url="https://example.test/cache.pdf" page={1} overlay={<span>page-one</span>} />);
    await waitFor(()=>expect(document.body.textContent).toContain('page-one'));
    expect(getPage).toHaveBeenCalledTimes(calls);
  });
  it('loads the document, sets the worker once, and reports the page count', async () => {
    const onNumPages = vi.fn();
    render(<DeckViewer url="https://example.test/deck.pdf" page={1} onNumPages={onNumPages} />);
    await waitFor(() => expect(onNumPages).toHaveBeenCalledWith(5));
    // disableRange/disableStream: a Range-requesting fetch triggers a CORS
    // preflight that Supabase Storage's public-object endpoint doesn't
    // satisfy, so decks must load via one plain GET instead.
    expect(getDocument).toHaveBeenCalledWith({
      url: 'https://example.test/deck.pdf',
      disableRange: true,
      disableStream: true,
    });
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
    await waitFor(() =>
      expect(getDocument).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://example.test/deck-a.pdf' }),
      ),
    );
    rerender(<DeckViewer url="https://example.test/deck-b.pdf" page={1} />);
    await waitFor(() =>
      expect(getDocument).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://example.test/deck-b.pdf' }),
      ),
    );
    expect(getDocument).toHaveBeenCalledTimes(2);
  });
  it('reuses the downloaded deck when a viewer is remounted (e.g. after a blank screen)', async () => {
    const first = render(<DeckViewer url="https://example.test/deck.pdf" page={1} />);
    await waitFor(() => expect(getPage).toHaveBeenCalledWith(1));
    first.unmount();
    const onNumPages = vi.fn();
    render(<DeckViewer url="https://example.test/deck.pdf" page={2} onNumPages={onNumPages} />);
    await waitFor(() => expect(getPage).toHaveBeenCalledWith(2));
    expect(onNumPages).toHaveBeenCalledWith(5);
    expect(getDocument).toHaveBeenCalledTimes(1);
  });
  it('paints a remounted viewer from the shared page cache without rendering again', async () => {
    const first = render(<DeckViewer url="https://example.test/deck.pdf" page={1} />);
    // Page 1 plus its warmed neighbour, page 2.
    await waitFor(() => expect(getPage).toHaveBeenCalledTimes(2));
    first.unmount();
    getPage.mockClear();
    const second = render(<DeckViewer url="https://example.test/deck.pdf" page={1} />);
    await waitFor(() => expect(second.container.querySelector('canvas')?.width).toBe(100));
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(getPage).not.toHaveBeenCalled();
  });
  it('tries again after a failed load instead of caching the failure', async () => {
    getDocument.mockReturnValueOnce({ promise: Promise.reject(new Error('offline')) });
    const onError = vi.fn();
    const first = render(<DeckViewer url="https://example.test/flaky.pdf" page={1} onError={onError} />);
    await waitFor(() => expect(onError).toHaveBeenCalled());
    first.unmount();
    render(<DeckViewer url="https://example.test/flaky.pdf" page={1} />);
    await waitFor(() => expect(getPage).toHaveBeenCalledWith(1));
    expect(getDocument).toHaveBeenCalledTimes(2);
  });
  it('reports an error and renders nothing when the document fails to load', async () => {
    getDocument.mockReturnValue({ promise: Promise.reject(new Error('bad pdf')) });
    const onError = vi.fn();
    const { container } = render(
      <DeckViewer url="https://example.test/broken.pdf" page={1} onError={onError} />,
    );
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
    const firstRenderPromise = new Promise<void>((_resolve, reject) => {
      rejectFirst = reject;
    });
    const page1 = {
      getViewport: vi.fn().mockReturnValue({ width: 100, height: 80 }),
      render: vi.fn().mockReturnValue({ promise: firstRenderPromise, cancel }),
    };
    const page2 = makePage();
    getPage.mockImplementation((pageNumber: number) => Promise.resolve(pageNumber === 1 ? page1 : page2));
    const onError = vi.fn();
    const { rerender } = render(
      <DeckViewer url="https://example.test/deck.pdf" page={1} onError={onError} />,
    );
    await waitFor(() => expect(page1.render).toHaveBeenCalled());

    rerender(<DeckViewer url="https://example.test/deck.pdf" page={2} onError={onError} />);
    expect(cancel).toHaveBeenCalled();

    // pdf.js rejects a render task's promise once it's actually cancelled -
    // that rejection must not be mistaken for a real load failure.
    rejectFirst(new Error('RenderingCancelledException'));
    await waitFor(() => expect(page2.render).toHaveBeenCalled());
    expect(onError).not.toHaveBeenCalled();
  });
  it('fits the annotation wrapper to the PDF canvas and hides notes until the page renders', async () => {
    let finish!: () => void;
    const page = makePage();
    page.render.mockReturnValue({
      promise: new Promise<void>((resolve) => {
        finish = resolve;
      }),
      cancel: vi.fn(),
    });
    getPage.mockResolvedValue(page);
    const { container, queryByText } = render(
      <DeckViewer url="https://example.test/deck.pdf" page={1} overlay={<span>notes</span>} />,
    );
    await waitFor(() => expect(page.render).toHaveBeenCalled());
    expect(queryByText('notes')).toBeNull();
    finish();
    await waitFor(() => expect(queryByText('notes')).not.toBeNull());
    expect(container.querySelector('canvas')?.parentElement?.style.width).toBe('100px');
    expect(container.querySelector('canvas')?.parentElement?.style.height).toBe('80px');
  });
  it('does not show the previous page annotations while the next page loads', async () => {
    const { rerender, queryByText } = render(
      <DeckViewer url="https://example.test/deck.pdf" page={1} overlay={<span>page one</span>} />,
    );
    await waitFor(() => expect(queryByText('page one')).not.toBeNull());
    getPage.mockReturnValue(new Promise(() => {}));
    rerender(<DeckViewer url="https://example.test/deck.pdf" page={2} overlay={<span>page two</span>} />);
    expect(queryByText('page one')).toBeNull();
    expect(queryByText('page two')).toBeNull();
  });
});
