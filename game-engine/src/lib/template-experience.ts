import type { GameVisualTemplate } from '../types/game'

type LessonRole = 'intro' | 'standard' | 'final' | undefined

export interface TemplateExperience {
  home: {
    layout: 'route' | 'build-board' | 'level-select' | 'trail' | 'chapter-index' | 'mission-control'
    eyebrow: string
    journeyKicker: string
    journeyTitle: string
    journeyUnit: string
    journeyLink: string
    currentKicker: string
    currentTitle: string
    leaderboardKicker: string
    leaderboardTitle: string
    leaderboardDescription: string
    recordTitle: string
    emptyRecord: string
    completeTitle: string
    completeMessage: string
    footerCode: string
    footerMessage: string
    stopLabel: (role: LessonRole, number: number) => string
  }
  lesson: {
    homeLabel: string
    introLabel: string
    levelLabel: (number: number) => string
    contentTab: string
    practiceTab: string
    interactiveTab: string
    challengeKicker: string
    challengeTitle: string
    finalKicker: string
    finalTitle: string
    storyLabel: string
  }
}

const sequence = (standard: string, intro: string, final: string) => (role: LessonRole, number: number) =>
  role === 'intro' ? intro : role === 'final' ? final : `${standard} ${String(number).padStart(2, '0')}`

