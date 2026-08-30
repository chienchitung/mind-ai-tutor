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
