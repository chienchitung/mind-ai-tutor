"use client"

import { useState, useEffect } from "react"
import { Check, KeyRound, Trophy, UserRound } from "lucide-react"
import { QuestHome } from "@/components/QuestHome"
import { lessons as legacyLessons } from '@/data/lessons'
import { getProgress, resetProgress } from '@/lib/progress'
import { getPublicGameManifest } from '@/lib/game-manifest'
import { gameStorageKey } from '@/lib/game-storage'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useRouter } from "next/navigation"
import { getLeaderboardStats, getPlayerRank, getLessonOrderMappings, verifyStudentLoginCode, type VerifiedStudent } from '@/lib/supabase'
import { Lesson } from '@/types/lesson'
import type { GameDefinition } from '@/types/game'
import { gameVisualTemplate } from '@/lib/mission'
import { GameLoadingShell } from '@/components/GameLoadingShell'
import { experienceForTemplate } from '@/lib/template-experience'

interface ProgressData {
  completedLessons: string[];
  stars: number;
  streak: number;
  level: number;
  exp: number;
  dailyGoal: number;
  dailyProgress: number;
}

export default function HomePage({ gameId, assignmentId }: { gameId?: string; assignmentId?: string | null }) {
  const [progress, setProgress] = useState<ProgressData>({
    completedLessons: [],
    stars: 0,
    streak: 1,
    level: 1,
    exp: 0,
    dailyGoal: 100,
    dailyProgress: 0
  })

  const [showStudentIdDialog, setShowStudentIdDialog] = useState(false);
  const [showLeaderboardDialog, setShowLeaderboardDialog] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [hasStudentId, setHasStudentId] = useState(false);
  // A signed-in student with no student_ref_id never verified a teacher's
  // login code - their progress only ever gets written to this device's
  // localStorage, never linked to a real student row.
  const [isGuest, setIsGuest] = useState(false);
  // The active session's display name, local-only for guests (never sent to
  // Supabase - see saveGuestPlayStats(), which doesn't even accept a name).
  // guestNickname is just the controlled input value before starting.
  const [activeStudentName, setActiveStudentName] = useState<string | null>(null);
  const [guestNickname, setGuestNickname] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [verifiedStudent, setVerifiedStudent] = useState<VerifiedStudent | null>(null);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [loginCodeError, setLoginCodeError] = useState<string | null>(null);
  const [completionTime, setCompletionTime] = useState<string | null>(null);
  const [playerRank, setPlayerRank] = useState<number | null>(null);
  const [leaderboardStats, setLeaderboardStats] = useState<{
    total_participants: number;
    fastest_time: string;
    average_time: string;
    rankings: { student_id: string, student_name: string, completion_time_string: string, rank: number }[];
  }>({
    total_participants: 0,
    fastest_time: '--:--',
    average_time: '--:--',
    rankings: []
  });
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [gameDefinition, setGameDefinition] = useState<GameDefinition | null>(null);

  // Add state for mapped lessons
  const [mappedLessons, setMappedLessons] = useState<Lesson[]>(gameId ? [] : legacyLessons);
  const storageKey = (key: string) => gameStorageKey(gameId, key);
  // No leading /games here - basePath already adds it to every next/link href
  // and router.push() call.
  const lessonHref = (lessonId: string, resolvedAssignmentId?: string | null) =>
    gameId
      ? `/${gameId}/lessons/${lessonId}${resolvedAssignmentId || assignmentId ? `?assignment=${encodeURIComponent(resolvedAssignmentId || assignmentId || '')}` : ''}`
      : `/lessons/${lessonId}`;
  
  useEffect(() => {
    const fetchProgressAndMappings = async () => {
      try {
        setLoadError(null);
        let activeLessons: Lesson[] = [];

        if (gameId) {
          if (assignmentId) {
            localStorage.setItem(storageKey('game_assignment_id'), assignmentId);
          } else {
            localStorage.removeItem(storageKey('game_assignment_id'));
          }
          const manifest = await getPublicGameManifest(gameId);
          if (manifest.lessons.length === 0) {
            throw new Error('這款遊戲尚未設定任何關卡');
          }
          setGameDefinition(manifest);
          activeLessons = manifest.lessons;
          setMappedLessons(activeLessons);
        } else {
          // Legacy route compatibility. New games use digital_games.lesson_ids
          // as the single source of truth through getPublicGameManifest().
          const mappingsData = await getLessonOrderMappings();
        
          if (mappingsData.length > 0 && mappingsData[0].mapping && mappingsData[0].mapping.length > 0) {
          console.log('Got lesson mappings:', mappingsData[0].mapping);
          
          // Create mappings in both directions
          const numberToLessonId: {[key: number]: string} = {};
          const lessonIdToNumber: {[key: string]: number} = {};
          
          // Process the mapping data
          mappingsData[0].mapping.forEach(item => {
            if (item.number && item.lesson_id) {
              numberToLessonId[item.number] = item.lesson_id;
              lessonIdToNumber[item.lesson_id] = item.number;
            }
          });
          
          // Map the lessons using the number property
            const mappedLessonsData = legacyLessons.map(lesson => {
            // Find if there's a mapping for this lesson number
            const mappedLessonId = numberToLessonId[lesson.number];
            
            // If there's a mapping, use the mapped lesson_id
            return mappedLessonId 
              ? { ...lesson, lesson_id: mappedLessonId } 
              : lesson;
          });
          
          // Ensure they're sorted by number
          mappedLessonsData.sort((a, b) => a.number - b.number);
          
          console.log('Mapped lessons:', mappedLessonsData);
          
            activeLessons = mappedLessonsData;
            setMappedLessons(mappedLessonsData);
          } else {
            console.log('No lesson mappings found, using default lessons');
            activeLessons = [...legacyLessons].sort((a, b) => a.number - b.number);
            setMappedLessons(activeLessons);
          }
        }
        
        // Fetch progress
        const savedProgress = getProgress(gameId, activeLessons[0]?.lesson_id);
        const savedStudentId = localStorage.getItem(storageKey('student_id'));
        const savedCompletionTime = localStorage.getItem(storageKey('completion_time'));

        console.log('Current progress:', savedProgress);

        setProgress(prev => ({
          ...prev,
          ...savedProgress,
        }));
        setHasStudentId(!!savedStudentId);
        setIsGuest(!!savedStudentId && !localStorage.getItem(storageKey('student_ref_id')));
        setActiveStudentName(localStorage.getItem(storageKey('student_name')));
        setCompletionTime(savedCompletionTime);

        // 如果有學號且完成時間，獲取排名
        if (savedStudentId && savedCompletionTime && localStorage.getItem(storageKey('student_ref_id'))) {
          getPlayerRank(savedStudentId, gameId, assignmentId)
            .then(rank => {
              setPlayerRank(rank);
            })
            .catch(error => {
              console.error('Failed to fetch player rank:', error);
            });
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setLoadError(error instanceof Error ? error.message : '遊戲載入失敗');
        setIsLoading(false);
      }
    };
    
    fetchProgressAndMappings();
    
    // Set up a listener for localStorage changes from other tabs/windows
    const handleStorageChange = () => {
      fetchProgressAndMappings();
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [gameId, assignmentId]);
  
  useEffect(() => {
    if (showLeaderboardDialog) {
      getLeaderboardStats(gameId, assignmentId)
        .then(stats => {
          setLeaderboardStats(stats);
        })
        .catch(error => {
          console.error('Failed to fetch leaderboard stats:', error);
        });
    }
  }, [showLeaderboardDialog, gameId, assignmentId]);

  const handleReset = () => {
    // 清除所有追蹤資料
    localStorage.removeItem(storageKey('student_id'));
    localStorage.removeItem(storageKey('student_name'));
    localStorage.removeItem(storageKey('student_ref_id'));
    localStorage.removeItem(storageKey('start_time'));
    localStorage.removeItem(storageKey('completion_time'));
    localStorage.removeItem(storageKey('completion_time_seconds'));
    
    // 清除所有關卡開始時間
    mappedLessons.forEach(lesson =>
      localStorage.removeItem(storageKey(`lesson_${lesson.lesson_id}_start_time`)),
    );
    
    // 清除所有完成記錄
    localStorage.removeItem(storageKey('completions'));
    
    // 重置進度
    resetProgress(gameId, mappedLessons[0]?.lesson_id);
    setProgress({
      completedLessons: [],
      stars: 0,
      streak: 1,
      level: 1,
      exp: 0,
      dailyGoal: 100,
      dailyProgress: 0
    });
    
    // 重置學號狀態
    setHasStudentId(false);
    setIsGuest(false);
    setStudentId("");
    setStudentName("");
    setActiveStudentName(null);
    
    // 重新導向到首頁
    router.refresh();
  };

  const handleStartLearning = () => {
    if (hasStudentId) {
      const currentLessonId = getNextIncompleteLesson();
      const mappedLesson = mappedLessons.find(lesson => lesson.lesson_id === currentLessonId);
      if (mappedLesson) {
        router.push(lessonHref(mappedLesson.lesson_id));
      } else {
        router.push(lessonHref(mappedLessons[0].lesson_id));
      }
    } else {
      setShowStudentIdDialog(true);
    }
  };

  const startLearningSession = (
    id: string,
    name: string,
    studentRefId: string | null,
    resolvedAssignmentId?: string | null,
  ) => {
    if (gameId && resolvedAssignmentId) {
      localStorage.setItem(storageKey('game_assignment_id'), resolvedAssignmentId);
    }
    // 正確處理 UTC+8 時間
    const now = new Date();
    const startTime = new Date(now.getTime() - (now.getTimezoneOffset() * 60000))
      .toISOString()
      .replace('Z', '+08:00');

    // 清除之前的任何課程開始時間記錄
    mappedLessons.forEach(lesson =>
      localStorage.removeItem(storageKey(`lesson_${lesson.lesson_id}_start_time`)),
    );

    localStorage.setItem(storageKey('student_id'), id);
    localStorage.setItem(storageKey('student_name'), name);
    localStorage.setItem(storageKey('start_time'), startTime);
    if (studentRefId) {
      localStorage.setItem(storageKey('student_ref_id'), studentRefId);
    } else {
      localStorage.removeItem(storageKey('student_ref_id'));
    }
    console.log('Setting global start_time on student ID submission:', startTime);
    setHasStudentId(true);
    setIsGuest(!studentRefId);
    setActiveStudentName(name);

    // 直接導航到前導課程（0），若不存在則到第一關
    const firstLesson = mappedLessons.find(lesson => lesson.role === 'intro') || mappedLessons[0];
    if (firstLesson) {
      router.push(lessonHref(firstLesson.lesson_id, resolvedAssignmentId));
    } else {
      setLoadError('這款遊戲尚未設定任何關卡');
    }
  };

  const handleGuestStart = () => {
    // Guests stay pseudonymous and device-local - never a student number,
    // and the nickname (if any) is typed voluntarily, never uploaded to
    // Supabase (saveGuestPlayStats doesn't even accept a name field).
    const guestId = `guest_${crypto.randomUUID()}`;
    const nickname = guestNickname.trim().slice(0, 20);
    startLearningSession(guestId, nickname || '訪客玩家', null);
    setGuestNickname("");
  };

  const handleLoginCodeSubmit = async () => {
    if (!loginCode.trim() || verifyingCode) return;
    setVerifyingCode(true);
    setLoginCodeError(null);
    try {
      const verified = await verifyStudentLoginCode(loginCode, gameId, assignmentId);
      if (!verified) {
        setLoginCodeError(assignmentId
          ? "找不到這個學生編號，請確認輸入內容或詢問老師"
          : "請使用老師提供的班級活動連結，或輸入備用登入碼");
        return;
      }
      if (!assignmentId && (verified.assignment_count ?? 0) > 1) {
        setLoginCodeError("這個代碼同時屬於多個班級活動，請使用老師提供的班級專屬連結");
        return;
      }
      setVerifiedStudent(verified);
    } finally {
      setVerifyingCode(false);
    }
  };

  const confirmVerifiedStudent = () => {
    if (!verifiedStudent) return;
    startLearningSession(
      verifiedStudent.student_id,
      verifiedStudent.student_name,
      verifiedStudent.student_id,
      verifiedStudent.game_assignment_id,
    );
    setVerifiedStudent(null);
    setLoginCode("");
  };

  // Helper to determine the next incomplete lesson or current progress
  const getNextIncompleteLesson = () => {
    const nextIncomplete = mappedLessons.find(
      lesson => !progress.completedLessons.includes(lesson.lesson_id),
    );
    return nextIncomplete?.lesson_id ?? mappedLessons[mappedLessons.length - 1]?.lesson_id;
  };

  if (isLoading) {
    return <GameLoadingShell />;
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-gray-900 mb-2">無法載入遊戲</h1>
          <p className="text-gray-600">{loadError}</p>
        </div>
      </div>
    );
  }

  const visualTemplate = gameVisualTemplate(gameDefinition?.settings.theme);
  const leaderboardCopy = experienceForTemplate(visualTemplate).home;

  return (
    <div>
      <QuestHome game={gameDefinition} gameId={gameId} assignmentId={assignmentId} lessons={mappedLessons}
        completedLessons={progress.completedLessons} stars={progress.stars} level={progress.level} exp={progress.exp}
        signedIn={hasStudentId} isGuest={isGuest} guestName={activeStudentName} completionTime={completionTime} rank={playerRank}
        onStart={handleStartLearning} onReset={handleReset} onLeaderboard={() => setShowLeaderboardDialog(true)} />

      {/* 學號輸入對話框 */}
      <Dialog
        open={showStudentIdDialog}
        onOpenChange={(open) => {
          setShowStudentIdDialog(open);
          if (!open) {
            setVerifiedStudent(null);
            setLoginCodeError(null);
            setLoginCode("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">開始學習</DialogTitle>
            <DialogDescription className="text-base text-gray-600">
              選擇你要用哪種方式開始
            </DialogDescription>
          </DialogHeader>
          <Tabs
            defaultValue="code"
            className="mt-2"
            onValueChange={() => {
              setVerifiedStudent(null);
              setLoginCodeError(null);
            }}
          >
            <TabsList
              aria-label="選擇學習登入方式"
              className="grid h-auto w-full grid-cols-1 gap-3 bg-transparent p-0 sm:grid-cols-2"
            >
              <TabsTrigger
                value="code"
                className="group relative min-h-[108px] items-start justify-start whitespace-normal rounded-xl border-2 border-gray-200 bg-white p-4 text-left shadow-none transition-colors hover:border-blue-300 hover:bg-blue-50/50 data-[state=active]:border-blue-600 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-950 data-[state=active]:shadow-none"
              >
                <span className="flex w-full items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                    <KeyRound size={20} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-bold">輸入學生編號</span>
                    <span className="mt-1 block text-xs font-normal leading-5 text-gray-600">
                      不需註冊，保存進度與學習紀錄
                    </span>
                  </span>
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-gray-300 text-transparent group-data-[state=active]:border-blue-600 group-data-[state=active]:bg-blue-600 group-data-[state=active]:text-white">
                    <Check size={12} strokeWidth={3} aria-hidden="true" />
                  </span>
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="guest"
                className="group relative min-h-[108px] items-start justify-start whitespace-normal rounded-xl border-2 border-gray-200 bg-white p-4 text-left shadow-none transition-colors hover:border-blue-300 hover:bg-blue-50/50 data-[state=active]:border-blue-600 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-950 data-[state=active]:shadow-none"
              >
                <span className="flex w-full items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-700">
                    <UserRound size={20} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-bold">訪客試玩</span>
                    <span className="mt-1 block text-xs font-normal leading-5 text-gray-600">
                      不需代碼，紀錄不會交給老師
                    </span>
                  </span>
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-gray-300 text-transparent group-data-[state=active]:border-blue-600 group-data-[state=active]:bg-blue-600 group-data-[state=active]:text-white">
                    <Check size={12} strokeWidth={3} aria-hidden="true" />
                  </span>
                </span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="code" className="space-y-4 pt-5">
              {verifiedStudent ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">請確認身分</p>
                  <p className="mt-2 text-lg font-bold text-emerald-950">
                    {verifiedStudent.student_display_name || verifiedStudent.student_name}
                  </p>
                  {verifiedStudent.classroom_name && (
                    <p className="mt-1 text-sm text-emerald-800">班級：{verifiedStudent.classroom_name}</p>
                  )}
                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setVerifiedStudent(null);
                        setLoginCode("");
                      }}
                    >
                      不是我
                    </Button>
                    <Button type="button" onClick={confirmVerifiedStudent} className="bg-blue-600 font-bold text-white hover:bg-blue-700">
                      確認並開始
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <label htmlFor="loginCode" className="text-sm font-medium text-gray-700">
                      學號／研究編號
                    </label>
                    <input
                      id="loginCode"
                      type="text"
                      value={loginCode}
                      onChange={(e) => {
                        setLoginCode(e.target.value);
                        setLoginCodeError(null);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') void handleLoginCodeSubmit();
                      }}
                      autoComplete="off"
                      maxLength={64}
                      className="w-full rounded-lg border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="例如：A001"
                    />
                    <p className="text-xs text-gray-500">輸入老師登記在班級名單中的編號；特殊情況也可輸入備用登入碼。</p>
                    {loginCodeError && (
                      <p className="text-sm text-red-600" role="alert">{loginCodeError}</p>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <Button
                      onClick={handleLoginCodeSubmit}
                      disabled={!loginCode.trim() || verifyingCode}
                      className="bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700"
                    >
                      {verifyingCode ? "確認中..." : "確認身分"}
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>
            <TabsContent value="guest" className="space-y-4 pt-5">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                不需要登入代碼。進度只保存在這台裝置，不會寫入學習紀錄與排行榜；換裝置或清除瀏覽器資料後會遺失。
              </div>
              <div className="space-y-2">
                <label htmlFor="guestNickname" className="text-sm font-medium text-gray-700">
                  暱稱（選填）
                </label>
                <input
                  id="guestNickname"
                  type="text"
                  value={guestNickname}
                  onChange={(e) => setGuestNickname(e.target.value)}
                  maxLength={20}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="訪客玩家"
                />
                <p className="text-xs text-gray-500">只會顯示在這台裝置上，不會上傳或存進資料庫。</p>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={handleGuestStart}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg"
                >
                  匿名開始
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* 排行榜對話框 */}
      <Dialog open={showLeaderboardDialog} onOpenChange={setShowLeaderboardDialog}>
        <DialogContent
          data-game-template={visualTemplate}
          className="game-leaderboard sm:max-w-[640px] w-[95vw] max-h-[90vh] overflow-hidden"
        >
          <DialogHeader className="game-leaderboard-header">
            <span className="game-leaderboard-kicker">{leaderboardCopy.leaderboardKicker}</span>
            <DialogTitle className="game-leaderboard-title flex items-center gap-2 text-lg sm:text-xl mb-2">
              <span className="game-leaderboard-icon"><Trophy className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" /></span>
              {leaderboardCopy.leaderboardTitle}
            </DialogTitle>
            <DialogDescription className="game-leaderboard-description text-sm sm:text-base">
              {leaderboardCopy.leaderboardDescription}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 sm:space-y-6">
            {/* 排行榜統計資訊 */}
            <div className="game-leaderboard-stats grid grid-cols-3 gap-2 sm:gap-4">
              <div className="game-leaderboard-stat is-participants p-3 sm:p-4 text-center">
                <div className="game-leaderboard-stat-copy"><div className="game-leaderboard-value text-xl sm:text-2xl font-bold">{leaderboardStats.total_participants}</div><div className="game-leaderboard-label text-xs sm:text-sm">參與人數</div></div>
              </div>
              <div className="game-leaderboard-stat is-fastest p-3 sm:p-4 text-center">
                <div className="game-leaderboard-stat-copy"><div className="game-leaderboard-value text-xl sm:text-2xl font-bold">{leaderboardStats.fastest_time}</div><div className="game-leaderboard-label text-xs sm:text-sm">最快紀錄</div></div>
              </div>
              <div className="game-leaderboard-stat is-average p-3 sm:p-4 text-center">
                <div className="game-leaderboard-stat-copy"><div className="game-leaderboard-value text-xl sm:text-2xl font-bold">{leaderboardStats.average_time}</div><div className="game-leaderboard-label text-xs sm:text-sm">平均時間</div></div>
              </div>
            </div>

            {/* 排行榜列表 */}
            <div className="space-y-3 max-h-[calc(90vh-280px)] overflow-y-auto pr-2">
              {leaderboardStats.total_participants === 0 ? (
                <div className="game-leaderboard-empty text-center py-8">
                  目前還沒有完成紀錄
                </div>
              ) : (
                <div className="space-y-2">
                  {/* 表頭 */}
                  <div className="game-leaderboard-head grid grid-cols-12 gap-2 sm:gap-4 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium">
                    <div className="col-span-2">排名</div>
                    <div className="col-span-3 sm:col-span-4">學號</div>
                    <div className="col-span-3">姓名</div>
                    <div className="col-span-4 sm:col-span-3">完成時間</div>
                  </div>
                  {/* 排行榜數據 */}
                  {leaderboardStats.rankings.map((entry, index) => (
                    <div 
                      key={`${entry.student_id}-${index}`}
                      className={`game-leaderboard-row grid grid-cols-12 gap-2 sm:gap-4 px-3 sm:px-4 py-2 sm:py-3 ${
                        playerRank !== null && entry.rank === playerRank
                          ? 'is-current-player'
                          : ''
                      }`}
                    >
                      <div className="col-span-2 flex items-center">
                        <div className={`game-leaderboard-rank w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center font-bold text-xs sm:text-sm ${
                          index === 0 ? 'is-gold' : index === 1 ? 'is-silver' : index === 2 ? 'is-bronze' : 'is-standard'
                        }`}>
                          {entry.rank}
                        </div>
                      </div>
                      <div className="col-span-3 sm:col-span-4 flex items-center">
                        <span className="font-medium text-xs sm:text-sm truncate" title={entry.student_id}>
                          {entry.student_id}
                        </span>
                      </div>
                      <div className="col-span-3 flex items-center">
                        <span className="font-medium text-xs sm:text-sm truncate" title={entry.student_name}>
                          {entry.student_name}
                        </span>
                      </div>
                      <div className="col-span-4 sm:col-span-3 flex items-center">
                        <span className="game-leaderboard-time text-xs sm:text-sm">
                          {entry.completion_time_string}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
