// Add global TypeScript declarations
declare module 'html2pdf.js';
declare module 'file-saver';
declare module 'jspdf';

// Fix ClipboardItem for TypeScript
interface ClipboardItems {
  [type: string]: Blob;
}

interface Clipboard {
  write(data: ClipboardItem[]): Promise<void>;
}

declare class ClipboardItem {
  constructor(items: ClipboardItems);
} 