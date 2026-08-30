// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const { resolveFiles, createSegmenter, segment, closeSegmenter, closeResult } = vi.hoisted(() => ({ resolveFiles: vi.fn(), createSegmenter: vi.fn(), segment: vi.fn(), closeSegmenter: vi.fn(), closeResult: vi.fn() }));
vi.mock('@mediapipe/tasks-vision', () => ({ FilesetResolver: { forVisionTasks: resolveFiles }, ImageSegmenter: { createFromOptions: createSegmenter } }));
import { removePortraitBackground } from './portrait-cutout';
let ctx: { drawImage: ReturnType<typeof vi.fn>; putImageData: ReturnType<typeof vi.fn>; createImageData: ReturnType<typeof vi.fn>; globalCompositeOperation: string };
beforeEach(() => {
  vi.clearAllMocks(); resolveFiles.mockResolvedValue({}); createSegmenter.mockResolvedValue({ segment, close: closeSegmenter });
  segment.mockReturnValue({ confidenceMasks: [{ width: 2, height: 1, getAsFloat32Array: () => new Float32Array([0, 1]) }], close: closeResult });
  ctx = { drawImage: vi.fn(), putImageData: vi.fn(), createImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray(8) }), globalCompositeOperation: '' };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ close: vi.fn() }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('local portrait cutout', () => {
  it('uses local model and pinned runtime, modifying only alpha via destination-in', async () => {
    const source = { width: 1200, height: 1200 } as ImageBitmap;
    await removePortraitBackground(source);
    expect(resolveFiles).toHaveBeenCalledWith('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm');
    expect(createSegmenter).toHaveBeenCalledWith({}, expect.objectContaining({ baseOptions: { modelAssetPath: '/models/selfie-segmenter.tflite', delegate: 'CPU' } }));
    expect(ctx.drawImage).toHaveBeenCalledWith(source, 0, 0, 1024, 1024);
    expect(ctx.globalCompositeOperation).toBe('destination-in');
    expect(Array.from(ctx.putImageData.mock.calls[0][0].data)).toEqual([0, 0, 0, 0, 0, 0, 0, 255]);
    expect(closeResult).toHaveBeenCalledTimes(1); expect(closeSegmenter).toHaveBeenCalledTimes(1);
  });
  it('releases resources when no foreground is detected', async () => {
    segment.mockReturnValue({ confidenceMasks: [{ width: 2, height: 1, getAsFloat32Array: () => new Float32Array([0, 0]) }], close: closeResult });
    await expect(removePortraitBackground({ width: 10, height: 10 } as ImageBitmap)).rejects.toThrow('NO_PERSON');
    expect(closeResult).toHaveBeenCalledTimes(1); expect(closeSegmenter).toHaveBeenCalledTimes(1);
  });
});