export const TEMPLATE_EXPERIENCES: Record<GameVisualTemplate, TemplateExperience> = {
  discovery: {
    home: { layout:'route', eyebrow:'YOUR NEXT DISCOVERY', journeyKicker:'LEARNING JOURNEY', journeyTitle:'學習任務地圖', journeyUnit:'站', journeyLink:'探索任務地圖', currentKicker:'NEXT MISSION', currentTitle:'下一個任務', leaderboardKicker:'EXPLORATION RECORDS', leaderboardTitle:'探索完成紀錄', leaderboardDescription:'查看所有學習者抵達任務終點的時間', recordTitle:'探索紀錄', emptyRecord:'完成第一個任務後，你的學習足跡會出現在這裡。', completeTitle:'這段旅程已完成！', completeMessage:'回顧曾經解決的問題，試著向別人說明你的方法。', footerCode:'EXPLORE · PRACTICE · DISCOVER', footerMessage:'一步一步，把知識變成自己的能力。', stopLabel:sequence('任務','起點 · 前導課程','終點 · 綜合挑戰') },
    lesson: { homeLabel:'返回任務基地', introLabel:'前導課程', levelLabel:number => `第 ${number} 關`, contentTab:'學習資料', practiceTab:'任務挑戰', interactiveTab:'互動關卡', challengeKicker:'YOUR CHALLENGE', challengeTitle:'任務挑戰', finalKicker:'FINAL MISSION', finalTitle:'綜合任務', storyLabel:'任務情境與助教指引' },
  },
  'neo-brutal': {
    home: { layout:'build-board', eyebrow:'BUILD YOUR WAY', journeyKicker:'BUILD BOARD', journeyTitle:'挑戰拼裝板', journeyUnit:'塊', journeyLink:'查看拼裝板', currentKicker:'NEXT PIECE', currentTitle:'下一塊挑戰', leaderboardKicker:'CHALLENGE RECORDS', leaderboardTitle:'挑戰完成榜', leaderboardDescription:'查看所有玩家完成整件作品的時間', recordTitle:'完成零件盒', emptyRecord:'完成第一塊挑戰後，成果會放進零件盒。', completeTitle:'作品組裝完成！', completeMessage:'把每一塊解法重新排列，看看還能組出什麼方法。', footerCode:'BREAK · BUILD · TEST', footerMessage:'拆小問題，親手拼出完整解法。', stopLabel:sequence('積木','底板 · 快速導覽','成品 · 最終組裝') },
    lesson: { homeLabel:'返回拼裝場', introLabel:'材料準備', levelLabel:number => `積木 ${number}`, contentTab:'材料卡', practiceTab:'動手拆解', interactiveTab:'積木實作', challengeKicker:'BUILD THIS PIECE', challengeTitle:'拆解與拼裝', finalKicker:'FINAL BUILD', finalTitle:'最終組裝', storyLabel:'製作需求與波波提示' },
  },
  arcade: {
    home: { layout:'level-select', eyebrow:'PLAYER ONE · READY', journeyKicker:'LEVEL SELECT', journeyTitle:'選關畫面', journeyUnit:'關', journeyLink:'前往選關', currentKicker:'CONTINUE', currentTitle:'繼續遊戲', leaderboardKicker:'SCORE BOARD', leaderboardTitle:'破關速度榜', leaderboardDescription:'查看所有玩家完成最終關卡的時間', recordTitle:'破關紀錄', emptyRecord:'完成第一關後，破關紀錄會顯示在這裡。', completeTitle:'ALL STAGES CLEAR!', completeMessage:'重玩關卡並比較不同策略，刷新自己的解題紀錄。', footerCode:'READY · THINK · CLEAR', footerMessage:'讀懂規則，找到突破口，完成破關。', stopLabel:sequence('STAGE','教學關 · TUTORIAL','BOSS STAGE') },
    lesson: { homeLabel:'返回選關大廳', introLabel:'TUTORIAL', levelLabel:number => `STAGE ${String(number).padStart(2, '0')}`, contentTab:'攻略資料', practiceTab:'主線任務', interactiveTab:'BONUS STAGE', challengeKicker:'MISSION START', challengeTitle:'主線任務', finalKicker:'BOSS STAGE', finalTitle:'最終頭目戰', storyLabel:'關卡規則與尼克斯提示' },
  },
  'forest-camp': {
    home: { layout:'trail', eyebrow:'TODAY’S TRAIL', journeyKicker:'TRAIL GUIDE', journeyTitle:'學習步道路線', journeyUnit:'處路標', journeyLink:'查看今日路線', currentKicker:'NEXT STOP', currentTitle:'下一個停靠點', leaderboardKicker:'TRAIL RECORDS', leaderboardTitle:'抵達終點紀錄', leaderboardDescription:'查看所有旅人完成學習步道的時間', recordTitle:'旅程手帳', emptyRecord:'走過第一個路標後，足跡會記進旅程手帳。', completeTitle:'抵達今日終點！', completeMessage:'在營火旁回想沿途線索，說說你是怎麼找到方向的。', footerCode:'NOTICE · FOLLOW · REFLECT', footerMessage:'不趕路，把每一步的發現帶回營地。', stopLabel:sequence('路標','登山口 · 行前準備','山頂 · 最終挑戰') },
    lesson: { homeLabel:'返回森林營地', introLabel:'行前準備', levelLabel:number => `第 ${number} 個路標`, contentTab:'嚮導手冊', practiceTab:'路線挑戰', interactiveTab:'營地實作', challengeKicker:'TRAIL TASK', challengeTitle:'路線挑戰', finalKicker:'SUMMIT TASK', finalTitle:'山頂挑戰', storyLabel:'沿途情境與莫里提示' },
  },
  'arcane-archive': {
    home: { layout:'chapter-index', eyebrow:'OPEN THE NEXT CHAPTER', journeyKicker:'TABLE OF CONTENTS', journeyTitle:'典藏章節索引', journeyUnit:'章', journeyLink:'翻閱章節', currentKicker:'BOOKMARKED', currentTitle:'目前閱讀章節', leaderboardKicker:'ARCHIVE OF ACHIEVEMENTS', leaderboardTitle:'典藏完成榜', leaderboardDescription:'查看所有解謎者完成全卷典藏的時間', recordTitle:'已解鎖典藏', emptyRecord:'解開第一章後，知識會收進你的典藏。', completeTitle:'全卷典藏完成！', completeMessage:'重新翻閱關鍵章節，將散落的知識串成自己的理解。', footerCode:'READ · DECODE · ARCHIVE', footerMessage:'翻開線索，解開章節，收藏真正理解的知識。', stopLabel:(role, number) => role === 'intro' ? '序章 · 入館指引' : role === 'final' ? '終章 · 大試煉' : `第 ${String(number).padStart(2, '0')} 章` },
    lesson: { homeLabel:'返回典藏大廳', introLabel:'序章', levelLabel:number => `第 ${number} 章`, contentTab:'典藏卷冊', practiceTab:'解謎試煉', interactiveTab:'魔法實作', challengeKicker:'ARCANE TRIAL', challengeTitle:'章節試煉', finalKicker:'FINAL VOLUME', finalTitle:'終章大試煉', storyLabel:'章節背景與萊拉註記' },
  },
  'orbital-lab': {
    home: { layout:'mission-control', eyebrow:'MISSION CONTROL ONLINE', journeyKicker:'FLIGHT PLAN', journeyTitle:'任務控制中心', journeyUnit:'個模組', journeyLink:'開啟任務控制', currentKicker:'ACTIVE MODULE', currentTitle:'目前任務模組', leaderboardKicker:'MISSION TELEMETRY', leaderboardTitle:'航程完成遙測', leaderboardDescription:'查看所有研究員完成任務航程的時間訊號', recordTitle:'任務遙測紀錄', emptyRecord:'完成第一個模組後，驗證資料會寫入遙測紀錄。', completeTitle:'任務航程完成！', completeMessage:'檢查研究紀錄，確認每個結論都有資料與推理支持。', footerCode:'SCAN · HYPOTHESIZE · VERIFY', footerMessage:'讀取資料，建立假設，用證據完成驗證。', stopLabel:sequence('模組','發射前檢查','最終航段') },
    lesson: { homeLabel:'返回控制中心', introLabel:'系統檢查', levelLabel:number => `模組 ${String(number).padStart(2, '0')}`, contentTab:'研究資料', practiceTab:'核心任務', interactiveTab:'模擬艙', challengeKicker:'ACTIVE EXPERIMENT', challengeTitle:'核心實驗', finalKicker:'FINAL ORBIT', finalTitle:'最終航段', storyLabel:'任務簡報與奧比分析' },
  },
}

export function experienceForTemplate(template: GameVisualTemplate = 'discovery') {
  return TEMPLATE_EXPERIENCES[template]
}
