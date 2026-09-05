import Link from 'next/link'
import { ArrowUpRight, ArrowRight, Check, Compass, Flag, LockKeyhole, RotateCcw, Sparkles, Star, Trophy } from 'lucide-react'
import type { GameDefinition, GameVisualTemplate } from '../types/game'
import type { Lesson } from '../types/lesson'
import { canEnterLesson, gameThemeStyle, gameVisualTemplate, missionObjective } from '../lib/mission'
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
  // Local-only display name (see saveGuestPlayStats() in lib/supabase.ts -
  // it never accepts a name, so nothing here ever reaches Supabase).
  guestName?: string | null
  completionTime: string | null
  rank: number | null
  onStart: () => void
  onReset: () => void
  onLeaderboard: () => void
}

function HeroArtwork({ template }: { template: GameVisualTemplate }) {
  if (template === 'neo-brutal') return <div className="quest-hero-art" aria-hidden="true">
    <svg viewBox="0 0 320 225" fill="none">
      <path d="M40 54h113v88H40z" fill="#ff6b9d" stroke="#111" strokeWidth="6"/><path d="M55 70h113v88H55z" fill="#fff" stroke="#111" strokeWidth="6"/>
      <circle cx="221" cy="75" r="39" fill="#70e1f5" stroke="#111" strokeWidth="6"/><path d="m192 145 63-22 27 55-64 21z" fill="#7c5cff" stroke="#111" strokeWidth="6"/>
      <path d="m89 112 18 18 39-43" stroke="#111" strokeWidth="9" strokeLinecap="square"/><path d="m208 75 13 13 24-27" stroke="#111" strokeWidth="7"/>
    </svg><span className="quest-art-caption">把挑戰拆成一塊一塊</span>
  </div>
  if (template === 'arcade') return <div className="quest-hero-art" aria-hidden="true">
    <svg viewBox="0 0 320 225" fill="none">
      <path d="M45 38h230v150H45z" fill="#090720" stroke="#49e7ff" strokeWidth="3"/><path d="M45 70h230M83 38v150m39-150v150m39-150v150m39-150v150m38-150v150M45 108h230M45 148h230" stroke="#7c5cff" opacity=".45"/>
      <path d="m160 69 22 24-9 8 20 21-33 35-33-35 20-21-9-8z" fill="#ff4fd8" stroke="#d8d3ff" strokeWidth="3"/><path d="M62 169h196" stroke="#49e7ff" strokeWidth="7"/><path d="M62 169h128" stroke="#fff49b" strokeWidth="7"/>
      <circle cx="83" cy="89" r="5" fill="#49e7ff"/><circle cx="238" cy="119" r="5" fill="#49e7ff"/><path d="m244 55 5 10 10 5-10 5-5 10-5-10-10-5 10-5z" fill="#fff49b"/>
    </svg><span className="quest-art-caption">READY · LEARN · LEVEL UP</span>
  </div>
  return <div className="quest-hero-art" aria-hidden="true">
    <svg viewBox="0 0 320 225" fill="none">
      <ellipse cx="160" cy="183" rx="121" ry="24" fill="#071d32" opacity=".35" /><path d="m33 134 106-59 148 58-114 62z" fill="#194665" stroke="#51859c" /><path d="m33 134 140 52 114-53v15l-114 63-140-53z" fill="#102e4b" /><path d="m74 133 62 24 41-24-43-18 52-29" stroke="#5acddd" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" /><ellipse cx="75" cy="131" rx="13" ry="8" fill="#a0eef4" /><ellipse cx="137" cy="155" rx="13" ry="8" fill="#a0eef4" /><path d="M184 92V31" stroke="#c0ecf4" strokeWidth="5" strokeLinecap="round" /><path d="M187 33c17-13 29 14 48 0v31c-19 14-31-13-48 0z" fill="#53dccf" /><circle cx="73" cy="64" r="3" fill="#a0eef4" /><path d="M254 83v14m-7-7h14M117 34v10m-5-5h10" stroke="#a0eef4" strokeWidth="2" />
    </svg><span className="quest-art-caption">每一步，都是新的發現</span>
  </div>
}

