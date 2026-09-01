import Link from 'next/link'
import { ArrowUpRight, ArrowRight, Check, Compass, Flag, LockKeyhole, RotateCcw, Sparkles, Star, Trophy } from 'lucide-react'
import type { GameDefinition } from '../types/game'
import type { Lesson } from '../types/lesson'
import { canEnterLesson, gameThemeStyle, missionObjective } from '../lib/mission'
import { GameBrand } from './GameBrand'

interface QuestHomeProps {
  game?: GameDefinition | null
  gameId?: string
  lessons: Lesson[]
  completedLessons: string[]
  stars: number
  level: number
  exp: number
  signedIn: boolean
  isGuest?: boolean
  completionTime: string | null
  rank: number | null
  onStart: () => void
  onReset: () => void
  onLeaderboard: () => void
}

export function QuestHome(props: QuestHomeProps) {
  const { game, gameId, lessons, completedLessons, signedIn } = props
  const completed = lessons.filter(lesson => completedLessons.includes(lesson.lesson_id))
  const current = lessons.find(lesson => !completedLessons.includes(lesson.lesson_id))
  const allDone = lessons.length > 0 && completed.length === lessons.length
  // No leading /games here - basePath already adds it to every next/link href.
  const href = (id: string) => gameId ? `/${gameId}/lessons/${id}` : `/lessons/${id}`
  return <div className="quest-shell" style={gameThemeStyle(game?.settings.theme)}>
    <a className="quest-skip" href="#mission-map">跳至任務地圖</a>
    <header className="quest-header"><div className="quest-header-inner">
      <Link href={gameId ? `/${gameId}` : '/'} aria-label="遊戲首頁"><GameBrand game={game} legacy={!gameId} /></Link>
      <span className="quest-header-label">學習冒險基地</span>
      <div className="quest-player-stats"><span>Lv. {props.level}</span><span title="經驗值">{props.exp} XP</span><span><Star size={16} aria-hidden="true" />{props.stars}</span></div>
    </div></header>
    {signedIn && props.isGuest && (
      <p className="quest-guest-notice" role="status">
        訪客模式・進度僅保存在這台裝置，清除瀏覽器資料會遺失紀錄
      </p>
    )}

    <main className="quest-container">
      <section className="quest-hero" aria-labelledby="quest-title">
        <div className="quest-hero-copy">
          <span className="quest-eyebrow"><span className="quest-dot" /> YOUR NEXT DISCOVERY</span>
          <h1 id="quest-title">{game?.title || 'Excel 大師挑戰'}</h1>
          <p>{game?.description || '從一個問題開始，探索資料、練習解題，完成屬於你的學習旅程。'}</p>
          <div className="quest-hero-actions"><button className="quest-button quest-button-light" onClick={props.onStart}>{allDone ? '回顧學習任務' : signedIn ? '繼續我的任務' : '開始學習'}<ArrowRight size={18} /></button><a href="#mission-map" className="quest-hero-link">探索任務地圖 ↓</a></div>
        </div>
        <div className="quest-hero-art" aria-hidden="true">
          <svg viewBox="0 0 320 225" fill="none">
            <ellipse cx="160" cy="183" rx="121" ry="24" fill="#071d32" opacity=".35" />
            <path d="m33 134 106-59 148 58-114 62z" fill="#194665" stroke="#51859c" />
            <path d="m33 134 140 52 114-53v15l-114 63-140-53z" fill="#102e4b" />
            <path d="m74 133 62 24 41-24-43-18 52-29" stroke="#5acddd" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
            <ellipse cx="75" cy="131" rx="13" ry="8" fill="#a0eef4" />
            <ellipse cx="137" cy="155" rx="13" ry="8" fill="#a0eef4" />
            <path d="M184 92V31" stroke="#c0ecf4" strokeWidth="5" strokeLinecap="round" />
            <path d="M187 33c17-13 29 14 48 0v31c-19 14-31-13-48 0z" fill="#53dccf" />
            <circle cx="73" cy="64" r="3" fill="#a0eef4" /><path d="M254 83v14m-7-7h14M117 34v10m-5-5h10" stroke="#a0eef4" strokeWidth="2" />
          </svg>
          <span className="quest-art-caption">每一步，都是新的發現</span>
        </div>
      </section>

      <div className="quest-overview"><div><Flag size={18} /><strong>{completed.length} / {lessons.length}</strong><span>任務已完成</span></div><div className="quest-progress" role="progressbar" aria-label="任務完成進度" aria-valuemin={0} aria-valuemax={lessons.length || 1} aria-valuenow={completed.length}><span style={{width: `${lessons.length ? completed.length / lessons.length * 100 : 0}%`}} /></div><span className="quest-overview-note">依自己的步調，逐步前進</span></div>

      <div className="quest-home-grid">
        <section id="mission-map" className="quest-map" aria-labelledby="map-title">
          <div className="quest-section-heading"><div><span className="quest-kicker">LEARNING JOURNEY</span><h2 id="map-title">學習任務地圖</h2></div><span className="quest-small-label">{lessons.length} 個探索節點</span></div>
          {!signedIn && <p className="quest-map-note">先點選「開始學習」登入，再依序進入關卡。</p>}
          <ol className="quest-path">
            {lessons.map((lesson, index) => {
              const done = completedLessons.includes(lesson.lesson_id)
              const unlocked = canEnterLesson(lessons, index, completedLessons, signedIn)
              const active = current?.lesson_id === lesson.lesson_id
              return <li key={lesson.lesson_id} className={`quest-stop ${done ? 'is-done' : active ? 'is-current' : 'is-pending'}`}>
                <span className="quest-node" aria-hidden="true">{done ? <Check size={23} /> : lesson.number}</span>
                <div className="quest-stop-card">
                  <div className="quest-stop-top"><span className="quest-kicker">{lesson.role === 'intro' ? '起點 · 前導課程' : lesson.role === 'final' ? '終點 · 綜合挑戰' : `任務 ${String(lesson.number).padStart(2, '0')}`}</span><span className="quest-status">{done ? '已完成' : unlocked ? '可開始' : !signedIn ? '登入後開始' : '待解鎖'}</span></div>
                  <h3>{lesson.title}</h3><p className="quest-stop-summary">{lesson.description || '進入關卡查看學習資料與任務指引。'}</p>
                  <div className="quest-stop-footer">{lesson.duration ? <span>約 {lesson.duration} 分鐘</span> : <span>依自己的步調探索</span>}
                    {unlocked ? <Link href={href(lesson.lesson_id)} className="quest-stop-link">{done ? '回顧任務' : '進入任務'}<ArrowUpRight size={16} /></Link> : <span className="quest-lock"><LockKeyhole size={14} />{!signedIn ? '尚未登入' : '先完成上一關'}</span>}
                  </div>
                </div>
              </li>
            })}
          </ol>
          {allDone && <div className="quest-map-finish"><Flag /><div><strong>這段旅程已完成！</strong><p>回顧曾經解決的問題，試著向別人說明你的方法。</p></div></div>}
        </section>

        <aside className="quest-sidebar">
          <section className="quest-panel quest-current"><span className="quest-kicker">{allDone ? 'JOURNEY COMPLETE' : 'NEXT MISSION'}</span><h2>{allDone ? '你的學習足跡' : '下一個任務'}</h2><h3>{current?.title || '所有關卡已完成'}</h3><p>{current ? missionObjective(current) : '你已完成本遊戲設定的關卡。這些紀錄代表完成進度，不等同於技能精通評量。'}</p><button className="quest-button" onClick={props.onStart}>{allDone ? '回顧任務' : signedIn ? '繼續任務' : '開始學習'}<ArrowRight size={16} /></button></section>
          <section className="quest-panel quest-mentor"><div className="quest-mentor-heading"><span className="quest-mentor-icon"><Sparkles /></span><div><span className="quest-kicker">LEARNING COMPANION</span><h2>你的 AI 學習夥伴</h2></div></div><p>{current?.mission?.mentorMessage || '卡住了也沒關係。進入關卡後，你可以開啟 AI 導師，一起釐清問題，再試一次。'}</p><span className="quest-mentor-note">先思考，再提問；解法不只靠記憶。</span></section>
          <section className="quest-panel"><div className="quest-panel-title"><Compass size={19} /><h2>探索紀錄</h2></div>{completed.length ? <ul className="quest-completed-list">{completed.map(lesson => <li key={lesson.lesson_id}><Check size={15} /><span>{lesson.title}</span></li>)}</ul> : <p>完成第一個任務後，你的學習足跡會出現在這裡。</p>}<div className="quest-record-footer"><span><Star size={15} /> {props.stars} 顆星星</span><span>Lv. {props.level}</span></div></section>
          <button className="quest-secondary-action" onClick={props.onLeaderboard}><Trophy size={17} /><span>查看完成時間排行榜</span><ArrowUpRight size={16} /></button>
          {allDone && <><p className="quest-caption">完成時間 {props.completionTime || '--:--'} · 排名 {props.rank || '—'}<br />時間紀錄僅供參考，不代表學習能力。</p><button className="quest-secondary-action" onClick={() => { if (window.confirm('重新挑戰會清除此裝置中這款遊戲的學習進度與登入資料，確定繼續嗎？')) props.onReset() }}><RotateCcw size={16} />重設本機進度</button></>}
        </aside>
      </div>
      <footer className="quest-footer">EXPLORE · PRACTICE · DISCOVER<span>一步一步，把知識變成自己的能力。</span></footer>
    </main>
  </div>
}
