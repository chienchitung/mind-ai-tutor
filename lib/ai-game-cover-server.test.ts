import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const { generateContent, construct } = vi.hoisted(() => ({ generateContent: vi.fn(), construct: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@google/genai', () => ({ GoogleGenAI: class { models = { generateContent }; constructor(options: unknown) { construct(options); } } }));
import { generateCoverBackground } from './ai-game-cover-server';
const brief = { title: 'Excel', brief: '', topics: [], style: 'minimal' as const };
const image = { inlineData: { data: 'aW1hZ2U=', mimeType: 'image/png' } };
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('GEMINI_API_KEY', 'server-test-key'); vi.stubEnv('GEMINI_IMAGE_MODEL', ''); });
afterEach(() => vi.unstubAllEnvs());
describe('image model adapter', () => {
  it('uses a server-only key, explicit image model, timeout, no automatic retry and 16:9', async () => {
    generateContent.mockResolvedValue({ candidates: [{ content: { parts: [image] } }] });
    expect(await generateCoverBackground(brief)).toEqual(image.inlineData);
    expect(construct).toHaveBeenCalledWith({ apiKey: 'server-test-key', httpOptions: { timeout: 50000, retryOptions: { attempts: 1 } } });
    expect(generateContent).toHaveBeenCalledWith(expect.objectContaining({ model: 'gemini-3.6-flash-image', config: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '16:9', imageSize: '1K' } } }));
  });
  it('skips thinking images and uses the final image', async () => {
    generateContent.mockResolvedValue({ candidates: [{ content: { parts: [{ ...image, thought: true, inlineData: { ...image.inlineData, data: 'thinking' } }, image] } }] });
    expect(await generateCoverBackground(brief)).toEqual(image.inlineData);
  });
  it.each([{}, { candidates: [{ content: { parts: [{ text: 'blocked' }] } }] }, { candidates: [{ content: { parts: [{ inlineData: { data: 'bad', mimeType: 'image/svg+xml' } }] } }] }])('rejects empty, blocked and non-raster responses', async response => {
    generateContent.mockResolvedValue(response);
    await expect(generateCoverBackground(brief)).rejects.toThrow('NO_IMAGE');
  });
});
