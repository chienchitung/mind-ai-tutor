import { describe, expect, it } from 'vitest';
import { concatSamples, downsample, encodeWav } from './wav';

describe('encodeWav', () => {
  it('writes a 16-bit mono PCM header and clamps samples', async () => {
    const blob = encodeWav(new Float32Array([0, 1, -1, 2]), 16_000);
    expect(blob.type).toBe('audio/wav');
    const view = new DataView(await blob.arrayBuffer());
    const text = (offset: number) => String.fromCharCode(...Array.from(new Uint8Array(view.buffer, offset, 4)));
    expect(text(0)).toBe('RIFF');
    expect(text(8)).toBe('WAVE');
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(16_000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(8);
    expect([0, 1, 2, 3].map((i) => view.getInt16(44 + i * 2, true))).toEqual([0, 32767, -32768, 32767]);
  });
});

describe('downsample', () => {
  it('averages windows when reducing the rate and passes equal rates through', () => {
    const input = new Float32Array([0, 1, 2, 3, 4, 5]);
    expect(Array.from(downsample(input, 48_000, 16_000))).toEqual([1, 4]);
    expect(downsample(input, 16_000, 16_000)).toBe(input);
    expect(() => downsample(input, 8_000, 16_000)).toThrow('UPSAMPLE_UNSUPPORTED');
  });
});

describe('concatSamples', () => {
  it('joins chunks in order', () => {
    expect(Array.from(concatSamples([new Float32Array([1]), new Float32Array([2, 3])]))).toEqual([1, 2, 3]);
  });
});
