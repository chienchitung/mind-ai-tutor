import { describe, expect, it, vi } from 'vitest';
import { coverPlacement, DEFAULT_COVER_OPTIONS, drawGameCover, exportGameCover, GAME_COVER_MAX_BYTES, validateCoverFile } from './game-cover';

describe('game cover validation', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp'])('accepts %s', type => {
    expect(() => validateCoverFile({ type, size: GAME_COVER_MAX_BYTES })).not.toThrow();
  });
  it.each(['image/svg+xml', 'image/gif', 'image/heic', 'text/html', ''])('rejects %s', type => {
    expect(() => validateCoverFile({ type, size: 1 })).toThrow('COVER_TYPE');
  });
  it.each([0, GAME_COVER_MAX_BYTES + 1])('rejects invalid size %s', size => {
    expect(() => validateCoverFile({ type: 'image/jpeg', size })).toThrow('COVER_SIZE');
  });
});

describe('16:9 crop geometry', () => {
  it('does not crop a recommended-size cover', () => {
    expect(coverPlacement(1280, 720, DEFAULT_COVER_OPTIONS)).toEqual({ width: 1280, height: 720, x: 0, y: 0 });
  });
  it('centers a portrait and lets the user reveal either edge', () => {
    expect(coverPlacement(720, 1280, DEFAULT_COVER_OPTIONS).y).toBeLessThan(0);
    expect(coverPlacement(720, 1280, { ...DEFAULT_COVER_OPTIONS, y: 0 }).y).toBeCloseTo(0);
    const bottom = coverPlacement(720, 1280, { ...DEFAULT_COVER_OPTIONS, y: 100 });
    expect(bottom.y + bottom.height).toBeCloseTo(720);
  });
  it('centers a wide image and permits horizontal framing', () => {
    const placement = coverPlacement(2560, 720, DEFAULT_COVER_OPTIONS);
    expect(placement.x).toBe(-640);
    expect(coverPlacement(2560, 720, { ...DEFAULT_COVER_OPTIONS, x: 100 }).x).toBe(-1280);
  });
  it('keeps all text visible in contain mode regardless of zoom or position', () => {
    expect(coverPlacement(1000, 1000, { mode: 'contain', zoom: 3, x: 0, y: 100 })).toEqual({ width: 720, height: 720, x: 280, y: 0 });
  });
  it('clamps zoom and pan so cropping never exposes an empty edge', () => {
    const placement = coverPlacement(1280, 720, { mode: 'crop', zoom: 99, x: -20, y: 200 });
    expect(placement.width).toBe(3840);
    expect(placement.x).toBeCloseTo(0);
    expect(placement.y + placement.height).toBe(720);
  });
  it.each([[0, 1], [1, 0], [NaN, 20], [Infinity, 20], [10000, 10000]])('rejects invalid dimensions %s × %s', (w, h) => {
    expect(() => coverPlacement(w, h, DEFAULT_COVER_OPTIONS)).toThrow('COVER_DIMENSIONS');
  });
  it('uses the same geometry for preview and JPEG export with a white background', async () => {
    const context = { fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: '' };
    const canvas = { width: 0, height: 0, getContext: () => context,
      toBlob: vi.fn((callback: BlobCallback) => callback(new Blob(['jpeg'], { type: 'image/jpeg' }))),
    } as unknown as HTMLCanvasElement;
    const source = { width: 1000, height: 1000 } as ImageBitmap;
    drawGameCover(canvas, source, { ...DEFAULT_COVER_OPTIONS, mode: 'contain' });
    expect([canvas.width, canvas.height]).toEqual([1280, 720]);
    expect(context.fillStyle).toBe('#ffffff');
    expect(context.drawImage).toHaveBeenCalledWith(source, 280, 0, 720, 720);
    const result = await exportGameCover(canvas);
    expect(result.type).toBe('image/jpeg');
    expect(result.name).toBe('game-cover.jpg');
    expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.88);
  });
  it('handles a failed browser encoder', async () => {
    const canvas = { toBlob: (callback: BlobCallback) => callback(null) } as HTMLCanvasElement;
    await expect(exportGameCover(canvas)).rejects.toThrow('COVER_PROCESS');
  });
});
