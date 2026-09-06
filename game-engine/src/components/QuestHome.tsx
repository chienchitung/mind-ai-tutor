import Link from 'next/link'
import { ArrowRight, Check, ChevronDown, ChevronRight, Compass, Flag, LockKeyhole, RotateCcw, Star, Trophy } from 'lucide-react'
import type { GameDefinition, GameVisualTemplate } from '../types/game'
import type { Lesson } from '../types/lesson'
import { canEnterLesson, gameThemeStyle, gameVisualTemplate, missionObjective } from '../lib/mission'
import { GameBrand } from './GameBrand'
import { gameAssetPath } from '../lib/game-asset-path'
import { MentorAvatar } from './MentorAvatar'
import { mentorForTemplate } from '../lib/mentor'
import { experienceForTemplate } from '../lib/template-experience'

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
  const artwork: Record<GameVisualTemplate, { src: string; caption: string }> = {
    discovery: { src: '/template-art/discovery-hero.webp', caption: '每一步，都是新的發現' },
    'neo-brutal': { src: '/template-art/neo-blocks-hero.webp', caption: '把挑戰拆成一塊一塊' },
    arcade: { src: '/template-art/arcade-hero.webp', caption: 'READY · LEARN · LEVEL UP' },
    'forest-camp': { src: '/template-art/forest-camp-hero.webp', caption: '慢慢探索，也能走得很遠' },
    'arcane-archive': { src: '/template-art/arcane-archive-hero.webp', caption: '翻開知識，解鎖新的篇章' },
    'orbital-lab': { src: '/template-art/orbital-lab-hero.webp', caption: '啟動研究，連結每個新發現' },
  }
  const selectedArtwork = artwork[template]
  return <div className="quest-hero-art" aria-hidden="true">
    {/* Local transparent artwork uses the Game Engine base path. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={gameAssetPath(selectedArtwork.src)} alt="" width="720" height="526" />
    <span className="quest-art-caption">{selectedArtwork.caption}</span>
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
  const mentor = mentorForTemplate(template)
  const experience = experienceForTemplate(template)
  return <div className="quest-shell" data-quest-template={template} data-experience-layout={experience.home.layout} style={gameThemeStyle(game?.settings.theme)}>
    <a className="quest-skip" href="#mission-map">跳至任務地圖</a>
    <header className="quest-header"><div className="quest-header-inner">
      <Link href={gameId ? `/${gameId}` : '/'} aria-label="遊戲首頁"><GameBrand game={game} legacy={!gameId} /></Link>
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
          <span className="quest-eyebrow"><span className="quest-dot" /> {experience.home.eyebrow}</span>
          <h1 id="quest-title">{game?.title || 'Excel 大師挑戰'}</h1>
          <p>{game?.description || '從一個問題開始，探索資料、練習解題，完成屬於你的學習旅程。'}</p>
          <div className="quest-hero-actions"><button className="quest-button quest-button-light" onClick={props.onStart}>{allDone ? '回顧學習任務' : signedIn ? '繼續我的任務' : '開始學習'}<ArrowRight className="quest-direction-icon" size={18} aria-hidden="true" /></button><a href="#mission-map" className="quest-hero-link"><span>{experience.home.journeyLink}</span><ChevronDown className="quest-direction-icon is-down" size={16} aria-hidden="true" /></a></div>
        </div>
        <HeroArtwork template={template} />
      </section>

      <div className="quest-overview"><div><Flag size={18} /><strong>已完成 {completed.length} / {lessons.length}</strong><span>{experience.home.journeyUnit}</span></div><div className="quest-progress" role="progressbar" aria-label={`${experience.home.journeyTitle}完成進度`} aria-valuemin={0} aria-valuemax={lessons.length || 1} aria-valuenow={completed.length}><span style={{width: `${lessons.length ? completed.length / lessons.length * 100 : 0}%`}} /></div><span className="quest-overview-note">{allDone ? experience.home.completeTitle : remainingMinutes ? `剩餘約 ${remainingMinutes} 分鐘` : '依自己的步調前進'}</span></div>

      <div className="quest-home-grid">
        <section id="mission-map" className="quest-map" aria-labelledby="map-title">
          <div className="quest-section-heading"><div><span className="quest-kicker">{experience.home.journeyKicker}</span><h2 id="map-title">{experience.home.journeyTitle}</h2></div><span className="quest-small-label">{!lessons.length ? '尚未設定內容' : allDone ? experience.home.completeTitle : `目前第 ${Math.max(currentIndex + 1, 1)} / ${lessons.length} ${experience.home.journeyUnit}`}</span></div>
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
                  <div className="quest-stop-top"><span className="quest-kicker">{experience.home.stopLabel(lesson.role, lesson.number)}</span><span className="quest-status">{done ? '已完成' : active && signedIn ? '你在這裡' : unlocked ? '可開始' : !signedIn ? '登入後開始' : '待解鎖'}</span></div>
                  <h3>{lesson.title}</h3><p className="quest-stop-summary">{lesson.description || '進入關卡查看學習資料與任務指引。'}</p>
                  <div className="quest-stop-footer">{lesson.duration ? <span>約 {lesson.duration} 分鐘</span> : <span>依自己的步調探索</span>}
                    {unlocked ? <Link href={href(lesson.lesson_id)} className="quest-stop-link">{done ? '再看一次' : active ? '開始任務' : '進入任務'}<ChevronRight className="quest-direction-icon" size={16} aria-hidden="true" /></Link> : <span className="quest-lock"><LockKeyhole size={14} />{!signedIn ? '登入後即可開始' : prerequisite ? `先完成「${prerequisite}」` : '尚未解鎖'}</span>}
                  </div>
                </div>
              </li>
            })}
          </ol>
          {allDone && <div className="quest-map-finish"><Flag /><div><strong>{experience.home.completeTitle}</strong><p>{experience.home.completeMessage}</p></div></div>}
        </section>

        <aside className="quest-sidebar">
          <section className="quest-panel quest-current"><span className="quest-kicker">{allDone ? 'COMPLETE' : experience.home.currentKicker}</span><h2>{allDone ? experience.home.completeTitle : experience.home.currentTitle}</h2><h3>{current?.title || '所有內容已完成'}</h3><p>{current ? missionObjective(current) : experience.home.completeMessage}</p><button className="quest-button" onClick={props.onStart}>{allDone ? '回顧任務' : signedIn ? '繼續任務' : '開始學習'}<ArrowRight className="quest-direction-icon" size={16} aria-hidden="true" /></button></section>
          <section className="quest-panel quest-mentor"><div className="quest-mentor-heading"><MentorAvatar template={template} className="quest-mentor-avatar" /><div><span className="quest-kicker">LEARNING COMPANION</span><h2>{mentor.name} · {mentor.role}</h2><span className="quest-mentor-tagline">{mentor.tagline}</span></div></div><p>{current?.mission?.mentorMessage || mentor.homeMessage}</p><span className="quest-mentor-note">先思考，再提問；解法不只靠記憶。</span></section>
          <section className="quest-panel quest-record"><div className="quest-panel-title"><Compass size={19} /><h2>{experience.home.recordTitle}</h2></div>{completed.length ? <ul className="quest-completed-list">{completed.map(lesson => <li key={lesson.lesson_id}><Check size={15} /><span>{lesson.title}</span></li>)}</ul> : <p>{experience.home.emptyRecord}</p>}<div className="quest-record-footer"><span><Star size={15} /> {props.stars} 顆星星</span><span>Lv. {props.level}</span></div></section>
          <button className="quest-secondary-action" onClick={props.onLeaderboard}><Trophy size={17} aria-hidden="true" /><span>查看完成時間排行榜</span><ChevronRight className="quest-direction-icon" size={16} aria-hidden="true" /></button>
          {allDone && <><p className="quest-caption">完成時間 {props.completionTime || '--:--'} · 排名 {props.rank || '—'}<br />時間紀錄僅供參考，不代表學習能力。</p><button className="quest-secondary-action" onClick={() => { if (window.confirm('重新挑戰會清除此裝置中這款遊戲的學習進度與登入資料，確定繼續嗎？')) props.onReset() }}><RotateCcw size={16} />重設本機進度</button></>}
        </aside>
      </div>
      <footer className="quest-footer">{experience.home.footerCode}<span>{experience.home.footerMessage}</span></footer>
    </main>
  </div>
}
