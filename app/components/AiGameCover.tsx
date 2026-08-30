'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Loader2, Sparkles, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { aiCoverError, type CoverContext, type CoverBrief } from '@/lib/ai-game-cover';
import { coverPlacement, DEFAULT_COVER_OPTIONS, exportGameCover, validateCoverFile } from '@/lib/game-cover';
import { DEFAULT_POSTER, drawCoverPoster, loadCoverFonts, loadCoverLogo, type PosterOptions } from '@/lib/game-cover-composition';

interface Props { context: CoverContext; chinese: boolean; disabled: boolean; onApply: (file: File) => void; onCancel: () => void }

export function AiGameCover({ context, chinese, disabled, onApply, onCancel }: Props) {
  const id = useId();
  const say = (zh: string, en: string) => chinese ? zh : en;
  const [poster, setPoster] = useState<PosterOptions>({ ...DEFAULT_POSTER, title: Array.from(context.title).slice(0, 48).join(''), subtitle: '', teacherName: '' });
  const [brief, setBrief] = useState(context.description.slice(0, 2400));
  const [topics, setTopics] = useState(context.topics.slice(0, 20).map(value => value.slice(0, 160)));
  const [style, setStyle] = useState<CoverBrief['style']>('illustration');
  const [consent, setConsent] = useState(false);
  const [photoConsent, setPhotoConsent] = useState(false);
  const [includeTeacher, setIncludeTeacher] = useState(false);
  const [background, setBackground] = useState<ImageBitmap | null>(null);
  const [original, setOriginal] = useState<ImageBitmap | null>(null);
  const [cutout, setCutout] = useState<ImageBitmap | null>(null);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState('');
  const [error, setError] = useState('');
  const [renderError, setRenderError] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null);
  const upload = useRef<HTMLInputElement>(null);
  const active = useRef(true);
  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const blocked = busy || disabled;

  useEffect(() => {
    active.current = true;
    void Promise.all([loadCoverLogo(), loadCoverFonts()]).then(([image]) => { if (active.current) setLogo(image); }).catch(() => { if (active.current) setError(chinese ? '品牌圖示或字型載入失敗，請重新開啟編輯器。' : 'Brand logo or font failed to load. Reopen the editor.'); });
    return () => { active.current = false; controller.current?.abort(); };
  }, [chinese]);
  useEffect(() => () => background?.close(), [background]);
  useEffect(() => () => original?.close(), [original]);
  useEffect(() => () => cutout?.close(), [cutout]);
  useEffect(() => {
    if (!canvas.current || !logo) return;
    try {
      drawCoverPoster(canvas.current, background, logo, poster, includeTeacher ? cutout || original : null);
      setRenderError('');
    } catch { setRenderError(chinese ? '文字太長或預覽無法繪製，請縮短標題與副標題後再試。' : 'Cannot render the preview. Shorten the title and subtitle.'); }
  }, [background, logo, poster, includeTeacher, cutout, original, chinese]);

  function begin(label: string) {
    if (lock.current || disabled) return false;
    lock.current = true; setBusy(true); setActivity(label); setError(''); return true;
  }
  function finish() { lock.current = false; if (active.current) { setBusy(false); setActivity(''); } }
  async function generate() {
    if (!logo || !poster.title.trim() || !consent || !begin(say('正在生成背景…', 'Generating background…'))) return;
    const abort = new AbortController(); controller.current = abort;
    const timer = setTimeout(() => abort.abort(), 100000);
    try {
      const response = await fetch('/api/game-covers/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: abort.signal,
        body: JSON.stringify({ requestId: crypto.randomUUID(), consent: true, title: poster.title, brief, topics, style }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'AI_FAILED');
      if (typeof result.data !== 'string' || result.data.length > 7_000_000 || !['image/png', 'image/jpeg', 'image/webp'].includes(result.mimeType)) throw new Error('NO_IMAGE');
      const bytes = Uint8Array.from(atob(result.data), char => char.charCodeAt(0));
      const blob = new Blob([bytes], { type: result.mimeType }); validateCoverFile(blob);
      const image = await createImageBitmap(blob);
      try { coverPlacement(image.width, image.height, DEFAULT_COVER_OPTIONS); } catch (cause) { image.close(); throw cause; }
      if (!active.current) { image.close(); return; }
      setBackground(image);
    } catch (cause) {
      if (active.current) setError(aiCoverError(cause instanceof Error ? cause.message : 'AI_FAILED', chinese));
    } finally { clearTimeout(timer); finish(); }
  }
  async function selectPortrait(file?: File) {
    if (!file || !photoConsent || !begin(say('讀取照片…', 'Loading photo…'))) return;
    try {
      validateCoverFile(file);
      const image = await createImageBitmap(file, { imageOrientation: 'from-image' });
      try { coverPlacement(image.width, image.height, DEFAULT_COVER_OPTIONS); } catch (cause) { image.close(); throw cause; }
      if (!active.current) { image.close(); return; }
      setCutout(null); setOriginal(image); setPoster(previous => ({ ...previous, ...DEFAULT_POSTER }));
    } catch { if (active.current) setError(say('請選擇 5 MB、2,400 萬像素以內的 JPG、PNG 或 WebP。', 'Use a JPG, PNG or WebP up to 5 MB and 24 megapixels.')); }
    finally { finish(); }
  }
  async function removeBackground() {
    if (!original || !begin(say('正在本機去背，首次需下載模型工具…', 'Removing background locally; first use downloads runtime…'))) return;
    try {
      const { removePortraitBackground } = await import('@/lib/portrait-cutout');
      const image = await removePortraitBackground(original);
      if (!active.current) { image.close(); return; }
      setCutout(image);
    } catch { if (active.current) setError(say('去背未成功，原照片已保留。可直接合成原照，或上傳已去背的透明 PNG。', 'Cutout failed. The original photo is safe; use it directly or upload a transparent PNG.')); }
    finally { finish(); }
  }
  async function apply() {
    if (!background || !logo || !canvas.current || !poster.title.trim() || renderError || (includeTeacher && !photoConsent) || !begin(say('正在製作封面…', 'Preparing cover…'))) return;
    try {
      await document.fonts.ready;
      if (!active.current || !canvas.current) return;
      drawCoverPoster(canvas.current, background, logo, poster, includeTeacher ? cutout || original : null);
      const file = await exportGameCover(canvas.current);
      if (active.current) onApply(file);
    } catch { if (active.current) setError(say('無法匯出封面，草稿仍保留。請縮短文字後重試。', 'Export failed. Your draft is preserved. Shorten the text and retry.')); }
    finally { finish(); }
  }

  return <section className="space-y-4 rounded-xl border bg-muted/20 p-4" aria-label={say('AI 封面工作室', 'AI cover studio')} aria-busy={busy}>
    <div><h4 className="font-semibold">{say('AI 封面工作室', 'AI cover studio')}</h4><p className="mt-1 text-xs leading-5 text-muted-foreground">{say('AI 畫主題視覺，系統排上原版 logo 與文字。講師照片在本機合成，不交給生成式 AI 重畫。', 'AI creates the visual; the app adds the original logo and text. Teacher photos are composed locally, never redrawn by generative AI.')}</p></div>
    <fieldset disabled={blocked} className="space-y-3">
      <legend className="sr-only">{say('生成設定', 'Generation settings')}</legend>
      <label className="block space-y-1 text-sm" htmlFor={`${id}-title`}><span>{say('封面標題（可修改，最多 48 字）', 'Cover title (up to 48 characters)')}</span><Input id={`${id}-title`} value={poster.title} maxLength={48} onChange={e => setPoster({ ...poster, title: e.target.value })} /></label>
      <label className="block space-y-1 text-sm" htmlFor={`${id}-subtitle`}><span>{say('一句學習收穫（選填，最多 60 字）', 'Learning outcome (optional, up to 60 characters)')}</span><Input id={`${id}-subtitle`} value={poster.subtitle} maxLength={60} onChange={e => setPoster({ ...poster, subtitle: e.target.value })} /></label>
      <label className="block space-y-1 text-sm" htmlFor={`${id}-brief`}><span>{say('給 AI 的課程摘要', 'Course brief for AI')}</span><Textarea id={`${id}-brief`} value={brief} maxLength={2400} rows={3} onChange={e => setBrief(e.target.value)} /></label>
      <div className="text-xs text-muted-foreground">{say('關卡主題：', 'Lesson topics: ')}{topics.join('、') || say('尚未選擇關卡', 'No lessons selected')}</div>
      <Button type="button" size="sm" variant="outline" onClick={() => { setBrief(context.description.slice(0, 2400)); setTopics(context.topics.slice(0, 20).map(value => value.slice(0, 160))); setPoster({ ...poster, title: Array.from(context.title).slice(0, 48).join('') }); }}>{say('重新帶入目前課程資料', 'Refresh from current course')}</Button>
      <label className="block space-y-1 text-sm" htmlFor={`${id}-style`}><span>{say('視覺風格', 'Visual style')}</span><select id={`${id}-style`} className="block h-10 w-full rounded-md border bg-background px-3" value={style} onChange={e => setStyle(e.target.value as CoverBrief['style'])}><option value="illustration">{say('活潑插畫', 'Playful illustration')}</option><option value="technology">{say('科技感', 'Technology')}</option><option value="minimal">{say('簡約幾何', 'Minimal geometry')}</option></select></label>
      <label className="flex items-start gap-2 text-xs leading-5"><input type="checkbox" className="mt-1" checked={consent} onChange={e => setConsent(e.target.checked)} /><span>{say('我同意將上方標題、摘要及關卡主題傳送至 Google Gemini 生成圖片，並確認不包含學生個資或機密內容。每日最多 5 次、間隔 60 秒；失敗與取消可能仍計次或產生服務費用。', 'I consent to sending the title, brief and topics to Google Gemini, with no student or confidential data. Maximum 5 attempts/day, 60 seconds apart. Failed or cancelled attempts may still count and incur provider costs.')}</span></label>
      <Button type="button" disabled={blocked || !logo || !consent || !poster.title.trim()} onClick={() => void generate()}><Sparkles className="mr-2 h-4 w-4" />{background ? say('重新生成背景', 'Regenerate background') : say('生成封面背景', 'Generate background')}</Button>
    </fieldset>
    <fieldset disabled={blocked} className="space-y-3 rounded-lg border bg-background p-3">
      <legend className="px-1 text-sm">{say('講師照片（選填）', 'Teacher photo (optional)')}</legend>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includeTeacher} onChange={e => setIncludeTeacher(e.target.checked)} />{say('加入講師照片', 'Include teacher photo')}</label>
      {includeTeacher && <>
        <p className="text-xs leading-5 text-muted-foreground">{say('照片不傳送至 Google。去背會下載 MediaPipe 工具後在瀏覽器執行；請檢查髮絲及邊緣。最後採用的封面會公開顯示。', 'Photos are not sent to Google. Cutout downloads MediaPipe runtime and runs in your browser; inspect hair and edges. The adopted cover will be public.')}</p>
        <label className="flex items-start gap-2 text-xs leading-5"><input type="checkbox" className="mt-1" checked={photoConsent} onChange={e => setPhotoConsent(e.target.checked)} />{say('我有權使用此講師照片，並同意將其整合至公開課程封面。', 'I have rights to use this photo in a public course cover.')}</label>
        <input ref={upload} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} disabled={!photoConsent || blocked} aria-label={say('上傳講師照片', 'Upload teacher photo')} onChange={e => { void selectPortrait(e.target.files?.[0]); e.target.value = ''; }} />
        <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={!photoConsent || blocked} onClick={() => upload.current?.click()}><Upload className="mr-2 h-4 w-4" />{say('上傳講師照片', 'Upload teacher photo')}</Button>{original && <><Button type="button" variant="outline" onClick={() => void removeBackground()}>{say('自動去背（本機）', 'Remove background locally')}</Button>{cutout && <Button type="button" variant="ghost" onClick={() => setCutout(null)}>{say('恢復原照片', 'Use original photo')}</Button>}<Button type="button" variant="ghost" onClick={() => { setOriginal(null); setCutout(null); }}>{say('移除照片', 'Remove photo')}</Button></>}</div>
        {original && <><label className="block space-y-1 text-sm" htmlFor={`${id}-teacher`}><span>{say('講師姓名（選填）', 'Teacher name (optional)')}</span><Input id={`${id}-teacher`} value={poster.teacherName} maxLength={20} onChange={e => setPoster({ ...poster, teacherName: e.target.value })} /></label><div className="grid gap-3 sm:grid-cols-3">{([
          ['portraitX', say('水平位置', 'Horizontal'), 0, 100, 1], ['portraitY', say('垂直位置', 'Vertical'), 0, 100, 1], ['portraitZoom', say('人物大小', 'Size'), 1, 2.5, 0.01],
        ] as const).map(([key, label, min, max, step]) => <label key={key} className="text-xs">{label}<input type="range" className="block w-full" min={min} max={max} step={step} value={poster[key]} onChange={e => setPoster({ ...poster, [key]: Number(e.target.value) })} /></label>)}</div></>}
      </>}
    </fieldset>
    <div className="space-y-2">{!logo && <p role="status" className="text-xs text-muted-foreground">{say('正在載入品牌字型與圖示，首次約需下載 12 MB…', 'Loading brand font and logo; first use downloads about 12 MB…')}</p>}<canvas ref={canvas} width={1280} height={720} className="aspect-video w-full rounded-lg border bg-white" role="img" aria-label={say('AI 封面合成預覽', 'AI cover composition preview')} /><p className="text-xs text-muted-foreground">{background ? say('可直接修改文字與人物，不需重新生成。確認後輸出 1280 × 720 JPG，儲存遊戲時才上傳。', 'Edit text and portrait without regenerating. Exports a 1280 × 720 JPG; uploaded only when saving the game.') : say('目前僅為排版預覽，請先生成背景。', 'Layout preview only. Generate a background first.')}</p></div>
    {activity && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />{activity}</p>}
    {(error || renderError) && <p role="alert" className="text-sm text-destructive">{error || renderError}</p>}
    <div className="flex flex-wrap gap-2"><Button type="button" onClick={() => void apply()} disabled={blocked || !background || !logo || !poster.title.trim() || Boolean(renderError) || (includeTeacher && (!original || !photoConsent))}>{say('使用此封面', 'Use this cover')}</Button><Button type="button" variant="outline" disabled={disabled} onClick={onCancel}>{say('取消，保留原封面', 'Cancel, keep existing cover')}</Button></div>
  </section>;
}
