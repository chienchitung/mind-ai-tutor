'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ImagePlus, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AiGameCover } from './AiGameCover';
import type { CoverContext } from '@/lib/ai-game-cover';
import {
  DEFAULT_COVER_OPTIONS, GAME_COVER_HEIGHT, GAME_COVER_WIDTH,
  coverErrorMessage, coverPlacement, drawGameCover, exportGameCover, validateCoverFile,
  type CoverOptions,
} from '@/lib/game-cover';

interface GameCoverInputProps {
  value: string;
  file: File | null;
  onChange: (url: string) => void;
  onFileChange: (file: File | null) => void;
  onEditingChange: (editing: boolean) => void;
  disabled?: boolean;
  chinese: boolean;
  context: CoverContext;
}

export function GameCoverInput({ value, file, onChange, onFileChange, onEditingChange, disabled = false, chinese, context }: GameCoverInputProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const generation = useRef(0);
  const [source, setSource] = useState<ImageBitmap | null>(null);
  const [options, setOptions] = useState<CoverOptions>(DEFAULT_COVER_OPTIONS);
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [imageFailed, setImageFailed] = useState(false);
  const [mode, setMode] = useState<'upload' | 'ai'>('upload');
  const busy = disabled || loading || processing;
  const say = (zh: string, en: string) => chinese ? zh : en;

  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => { setImageFailed(false); }, [value, preview]);
  useEffect(() => () => { generation.current += 1; }, []);
  useEffect(() => () => source?.close(), [source]);
  useEffect(() => {
    onEditingChange(Boolean(source) || loading || processing || mode === 'ai');
  }, [source, loading, processing, mode, onEditingChange]);
  useEffect(() => {
    if (!source || !canvasRef.current) return;
    try { drawGameCover(canvasRef.current, source, options); }
    catch (cause) { setError(coverErrorMessage(cause, chinese)); }
  }, [source, options, chinese]);

  async function chooseFile(selected: File | undefined) {
    if (!selected || busy) return;
    const current = ++generation.current;
    setError('');
    setLoading(true);
    setSource(null);
    try {
      validateCoverFile(selected);
      const bitmap = await createImageBitmap(selected, { imageOrientation: 'from-image' });
      if (current !== generation.current) { bitmap.close(); return; }
      try { coverPlacement(bitmap.width, bitmap.height, DEFAULT_COVER_OPTIONS); }
      catch (cause) { bitmap.close(); throw cause; }
      setOptions(DEFAULT_COVER_OPTIONS);
      setSource(bitmap);
    } catch (cause) {
      if (current === generation.current) setError(coverErrorMessage(cause, chinese));
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }

  async function applyCover() {
    if (busy || !source || !canvasRef.current) return;
    const current = generation.current;
    setError('');
    setProcessing(true);
    try {
      drawGameCover(canvasRef.current, source, options);
      const result = await exportGameCover(canvasRef.current);
      if (current !== generation.current) return;
      onFileChange(result);
      setSource(null);
    } catch (cause) {
      if (current === generation.current) setError(coverErrorMessage(cause, chinese));
    } finally {
      if (current === generation.current) setProcessing(false);
    }
  }

  return (
    <div className="space-y-3" role="group" aria-labelledby={`${id}-label`} aria-busy={loading || processing}>
      <div>
        <p id={`${id}-label`} className="text-sm font-medium">{say('遊戲封面（選填）', 'Game cover (optional)')}</p>
        <p id={`${id}-help`} className="mt-1 text-xs leading-5 text-muted-foreground">
          {say('建議 1280 × 720 px（16:9），支援 JPG、PNG、WebP，最大 5 MB。選圖後可調整裁切。', 'Recommended: 1280 × 720 px (16:9). JPG, PNG or WebP, up to 5 MB. Adjust the crop after choosing an image.')}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label={say('封面來源', 'Cover source')}>
        <Button type="button" variant={mode === 'upload' ? 'default' : 'outline'} aria-pressed={mode === 'upload'} disabled={busy || Boolean(source) || mode === 'ai'} onClick={() => setMode('upload')}>{say('自行上傳', 'Upload image')}</Button>
        <Button type="button" variant={mode === 'ai' ? 'default' : 'outline'} aria-pressed={mode === 'ai'} disabled={busy || Boolean(source) || mode === 'ai'} onClick={() => setMode('ai')}>{say('AI 生成', 'Generate with AI')}</Button>
      </div>
      {mode === 'ai' && <AiGameCover context={context} chinese={chinese} disabled={disabled}
        onCancel={() => setMode('upload')} onApply={result => { onFileChange(result); setMode('upload'); }} />}
      <input ref={inputRef} id={`${id}-file`} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1}
        disabled={busy} aria-label={say('選擇遊戲封面圖片', 'Choose game cover image')} aria-describedby={`${id}-help`}
        onChange={event => { void chooseFile(event.target.files?.[0]); event.target.value = ''; }} />
      {mode === 'upload' && <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
          {say(value || file ? '更換封面圖片' : '上傳封面圖片', value || file ? 'Replace cover image' : 'Upload cover image')}
        </Button>
        {(value || file) && !source && <Button type="button" variant="ghost" disabled={busy} onClick={() => { onFileChange(null); onChange(''); setError(''); }}>
          <Trash2 className="mr-2 h-4 w-4" />{say('移除封面', 'Remove cover')}
        </Button>}
      </div>}

      {source ? (
        <div className="max-w-2xl space-y-4 rounded-xl border bg-muted/20 p-3 sm:p-4">
          <canvas ref={canvasRef} width={GAME_COVER_WIDTH} height={GAME_COVER_HEIGHT}
            className="aspect-video w-full rounded-lg border bg-white" role="img" aria-label={say('16:9 封面裁切預覽', '16:9 cover crop preview')} />
          <fieldset disabled={busy} className="min-w-0 space-y-3">
            <legend className="mb-2 text-sm font-medium">{say('圖片呈現方式', 'Image framing')}</legend>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="radio" name={`${id}-mode`} checked={options.mode === 'crop'}
                onChange={() => setOptions({ ...DEFAULT_COVER_OPTIONS })} />{say('填滿封面（裁切）', 'Fill cover (crop)')}</label>
              <label className="flex items-center gap-2"><input type="radio" name={`${id}-mode`} checked={options.mode === 'contain'}
                onChange={() => setOptions({ ...DEFAULT_COVER_OPTIONS, mode: 'contain' })} />{say('完整保留圖片（白色留邊）', 'Keep entire image (white padding)')}</label>
            </div>
            {options.mode === 'crop' && <div className="grid gap-3 sm:grid-cols-3">
              {([
                ['zoom', say('縮放', 'Zoom'), 1, 3, 0.01],
                ['x', say('水平位置', 'Horizontal position'), 0, 100, 1],
                ['y', say('垂直位置', 'Vertical position'), 0, 100, 1],
              ] as const).map(([key, label, min, max, step]) => <label key={key} className="space-y-1 text-xs">
                <span>{label} ({key === 'zoom' ? `${options[key].toFixed(2)}×` : `${options[key]}%`})</span>
                <input type="range" min={min} max={max} step={step} value={options[key]} aria-label={label}
                  onChange={event => setOptions(previous => ({ ...previous, [key]: Number(event.target.value) }))} className="block w-full accent-primary" />
              </label>)}
            </div>}
          </fieldset>
          {(source.width < GAME_COVER_WIDTH || source.height < GAME_COVER_HEIGHT) && <p className="text-xs text-amber-700 dark:text-amber-400">
            {say('原圖解析度較低，放大後可能模糊；建議使用較清晰的圖片。', 'This image has low resolution and may look blurry when enlarged.')}
          </p>}
          <p className="text-xs text-muted-foreground">{say('確認後輸出為 1280 × 720 JPG；按「儲存遊戲」才會上傳。', 'Exports a 1280 × 720 JPG. Upload happens only when you save the game.')}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void applyCover()} disabled={busy}>
              {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{say('使用此封面', 'Use this cover')}
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => { setSource(null); setError(''); }}>{say('取消裁切', 'Cancel crop')}</Button>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setOptions(DEFAULT_COVER_OPTIONS)}>
              <RotateCcw className="mr-2 h-4 w-4" />{say('重設', 'Reset')}
            </Button>
          </div>
        </div>
      ) : (preview || value) && !imageFailed ? (
        <div className="max-w-md space-y-2">
          {mode === 'ai' && <p className="text-xs font-medium text-muted-foreground">{say('目前封面（確認新圖前仍保留）', 'Current cover (kept until the new one is adopted)')}</p>}
          {/* External URLs and local blob previews must not go through the Next.js image proxy. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview || value} alt={say('遊戲封面預覽', 'Game cover preview')} className="aspect-video w-full rounded-lg border object-cover" onError={() => setImageFailed(true)} />
          {file && <p className="text-xs text-muted-foreground" role="status">{say('封面已準備好，尚未上傳；儲存遊戲時一併上傳。', 'Cover ready, not uploaded yet. Save the game to upload.')}</p>}
        </div>
      ) : null}
      {imageFailed && !source && <p className="text-sm text-destructive">{say('原封面無法顯示，可重新上傳或使用 AI 生成。', 'The existing cover cannot be displayed. Upload or generate a replacement.')}</p>}
      {file && !source && mode === 'upload' && <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => onFileChange(null)}>
        {say('放棄新封面，恢復原設定', 'Discard new cover and restore original setting')}
      </Button>}
      <p className="text-xs text-muted-foreground">{say('封面會公開顯示；請確認圖片使用權，勿放入學生個資或私密內容。', 'Covers are public. Confirm image rights and exclude student or private data.')}</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
