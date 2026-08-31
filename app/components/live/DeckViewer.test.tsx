// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { DeckViewer } from './DeckViewer';

const getPage = vi.fn();
const getDocument = vi.fn();
const GlobalWorkerOptions: { workerSrc: string } = { workerSrc: '' };

vi.mock('pdfjs-dist/build/pdf', () => ({ getDocument, GlobalWorkerOptions }));

function makeDoc(numPages: number) {
  return { numPages, getPage };
}
function makePage() {
  return {
    getViewport: vi.fn().mockReturnValue({ width: 100, height: 80 }),
    render: vi.fn().mockReturnValue({ promise: Promise.resolve() }),
  };
}

beforeEach(() => {
  GlobalWorkerOptions.workerSrc = '';
  getPage.mockReset().mockResolvedValue(makePage());
  getDocument.mockReset().mockReturnValue({ promise: Promise.resolve(makeDoc(5)) });
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({}) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

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
});
