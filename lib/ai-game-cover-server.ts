import 'server-only';
import { GoogleGenAI } from '@google/genai';
import { createCoverPrompt, type CoverBrief } from './ai-game-cover';

export async function generateCoverBackground(input: CoverBrief) {
  // Must stay safely below the route's maxDuration (60s, the Vercel Hobby
  // plan's hard ceiling) so a slow response hits our own AI_FAILED handling
  // instead of being hard-killed by the platform mid-request.
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY!, httpOptions: { timeout: 50000, retryOptions: { attempts: 1 } } });
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_IMAGE_MODEL || 'gemini-3.6-flash-image',
    contents: createCoverPrompt(input),
    config: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '16:9', imageSize: '1K' } },
  });
  const part = response.candidates?.[0]?.content?.parts?.find(item => !item.thought && item.inlineData?.data)?.inlineData;
  if (!part?.data || !['image/png', 'image/jpeg', 'image/webp'].includes(part.mimeType || '') || part.data.length > 7_000_000) throw new Error('NO_IMAGE');
  return { data: part.data, mimeType: part.mimeType! };
}
