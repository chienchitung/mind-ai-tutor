export type LessonStage = 'working' | 'retry' | 'complete' | 'review'

export function lessonStage(wasCompletedOnEntry: boolean, submitted: boolean, correct: boolean): LessonStage {
  if (wasCompletedOnEntry) return 'review'
  if (!submitted) return 'working'
  return correct ? 'complete' : 'retry'
}

export function initialLessonTab(intro: boolean, final: boolean) {
  return intro ? 'content' : final ? 'game' : 'practice'
}

export function mentorGreeting(lessonTitle?: string, greeting?: string) {
  return greeting?.trim() || (lessonTitle ? `我是 Ellis，你的 AI 學習夥伴。關於「${lessonTitle}」，你想先釐清哪個部分？` : '我是 Ellis，你的 AI 學習夥伴。告訴我你卡在哪一步，我們一起想想。')
}

export const mentorPrompts = [
  { label: '看懂題目', prompt: '請幫我釐清這一題的目標與已知條件，先不要直接提供答案。' },
  { label: '提醒方向', prompt: '請給我一個解題方向或關鍵概念，讓我先自己試試看。' },
  { label: '檢查想法', prompt: '請協助我檢查解題想法。我目前的思路是：' },
] as const

export const introMentorPrompts = [
  { label: '整理重點', prompt: '請幫我用三個重點整理這堂前導課程，先不要加入教材以外的內容。' },
  { label: '舉個例子', prompt: '請針對這堂前導課程最重要的概念，給我一個簡短例子。' },
  { label: '測驗一下', prompt: '請根據這堂前導課程問我一個小問題，先不要公布答案。' },
] as const
