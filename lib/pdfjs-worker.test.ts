import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// pdf.js refuses to run when the API and worker versions differ ("The API
// version does not match the Worker version"), which silently breaks every
// slide deck and PDF import. The worker is a vendored copy in public/ (the
// legacy build, which polyfills newer JS built-ins for older browsers), so a
// dependency bump must re-copy it from node_modules/pdfjs-dist/legacy/build.
describe('vendored pdf.js worker', () => {
  it('matches the installed pdfjs-dist version', () => {
    const { version } = JSON.parse(readFileSync(join(process.cwd(), 'node_modules/pdfjs-dist/package.json'), 'utf8'));
    const worker = readFileSync(join(process.cwd(), 'public/pdfjs/pdf.worker.min.mjs'), 'utf8');
    expect(worker).toContain(`"${version}"`);
  });
});
