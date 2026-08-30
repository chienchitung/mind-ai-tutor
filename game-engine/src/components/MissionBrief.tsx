import { Flag, Sparkles, CheckCircle2 } from 'lucide-react'
import type { Lesson } from '../types/lesson'
import { missionObjective } from '../lib/mission'

export function MissionBrief({ lesson, completed }: { lesson: Lesson; completed: boolean }) {
  return <section className="quest-brief" aria-label="任務指引">
    <div className="quest-brief-objective"><Flag size={20} aria-hidden="true" /><div><span className="quest-kicker">本關目標</span><p>{missionObjective(lesson)}</p></div></div>
    {lesson.mission?.scenario && <div className="quest-scenario"><strong>任務情境</strong><p>{lesson.mission.scenario}</p></div>}
    {lesson.mission?.mentorMessage && <div className="quest-brief-mentor"><Sparkles size={17} aria-hidden="true" /><p>{lesson.mission.mentorMessage}</p></div>}
    {completed && <div className="quest-completion" role="status"><CheckCircle2 size={23} /><div><h2>任務完成 · {lesson.title}</h2><p>{lesson.mission?.completionMessage || '你已完成本關設定的學習任務。回顧你的解法，再繼續下一段旅程。'}</p><span>完成紀錄不等同於獨立技能評量；你可以隨時回來練習。</span></div></div>}
  </section>
}
