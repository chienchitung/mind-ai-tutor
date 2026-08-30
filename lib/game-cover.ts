export const GAME_COVER_WIDTH = 1280;
export const GAME_COVER_HEIGHT = 720;
export const GAME_COVER_MAX_BYTES = 5 * 1024 * 1024;
export const GAME_COVER_MAX_PIXELS = 24_000_000;
export const GAME_COVER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export type CoverMode = 'crop' | 'contain';
export interface CoverOptions { mode: CoverMode; zoom: number; x: number; y: number }
export const DEFAULT_COVER_OPTIONS: CoverOptions = { mode: 'crop', zoom: 1, x: 50, y: 50 };

export function validateCoverFile(file: Pick<File, 'type' | 'size'>) {
  if (!GAME_COVER_TYPES.includes(file.type)) throw new Error('COVER_TYPE');
  if (file.size <= 0 || file.size > GAME_COVER_MAX_BYTES) throw new Error('COVER_SIZE');
}

// The preview and exported file share these exact coordinates.
export function coverPlacement(width: number, height: number, options: CoverOptions) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || width * height > GAME_COVER_MAX_PIXELS) {
    throw new Error('COVER_DIMENSIONS');
  }
  const clamp = (value: number, min: number, max: number) => Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min;
  const contain = options.mode === 'contain';
  const scale = (contain ? Math.min : Math.max)(GAME_COVER_WIDTH / width, GAME_COVER_HEIGHT / height)
    * (contain ? 1 : clamp(options.zoom, 1, 3));
  const drawWidth = width * scale;
  const drawHeight = height * scale;
  return {
    width: drawWidth,
    height: drawHeight,
    x: (GAME_COVER_WIDTH - drawWidth) * (contain ? 0.5 : clamp(options.x, 0, 100) / 100),
    y: (GAME_COVER_HEIGHT - drawHeight) * (contain ? 0.5 : clamp(options.y, 0, 100) / 100),
  };
}

export function drawGameCover(canvas: HTMLCanvasElement, source: ImageBitmap, options: CoverOptions) {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('COVER_PROCESS');
  const placement = coverPlacement(source.width, source.height, options);
  canvas.width = GAME_COVER_WIDTH;
  canvas.height = GAME_COVER_HEIGHT;
  // JPEG has no alpha: use a predictable white background for transparent art and contain mode.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, placement.x, placement.y, placement.width, placement.height);
}

export async function exportGameCover(canvas: HTMLCanvasElement) {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(result => result ? resolve(result) : reject(new Error('COVER_PROCESS')), 'image/jpeg', 0.88);
  });
  validateCoverFile(blob);
  return new File([blob], 'game-cover.jpg', { type: 'image/jpeg' });
}

export function coverErrorMessage(error: unknown, chinese: boolean) {
  const code = error instanceof Error ? error.message : '';
  const messages: Record<string, [string, string]> = {
    COVER_TYPE: ['請選擇 JPG、PNG 或 WebP 圖片；不支援 SVG、GIF 或 HEIC。', 'Choose JPG, PNG or WebP. SVG, GIF and HEIC are not supported.'],
    COVER_SIZE: ['圖片必須大於 0 且不超過 5 MB。', 'Choose a non-empty image up to 5 MB.'],
    COVER_DIMENSIONS: ['圖片像素過大，請先縮小至 2,400 萬像素以內。', 'Resize the image to no more than 24 megapixels.'],
    COVER_AUTH: ['登入已過期，請重新登入後再上傳。', 'Your session expired. Sign in again to upload.'],
    COVER_STORAGE_NOT_READY: ['封面儲存空間尚未設定，請管理員執行 add_game_cover_storage.sql。', 'Cover storage is not configured. Ask an administrator to run add_game_cover_storage.sql.'],
    COVER_UPLOAD: ['封面上傳失敗，請確認網路及上傳權限後重試。你的草稿仍保留。', 'Cover upload failed. Check your connection and upload permissions, then retry. Your draft is kept.'],
  };
  return messages[code]?.[chinese ? 0 : 1] ?? (chinese ? '無法處理這張圖片，請改用其他 JPG、PNG 或 WebP 圖片。' : 'Unable to process this image. Try another JPG, PNG or WebP.');
}
