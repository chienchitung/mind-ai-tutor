'use client';

const MAX_PAGES = 300;
const MAX_CHARS_PER_PAGE = 4_000;

// Pulls each slide's text out of the session's PDF in the browser (pdf.js is
// already loaded there for the deck viewer), so the notes prompt can align
// the transcript with what was on screen without a server-side PDF parser.
export async function extractDeckText(url: string): Promise<{ page: number; text: string }[]> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
  }
  const task = pdfjsLib.getDocument({ url, disableRange: true, disableStream: true });
  const pdf = await task.promise;
  try {
    const pages: { page: number; text: string }[] = [];
    for (let page = 1; page <= Math.min(pdf.numPages, MAX_PAGES); page++) {
      const content = await (await pdf.getPage(page)).getTextContent();
      const text = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, MAX_CHARS_PER_PAGE);
      // Kept even without text (a picture slide), so the notes can still
      // list it among the pages that were not covered.
      pages.push({ page, text });
    }
    return pages;
  } finally {
    void task.destroy();
  }
}
