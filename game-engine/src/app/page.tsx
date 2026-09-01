"use client"

import { useState, useEffect } from "react"
import { Trophy } from "lucide-react"
import { QuestHome } from "@/components/QuestHome"
import { lessons as legacyLessons } from '@/data/lessons'
import { getProgress, resetProgress } from '@/lib/progress'
import { getPublicGameManifest } from '@/lib/game-manifest'
import { gameStorageKey } from '@/lib/game-storage'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useRouter } from "next/navigation"
import { getLeaderboardStats, getPlayerRank, getLessonOrderMappings, verifyStudentLoginCode } from '@/lib/supabase'
import { Lesson } from '@/types/lesson'
import type { GameDefinition } from '@/types/game'

interface ProgressData {
  completedLessons: string[];
  stars: number;
  streak: number;
  level: number;
  exp: number;
  dailyGoal: number;
  dailyProgress: number;
}

export default function HomePage({ gameId }: { gameId?: string }) {
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
  const [loginCode, setLoginCode] = useState("");
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
  const lessonHref = (lessonId: string) =>
    gameId ? `/${gameId}/lessons/${lessonId}` : `/lessons/${lessonId}`;
  
  useEffect(() => {
    const fetchProgressAndMappings = async () => {
      try {
        setLoadError(null);
        let activeLessons: Lesson[] = [];

        if (gameId) {
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
        setCompletionTime(savedCompletionTime);

        // 如果有學號且完成時間，獲取排名
        if (savedStudentId && savedCompletionTime) {
          getPlayerRank(savedStudentId, gameId)
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
  }, [gameId]);
  
  useEffect(() => {
    if (showLeaderboardDialog) {
      getLeaderboardStats(gameId)
        .then(stats => {
          setLeaderboardStats(stats);
        })
        .catch(error => {
          console.error('Failed to fetch leaderboard stats:', error);
        });
    }
  }, [showLeaderboardDialog, gameId]);

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

  const startLearningSession = (id: string, name: string, studentRefId: string | null) => {
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

    // 直接導航到前導課程（0），若不存在則到第一關
    const firstLesson = mappedLessons.find(lesson => lesson.role === 'intro') || mappedLessons[0];
    if (firstLesson) {
      router.push(lessonHref(firstLesson.lesson_id));
    } else {
      setLoadError('這款遊戲尚未設定任何關卡');
    }
  };

  const handleStudentIdSubmit = () => {
    if (studentId.trim() && studentName.trim()) {
      startLearningSession(studentId.trim(), studentName.trim(), null);
    }
  };

  const handleLoginCodeSubmit = async () => {
    if (!loginCode.trim() || verifyingCode) return;
    setVerifyingCode(true);
    setLoginCodeError(null);
    try {
      const verified = await verifyStudentLoginCode(loginCode);
      if (!verified) {
        setLoginCodeError("代碼錯誤，請確認後再試一次");
        return;
      }
      startLearningSession(verified.student_id, verified.student_name, verified.student_id);
    } finally {
      setVerifyingCode(false);
    }
  };

  // Helper to determine the next incomplete lesson or current progress
  const getNextIncompleteLesson = () => {
    const nextIncomplete = mappedLessons.find(
      lesson => !progress.completedLessons.includes(lesson.lesson_id),
    );
    return nextIncomplete?.lesson_id ?? mappedLessons[mappedLessons.length - 1]?.lesson_id;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">載入中...</p>
        </div>
      </div>
    );
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

  return (
    <div>
      <QuestHome game={gameDefinition} gameId={gameId} lessons={mappedLessons}
        completedLessons={progress.completedLessons} stars={progress.stars} level={progress.level} exp={progress.exp}
        signedIn={hasStudentId} isGuest={isGuest} completionTime={completionTime} rank={playerRank}
        onStart={handleStartLearning} onReset={handleReset} onLeaderboard={() => setShowLeaderboardDialog(true)} />

      {/* 學號輸入對話框 */}
      <Dialog open={showStudentIdDialog} onOpenChange={setShowStudentIdDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">開始學習</DialogTitle>
            <DialogDescription className="text-base">
              選擇你要用哪種方式開始
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="code">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="code">老師提供的代碼</TabsTrigger>
              <TabsTrigger value="guest">訪客體驗</TabsTrigger>
            </TabsList>
            <TabsContent value="code" className="space-y-4 py-4">
              <div className="space-y-2">
                <label htmlFor="loginCode" className="text-sm font-medium text-gray-700">
                  登入代碼
                </label>
                <input
                  id="loginCode"
                  type="text"
                  value={loginCode}
                  onChange={(e) => {
                    setLoginCode(e.target.value);
                    setLoginCodeError(null);
                  }}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="請輸入老師提供的登入代碼"
                />
                {loginCodeError && (
                  <p className="text-sm text-red-600">{loginCodeError}</p>
                )}
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={handleLoginCodeSubmit}
                  disabled={!loginCode.trim() || verifyingCode}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg"
                >
                  {verifyingCode ? "驗證中..." : "開始學習"}
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="guest" className="space-y-4 py-4">
              <p className="text-xs text-gray-500">
                訪客進度只會保存在這台裝置，換裝置或清除瀏覽器資料會遺失紀錄。
              </p>
              <div className="space-y-2">
                <label htmlFor="studentId" className="text-sm font-medium text-gray-700">
                  學號
                </label>
                <input
                  id="studentId"
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="請輸入學號"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="studentName" className="text-sm font-medium text-gray-700">
                  姓名
                </label>
                <input
                  id="studentName"
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="請輸入姓名"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={handleStudentIdSubmit}
                  disabled={!studentId.trim() || !studentName.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg"
                >
                  開始學習
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* 排行榜對話框 */}
      <Dialog open={showLeaderboardDialog} onOpenChange={setShowLeaderboardDialog}>
        <DialogContent className="sm:max-w-[600px] w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl mb-2">
              <Trophy className="h-5 w-5 sm:h-6 sm:w-6 text-[#2B4EFF]" />
              完成時間排行榜
            </DialogTitle>
            <DialogDescription className="text-sm sm:text-base">
              查看所有學習者的完成時間排名
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 sm:space-y-6">
            {/* 排行榜統計資訊 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
              <div className="bg-[#F5F7FF] rounded-xl p-3 sm:p-4 text-center">
                <div className="text-xl sm:text-2xl font-bold text-[#2B4EFF]">{leaderboardStats.total_participants}</div>
                <div className="text-xs sm:text-sm text-gray-500">參與人數</div>
              </div>
              <div className="bg-[#FFF5E5] rounded-xl p-3 sm:p-4 text-center">
                <div className="text-xl sm:text-2xl font-bold text-[#FF9900]">{leaderboardStats.fastest_time}</div>
                <div className="text-xs sm:text-sm text-gray-500">最快紀錄</div>
              </div>
              <div className="bg-[#E5FFE1] rounded-xl p-3 sm:p-4 text-center">
                <div className="text-xl sm:text-2xl font-bold text-[#58CC02]">{leaderboardStats.average_time}</div>
                <div className="text-xs sm:text-sm text-gray-500">平均時間</div>
              </div>
            </div>

            {/* 排行榜列表 */}
            <div className="space-y-3 max-h-[calc(90vh-280px)] overflow-y-auto pr-2">
              {leaderboardStats.total_participants === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  目前還沒有完成紀錄
                </div>
              ) : (
                <div className="space-y-2">
                  {/* 表頭 */}
                  <div className="grid grid-cols-12 gap-2 sm:gap-4 px-3 sm:px-4 py-2 bg-gray-50 rounded-lg text-xs sm:text-sm font-medium text-gray-600">
                    <div className="col-span-2">排名</div>
                    <div className="col-span-3 sm:col-span-4">學號</div>
                    <div className="col-span-3">姓名</div>
                    <div className="col-span-4 sm:col-span-3">完成時間</div>
                  </div>
                  {/* 排行榜數據 */}
                  {leaderboardStats.rankings.map((entry, index) => (
                    <div 
                      key={`${entry.student_id}-${index}`}
                      className={`grid grid-cols-12 gap-2 sm:gap-4 px-3 sm:px-4 py-2 sm:py-3 rounded-lg ${
                        entry.student_id === localStorage.getItem(storageKey('student_id'))
                          ? 'bg-[#F5F7FF] border border-[#2B4EFF]'
                          : 'bg-white border border-gray-100'
                      }`}
                    >
                      <div className="col-span-2 flex items-center">
                        <div className={`
                          w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm
                          ${index === 0 ? 'bg-[#FFD700] text-white' :
                            index === 1 ? 'bg-[#C0C0C0] text-white' :
                            index === 2 ? 'bg-[#CD7F32] text-white' :
                            'bg-gray-100 text-gray-600'}
                        `}>
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
                        <span className="text-xs sm:text-sm text-gray-600">
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
