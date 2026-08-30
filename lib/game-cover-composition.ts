import { GAME_COVER_WIDTH, GAME_COVER_HEIGHT } from './game-cover';

export interface PosterOptions { title: string; subtitle: string; teacherName: string; portraitX: number; portraitY: number; portraitZoom: number }
export const DEFAULT_POSTER = { portraitX: 50, portraitY: 50, portraitZoom: 1 };
export const COVER_FONT = '"MindCoverTC", "Noto Sans TC", sans-serif';
let fontPromise: Promise<void> | null = null;

export function loadCoverFonts(): Promise<void> {
  if (!fontPromise) {
    fontPromise = new FontFace('MindCoverTC', 'url(/fonts/NotoSansTC-variable.ttf)', { weight: '100 900' }).load()
      .then(font => { document.fonts.add(font); })
      .catch(cause => { fontPromise = null; throw cause; });
  }
  return fontPromise;
}

export function wrapCoverText(text: string, maxWidth: number, measure: (value: string) => number) {
  const lines: string[] = []; let line = '';
  for (const char of Array.from(text.replace(/\s+/g, ' ').trim())) {
    if (line && measure(line + char) > maxWidth) { lines.push(line.trim()); line = char; }
    else line += char;
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

export function portraitPlacement(width: number, height: number, options: Pick<PosterOptions, 'portraitX' | 'portraitY' | 'portraitZoom'>) {
  if (width <= 0 || height <= 0 || !Number.isFinite(width + height)) throw new Error('COVER_DIMENSIONS');
  const clamp = (n: number, min: number, max: number) => Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : min;
  const scale = Math.max(500 / width, 530 / height) * clamp(options.portraitZoom, 1, 2.5);
  return { width: width * scale, height: height * scale, x: 744 + (500 - width * scale) * clamp(options.portraitX, 0, 100) / 100, y: 126 + (530 - height * scale) * clamp(options.portraitY, 0, 100) / 100 };
}

export function drawCoverPoster(canvas: HTMLCanvasElement, background: ImageBitmap | null, logo: HTMLImageElement, options: PosterOptions, portrait: ImageBitmap | null) {
  canvas.width = GAME_COVER_WIDTH; canvas.height = GAME_COVER_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('COVER_PROCESS');
  ctx.fillStyle = '#edf7f6'; ctx.fillRect(0, 0, 1280, 720);
  if (background) {
    const scale = Math.max(1280 / background.width, 720 / background.height);
    ctx.drawImage(background, (1280 - background.width * scale) / 2, (720 - background.height * scale) / 2, background.width * scale, background.height * scale);
  }
  const fade = ctx.createLinearGradient(0, 0, 1150, 0);
  fade.addColorStop(0, '#f9fcff'); fade.addColorStop(0.5, '#f9fcff'); fade.addColorStop(0.8, '#f9fcff00');
  ctx.fillStyle = fade; ctx.fillRect(0, 0, 1280, 720);
  ctx.drawImage(logo, 54, 36, 285, 45);
  ctx.fillStyle = '#158c91'; ctx.fillRect(56, 164, 56, 6);
  let size = 72; let lines: string[] = [];
  do { ctx.font = `800 ${size}px ${COVER_FONT}`; lines = wrapCoverText(options.title, 638, value => ctx.measureText(value).width); if (lines.length <= 3) break; size -= 2; } while (size >= 30);
  // UI bounds title to 48 characters. Never silently cut text in the exported image.
  if (lines.length > 3) throw new Error('TITLE_TOO_LONG');
  ctx.fillStyle = '#142e47'; ctx.textBaseline = 'top';
  lines.forEach((line, index) => ctx.fillText(line, 54, 201 + index * size * 1.24));
  ctx.font = `500 28px ${COVER_FONT}`;
  const subtitle = wrapCoverText(options.subtitle, 630, value => ctx.measureText(value).width);
  if (subtitle.length > 3) throw new Error('SUBTITLE_TOO_LONG');
  ctx.fillStyle = '#446075'; subtitle.forEach((line, index) => ctx.fillText(line, 56, 201 + lines.length * size * 1.24 + 24 + index * 38));
  if (portrait) {
    const box = portraitPlacement(portrait.width, portrait.height, options);
    ctx.save(); ctx.beginPath(); ctx.rect(744, 126, 500, 530); ctx.clip();
    ctx.drawImage(portrait, box.x, box.y, box.width, box.height); ctx.restore();
    if (options.teacherName.trim()) {
      ctx.fillStyle = '#142e47e8'; ctx.fillRect(766, 592, 456, 64);
      ctx.font = `700 27px ${COVER_FONT}`; ctx.fillStyle = '#ffffff'; ctx.fillText(options.teacherName, 789, 609, 410);
    }
  }
  ctx.fillStyle = '#142e47'; ctx.fillRect(0, 680, 1280, 40);
  ctx.fillStyle = '#87e3d2'; ctx.fillRect(0, 680, 190, 5);
}

export function loadCoverLogo(): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('LOGO_LOAD')); img.src = '/brand/mindaitutor-cover-logo.svg'; });
}
