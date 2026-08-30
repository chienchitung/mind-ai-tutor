import { Flag } from 'lucide-react'
import type { Lesson } from '../types/lesson'
import { missionObjective } from '../lib/mission'

export function MissionBrief({ lesson }: { lesson: Lesson }) {
  return <section className="lesson-brief" aria-label="任務指引">
    <div className="lesson-objective"><Flag size={16} aria-hidden="true" /><p>{missionObjective(lesson)}</p></div>
    {(lesson.mission?.scenario || lesson.mission?.mentorMessage) && <details className="lesson-story"><summary>任務情境與導師指引</summary>
      {lesson.mission?.scenario && <p>{lesson.mission.scenario}</p>}
      {lesson.mission?.mentorMessage && <p className="lesson-mentor-note">Ellis：{lesson.mission.mentorMessage}</p>}
    </details>}
  </section>
}
