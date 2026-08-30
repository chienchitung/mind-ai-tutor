import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowRight, CheckCircle2, Lightbulb, RotateCcw } from 'lucide-react'
import type { LessonStage } from '../lib/lesson-presentation'
import type { ChangeEvent } from 'react'

export function LessonMarkdown({ children }: { children: string }) {
  return <div className="lesson-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{
    table: ({ children }) => <div className="lesson-table-scroll" tabIndex={0} role="region" aria-label="題目資料表"><table>{children}</table></div>,
  }}>{children}</ReactMarkdown></div>
}

interface AnswerProps {
  answer: string
  submitted: boolean
  correct: boolean
  stage: LessonStage
  final?: boolean
  explanation?: string | null
  completionMessage?: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  onSubmit: () => void
  onContinue: () => void
  onHint: () => void
}

export function LessonAnswer({ answer, submitted, correct, stage, final = false, explanation, completionMessage, onChange, onSubmit, onContinue, onHint }: AnswerProps) {
  const ready = submitted && correct
  const inputId = final ? 'final-lesson-answer' : 'lesson-answer'
  const feedbackId = final ? 'final-answer-feedback' : 'answer-feedback'
  return <section className="lesson-answer" aria-label="你的解法">
    <div className="lesson-answer-heading"><label htmlFor={inputId}>{ready ? '你的作答' : '你的解法'}</label><span>{stage === 'review' ? '已完成 · 複習中' : '想好後，再檢查答案'}</span></div>
    <input id={inputId} className="lesson-answer-input" value={answer} onChange={onChange} disabled={ready} placeholder={stage === 'review' && !answer ? '這一關已完成，未保留前次輸入' : final ? '輸入最終答案…' : '輸入你的答案…'} aria-describedby={submitted ? feedbackId : undefined} autoComplete="off" />
    {submitted && <div id={feedbackId} className={`lesson-feedback ${correct ? 'is-correct' : 'is-retry'}`} role="status">
      {correct ? <CheckCircle2 size={20} /> : <RotateCcw size={20} />}
      <div><strong>{stage === 'review' ? '這一關已完成，現在可以回顧解法。' : correct ? '答案正確！' : '再試一次，答案還不符合題目條件。'}</strong>
        {correct && stage !== 'review' && <p>{completionMessage || '回顧你的方法，想想為什麼這樣能解決問題。'}</p>}
        {!correct && <p>你的答案已保留。可以檢查條件，或請 AI 提醒方向。</p>}
      </div>
    </div>}
    {submitted && explanation && <section className="lesson-explanation" aria-label="答案解析"><h3>答案解析</h3><LessonMarkdown>{explanation}</LessonMarkdown></section>}
    <div className="lesson-answer-actions"><button type="button" onClick={onHint} className="lesson-hint-button"><Lightbulb size={16} />請 AI 提醒方向</button><button type="button" className="quest-button" disabled={!ready && !answer.trim()} onClick={ready ? onContinue : onSubmit}>{ready ? final ? '查看旅程成果' : '前往下一關' : '檢查答案'}<ArrowRight size={16} /></button></div>
  </section>
}

export function ChallengeHeading({ final = false, stage, stars, xp }: { final?: boolean; stage: LessonStage; stars: number; xp: number }) {
  const label = { working: '等待作答', retry: '再試一次', complete: '本次已完成', review: '已完成 · 複習中' }[stage]
  return <header className="lesson-challenge-heading"><div><span className="quest-kicker">{final ? 'FINAL MISSION' : 'YOUR CHALLENGE'}</span><h2>{final ? '綜合任務' : '任務挑戰'}</h2></div><div className="lesson-challenge-meta"><span className={`lesson-state is-${stage}`}>{label}</span><span className="lesson-reward-note">首次完成 +{stars} 星星 · +{xp} XP</span></div></header>
}
