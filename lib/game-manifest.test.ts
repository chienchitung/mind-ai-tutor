import { describe, expect, it, vi } from 'vitest';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('../game-engine/src/lib/supabase', () => ({ supabase: { rpc } }));
import { getPublicGameManifest } from '../game-engine/src/lib/game-manifest';

const row = (id: string, position: number) => ({
  id, position, title: `老師課程 ${id}`, description: '老師原始摘要', duration: 15,
  level: 'beginner', teaching_content: '原始教學內容', markdown_content: '# 原始教材',
  practice_exercises: [{ question: '原題目', answer: '答案', explanation: '原解析' }],
  genially_link: 'https://view.genially.com/example', metadata: null,
});

describe('public game manifest presentation compatibility', () => {
  it('keeps configured order, original materials, questions and IDs while adding game-specific mission', async () => {
    const source = [row('b', 1), row('a', 2)];
    rpc.mockResolvedValueOnce({ error: null, data: { id: 'game-a', title: 'Excel Master', settings: { lessonOverrides: { b: { number: 0, role: 'intro', cardDescription: '遊戲摘要', mission: { scenario: ' 幫忙核對預算 ', objective: '核對總額' } } } }, lessons: source } });
    const game = await getPublicGameManifest('game-a');
    expect(rpc).toHaveBeenLastCalledWith('get_public_game_manifest', { p_game_id: 'game-a' });
    expect(game.lessons.map(lesson => lesson.lesson_id)).toEqual(['b', 'a']);
    expect(game.lessons[0]).toMatchObject({ title: '老師課程 b', number: 0, role: 'intro', description: '遊戲摘要', content: source[0].teaching_content, markdownContent: source[0].markdown_content, practiceExercises: source[0].practice_exercises, geniallyLink: source[0].genially_link, mission: { scenario: '幫忙核對預算', objective: '核對總額' } });
    expect(source[0].title).toBe('老師課程 b');
  });
  it('supports old games without mission/settings and retains final-role fallback', async () => {
    rpc.mockResolvedValueOnce({ error: null, data: { id: 'old', title: '舊遊戲', settings: null, lessons: [row('one', 1), row('two', 2)] } });
    const game = await getPublicGameManifest('old');
    expect(game.lessons[0].mission).toBeUndefined();
    expect(game.lessons[0].description).toBe('老師原始摘要');
    expect(game.lessons[1]).toMatchObject({ role: 'final', isFinal: true });
  });
  it('isolates stories between two games referencing the same lesson', async () => {
    for (const scenario of ['活動預算', '研究資料']) {
      rpc.mockResolvedValueOnce({ error: null, data: { id: scenario, title: scenario, settings: { lessonOverrides: { shared: { mission: { scenario } } } }, lessons: [row('shared', 1)] } });
    }
    const first = await getPublicGameManifest('first');
    const second = await getPublicGameManifest('second');
    expect(first.lessons[0].mission?.scenario).toBe('活動預算');
    expect(second.lessons[0].mission?.scenario).toBe('研究資料');
  });
  it('does not derive an HTML lesson body as a map summary', async () => {
    rpc.mockResolvedValueOnce({ error: null, data: { id: 'empty', settings: {}, lessons: [{ ...row('one', 1), description: null }] } });
    expect((await getPublicGameManifest('empty')).lessons[0].description).toBe('');
  });
  it('surfaces unpublished/missing games instead of using Excel data', async () => {
    rpc.mockResolvedValueOnce({ error: null, data: null });
    await expect(getPublicGameManifest('missing')).rejects.toThrow('Game not found');
  });
  it('surfaces RPC failure', async () => {
    rpc.mockResolvedValueOnce({ error: { message: 'connection timeout' }, data: null });
    await expect(getPublicGameManifest('unavailable')).rejects.toThrow('connection timeout');
  });
});
