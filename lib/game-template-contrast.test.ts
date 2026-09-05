import { describe, expect, it } from 'vitest';

function luminance(hex: string) {
  const rgb = hex.match(/[\da-f]{2}/gi)!.map(value => Number.parseInt(value, 16) / 255).map(value => value <= .03928 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
}
function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + .05) / (values[1] + .05);
}

describe('game visual-template reading contrast', () => {
  it.each([
    ['Neo lesson body', '#222222', '#ffffff'],
    ['Neo header', '#111111', '#ff6b9d'],
    ['Arcade lesson body', '#e6e7ff', '#151233'],
    ['Arcade heading', '#70efff', '#151233'],
    ['Arcade breadcrumb', '#d9dcff', '#090720'],
    ['Arcade header label', '#a9a4d4', '#100c2f'],
  ])('%s meets WCAG AA for normal text', (_, foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });
});