export function QuestHome(props: QuestHomeProps) {
  const { game, gameId, lessons, completedLessons, signedIn } = props
  const completed = lessons.filter(lesson => completedLessons.includes(lesson.lesson_id))
  const current = lessons.find(lesson => !completedLessons.includes(lesson.lesson_id))
  const currentIndex = current ? lessons.findIndex(lesson => lesson.lesson_id === current.lesson_id) : lessons.length - 1
  const allDone = lessons.length > 0 && completed.length === lessons.length
  const remainingMinutes = lessons
    .filter(lesson => !completedLessons.includes(lesson.lesson_id))
    .reduce((total, lesson) => total + (Number.parseInt(lesson.duration || '', 10) || 0), 0)
  // No leading /games here - basePath already adds it to every next/link href.
  const href = (id: string) => gameId ? `/${gameId}/lessons/${id}` : `/lessons/${id}`
  const template = gameVisualTemplate(game?.settings.theme)
  return <div className="quest-shell" data-quest-template={template} style={gameThemeStyle(game?.settings.theme)}>
    <a className="quest-skip" href="#mission-map">跳至任務地圖</a>
    <header className="quest-header"><div className="quest-header-inner">
      <Link href={gameId ? `/${gameId}` : '/'} aria-label="遊戲首頁"><GameBrand game={game} legacy={!gameId} /></Link>
      <span className="quest-header-label">學習冒險基地</span>
      <div className="quest-player-stats"><span>Lv. {props.level}</span><span title="經驗值">{props.exp} XP</span><span><Star size={16} aria-hidden="true" />{props.stars}</span></div>
    </div></header>
    {signedIn && props.isGuest && (
      <p className="quest-guest-notice" role="status">
        {props.guestName && props.guestName !== '訪客玩家' ? `嗨，${props.guestName}！` : ''}
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
        <HeroArtwork template={template} />
      </section>

      <div className="quest-overview"><div><Flag size={18} /><strong>已完成 {completed.length} / {lessons.length}</strong><span>個任務</span></div><div className="quest-progress" role="progressbar" aria-label="任務完成進度" aria-valuemin={0} aria-valuemax={lessons.length || 1} aria-valuenow={completed.length}><span style={{width: `${lessons.length ? completed.length / lessons.length * 100 : 0}%`}} /></div><span className="quest-overview-note">{allDone ? '所有任務都完成了' : remainingMinutes ? `剩餘約 ${remainingMinutes} 分鐘` : '依自己的步調前進'}</span></div>

      <div className="quest-home-grid">
        <section id="mission-map" className="quest-map" aria-labelledby="map-title">
          <div className="quest-section-heading"><div><span className="quest-kicker">LEARNING JOURNEY</span><h2 id="map-title">學習任務地圖</h2></div><span className="quest-small-label">{!lessons.length ? '尚未設定任務' : allDone ? '旅程已完成' : `目前第 ${Math.max(currentIndex + 1, 1)} / ${lessons.length} 站`}</span></div>
          {!signedIn && <p className="quest-map-note">先點選「開始學習」登入，再依序進入關卡。</p>}
          <ol className="quest-path">
            {lessons.map((lesson, index) => {
              const done = completedLessons.includes(lesson.lesson_id)
              const unlocked = canEnterLesson(lessons, index, completedLessons, signedIn)
              const active = current?.lesson_id === lesson.lesson_id
              const prerequisite = index > 0 ? lessons[index - 1]?.title : undefined
              return <li key={lesson.lesson_id} className={`quest-stop ${done ? 'is-done' : active ? 'is-current' : 'is-pending'}`} aria-current={active && signedIn ? 'step' : undefined}>
                <span className="quest-node" aria-hidden="true">{done ? <Check size={23} /> : lesson.number}</span>
                <div className="quest-stop-card">
                  <div className="quest-stop-top"><span className="quest-kicker">{lesson.role === 'intro' ? '起點 · 前導課程' : lesson.role === 'final' ? '終點 · 綜合挑戰' : `任務 ${String(lesson.number).padStart(2, '0')}`}</span><span className="quest-status">{done ? '已完成' : active && signedIn ? '你在這裡' : unlocked ? '可開始' : !signedIn ? '登入後開始' : '待解鎖'}</span></div>
                  <h3>{lesson.title}</h3><p className="quest-stop-summary">{lesson.description || '進入關卡查看學習資料與任務指引。'}</p>
                  <div className="quest-stop-footer">{lesson.duration ? <span>約 {lesson.duration} 分鐘</span> : <span>依自己的步調探索</span>}
                    {unlocked ? <Link href={href(lesson.lesson_id)} className="quest-stop-link">{done ? '再看一次' : active ? '開始任務' : '進入任務'}<ArrowUpRight size={16} /></Link> : <span className="quest-lock"><LockKeyhole size={14} />{!signedIn ? '登入後即可開始' : prerequisite ? `先完成「${prerequisite}」` : '尚未解鎖'}</span>}
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
