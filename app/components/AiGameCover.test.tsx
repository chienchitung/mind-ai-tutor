// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AiGameCover } from './AiGameCover';
import { GameCoverInput } from './GameCoverInput';

const { draw, exportCover } = vi.hoisted(() => ({ draw: vi.fn(), exportCover: vi.fn() }));
vi.mock('@/lib/game-cover-composition', async importOriginal => ({ ...await importOriginal<object>(), drawCoverPoster: draw, loadCoverLogo: vi.fn().mockResolvedValue({}), loadCoverFonts: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/game-cover', async importOriginal => ({ ...await importOriginal<object>(), exportGameCover: exportCover }));
const context = { title: 'Excel Master', description: '學習資料分析', topics: ['SUM：學習加總'] };
let fetchMock: ReturnType<typeof vi.fn>;
const props = () => ({ context, chinese: true, disabled: false, onApply: vi.fn(), onCancel: vi.fn() });
beforeEach(() => {
  vi.clearAllMocks(); fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('createImageBitmap', vi.fn().mockImplementation(async () => ({ width: 1280, height: 720, close: vi.fn() })));
  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve() } });
  URL.createObjectURL = vi.fn().mockReturnValue('blob:preview'); URL.revokeObjectURL = vi.fn();
  exportCover.mockResolvedValue(new File(['cover'], 'game-cover.jpg', { type: 'image/jpeg' }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const consent = () => fireEvent.click(screen.getByLabelText(/我同意將上方標題/));
const generate = async () => {
  await waitFor(() => expect((screen.getByText('生成封面背景') as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByText('生成封面背景'));
};
const respond = () => fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: btoa('fake-png'), mimeType: 'image/png' }) });

describe('AI cover workflow', () => {
  it('requires consent and a generated image before adoption', async () => {
    const p = props(); render(<AiGameCover {...p} />);
    await waitFor(() => expect(draw).toHaveBeenCalled());
    expect((screen.getByText('生成封面背景') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByText('使用此封面') as HTMLButtonElement).disabled).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled(); expect(p.onApply).not.toHaveBeenCalled();
  });
  it('generates once and does not mutate the cover until explicitly adopted', async () => {
    respond(); const p = props(); render(<AiGameCover {...p} />); consent();
    await waitFor(() => expect((screen.getByText('生成封面背景') as HTMLButtonElement).disabled).toBe(false));
    // Hold the element reference rather than re-querying by label: the label
    // itself now flips to a "generating…" state on the very first click.
    const generateButton = screen.getByText('生成封面背景');
    fireEvent.click(generateButton);
    fireEvent.click(generateButton);
    await screen.findByText('重新生成背景');
    expect(fetchMock).toHaveBeenCalledTimes(1); expect(p.onApply).not.toHaveBeenCalled();
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload).toMatchObject({ title: context.title, brief: context.description, topics: context.topics, consent: true });
    expect(payload).not.toHaveProperty('photo');
    fireEvent.change(screen.getByLabelText(/封面標題/), { target: { value: '資料探險' } });
    fireEvent.click(screen.getByText('使用此封面'));
    await waitFor(() => expect(p.onApply).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(draw).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), expect.anything(), expect.objectContaining({ title: '資料探險' }), null);
  });
  it('keeps the last generated draft if a regeneration fails', async () => {
    respond(); const p = props(); render(<AiGameCover {...p} />); consent(); await generate();
    await screen.findByText('重新生成背景');
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: 'DAILY_LIMIT' }) });
    fireEvent.click(screen.getByText('重新生成背景'));
    await screen.findByRole('alert');
    expect((screen.getByText('使用此封面') as HTMLButtonElement).disabled).toBe(false);
    expect(p.onApply).not.toHaveBeenCalled();
  });
  it('requires photo rights and never sends the portrait or name to the provider', async () => {
    respond(); const p = props(); render(<AiGameCover {...p} />);
    fireEvent.click(screen.getByLabelText('加入講師照片'));
    expect((screen.getByRole('button', { name: '上傳講師照片' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText(/我有權使用此講師照片/));
    fireEvent.change(screen.getByLabelText('上傳講師照片'), { target: { files: [new File(['photo'], 'teacher.png', { type: 'image/png' })] } });
    await screen.findByText('自動去背（本機）');
    fireEvent.change(screen.getByLabelText('講師姓名（選填）'), { target: { value: 'Teacher private name' } });
    consent(); await generate();
    await screen.findByText('重新生成背景');
    expect(fetchMock.mock.calls[0][1].body).not.toMatch(/Teacher private name|teacher.png|photo/);
  });
  it('offers exactly upload/AI entry points and preserves legacy URL on cancel', async () => {
    const onChange = vi.fn(), onFileChange = vi.fn();
    render(<GameCoverInput context={context} chinese value="https://existing.test/old.jpg" file={null} onChange={onChange} onFileChange={onFileChange} onEditingChange={vi.fn()} />);
    // Cover editing lives behind a dialog trigger, keeping the main form compact.
    fireEvent.click(screen.getByRole('button', { name: '更換封面' }));
    expect(screen.queryByText('或使用圖片網址')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'AI 生成' }));
    fireEvent.click(screen.getByText('取消，保留原封面'));
    expect(onChange).not.toHaveBeenCalled(); expect(onFileChange).not.toHaveBeenCalled();
    expect(screen.getByAltText('遊戲封面預覽').getAttribute('src')).toBe('https://existing.test/old.jpg');
  });
  it('aborts a dismissed request and does not replace the cover when it completes late', async () => {
    let complete!: (value: unknown) => void;
    fetchMock.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    const p = props(); const view = render(<AiGameCover {...p} />); consent(); await generate();
    const signal = fetchMock.mock.calls[0][1].signal;
    view.unmount(); expect(signal.aborted).toBe(true);
    complete({ ok: true, json: async () => ({ data: btoa('fake'), mimeType: 'image/png' }) });
    await waitFor(() => expect(createImageBitmap).toHaveBeenCalled());
    expect(p.onApply).not.toHaveBeenCalled();
  });
});
