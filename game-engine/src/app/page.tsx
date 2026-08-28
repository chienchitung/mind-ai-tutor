"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { FileSpreadsheet, Star, Flame, Trophy, RotateCcw, ChevronRight, Lock } from "lucide-react"
import { lessons } from '@/data/lessons'
import { getProgress, resetProgress } from '@/lib/progress'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useRouter } from "next/navigation"
import { getLeaderboardStats, getPlayerRank, getLessonOrderMappings } from '@/lib/supabase'
import { Lesson } from '@/types/lesson'

interface ProgressData {
  completedLessons: string[];
  stars: number;
  streak: number;
  level: number;
  exp: number;
  dailyGoal: number;
  dailyProgress: number;
}

export default function HomePage() {
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

  // Add state for mapped lessons
  const [mappedLessons, setMappedLessons] = useState<Lesson[]>(lessons);
  
  useEffect(() => {
    const fetchProgressAndMappings = async () => {
      try {
        // Fetch lesson order mappings
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
          const mappedLessonsData = lessons.map(lesson => {
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
          
          setMappedLessons(mappedLessonsData);
        } else {
          console.log('No lesson mappings found, using default lessons');
          // If no mapping found, use lessons as is but ensure they're sorted
          setMappedLessons([...lessons].sort((a, b) => a.number - b.number));
        }
        
        // Fetch progress
        const savedProgress = getProgress();
        const savedStudentId = localStorage.getItem('student_id');
        const savedCompletionTime = localStorage.getItem('completion_time');
        
        console.log('Current progress:', savedProgress);
        
        setProgress(prev => ({
          ...prev,
          ...savedProgress,
        }));
        setHasStudentId(!!savedStudentId);
        setCompletionTime(savedCompletionTime);

        // 如果有學號且完成時間，獲取排名
        if (savedStudentId && savedCompletionTime) {
          getPlayerRank(savedStudentId)
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
  }, []);
  
  useEffect(() => {
    if (showLeaderboardDialog) {
      getLeaderboardStats()
        .then(stats => {
          setLeaderboardStats(stats);
        })
        .catch(error => {
          console.error('Failed to fetch leaderboard stats:', error);
        });
    }
  }, [showLeaderboardDialog]);

  const isCompleted = progress.completedLessons.length === lessons.length;

  const handleReset = () => {
    // 清除所有追蹤資料
    localStorage.removeItem('student_id');
    localStorage.removeItem('student_name');
    localStorage.removeItem('start_time');
    localStorage.removeItem('completion_time');
    localStorage.removeItem('completion_time_seconds');
    
    // 清除所有關卡開始時間
    for (let i = 1; i <= 5; i++) {
      localStorage.removeItem(`lesson_${i}_start_time`);
    }
    
    // 清除所有完成記錄
    localStorage.removeItem('completions');
    
    // 重置進度
    resetProgress();
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
        router.push(`/lessons/${mappedLesson.lesson_id}`);
      } else {
        router.push(`/lessons/${mappedLessons[0].lesson_id}`);
      }
    } else {
      setShowStudentIdDialog(true);
    }
  };

  const handleStudentIdSubmit = () => {
    if (studentId.trim() && studentName.trim()) {
      // 正確處理 UTC+8 時間
      const now = new Date();
      const startTime = new Date(now.getTime() - (now.getTimezoneOffset() * 60000))
        .toISOString()
        .replace('Z', '+08:00');

      // 清除之前的任何課程開始時間記錄
      for (let i = 0; i <= 5; i++) {
        localStorage.removeItem(`lesson_${i}_start_time`);
      }
      
      localStorage.setItem('student_id', studentId.trim());
      localStorage.setItem('student_name', studentName.trim());
      localStorage.setItem('start_time', startTime);
      console.log('Setting global start_time on student ID submission:', startTime);
      setHasStudentId(true);
      
      // 直接導航到前導課程（0），若不存在則到第一關
      const firstLesson = mappedLessons.find(lesson => lesson.number === 0) || mappedLessons.find(lesson => lesson.number === 1);
      if (firstLesson) {
        router.push(`/lessons/${firstLesson.lesson_id}`);
      } else {
        router.push(`/lessons/${mappedLessons[0].lesson_id}`);
      }
    }
  };

  // Helper to determine the next incomplete lesson or current progress
  const getNextIncompleteLesson = () => {
    // If there are completed lessons, return the next one
    if (progress.completedLessons.length > 0 && progress.completedLessons.length < mappedLessons.length) {
      // Find the next lesson ID that hasn't been completed yet
      for (let i = 0; i < mappedLessons.length; i++) {
        if (!progress.completedLessons.includes(mappedLessons[i].lesson_id)) {
          return mappedLessons[i].lesson_id;
        }
      }
    }
    
    // If all lessons are completed, return the last one
    if (progress.completedLessons.length === mappedLessons.length) {
      return mappedLessons[mappedLessons.length - 1].lesson_id;
    }
    
    // If no lessons are completed, start with the first one
    return mappedLessons[0].lesson_id;
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

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="container mx-auto h-16 flex items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex items-center py-2 hover:opacity-80 transition-opacity">
            <div className="flex items-center">
              <span className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent">excel</span>
              <div className="w-6 h-6 relative mx-0.5">
                <FileSpreadsheet className="w-6 h-6 text-cyan-500" />
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full" />
              </div>
              <span className="text-3xl font-bold bg-gradient-to-r from-cyan-500 to-teal-500 bg-clip-text text-transparent">master</span>
            </div>
          </Link>

          <div className="flex items-center gap-2 md:gap-6">
            <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-[#F5F7FF] rounded-xl">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-[#2B4EFF]" />
                <span className="font-semibold text-gray-900">Level {progress.level}</span>
              </div>
              <div className="h-5 w-px bg-gray-200" />
              <div className="flex flex-col w-36">
                <div className="flex justify-between items-center text-sm text-gray-600 mb-1">
                  <span>經驗值</span>
                  <span>{progress.exp % 100}/100 XP</span>
                </div>
                <div className="relative h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="absolute top-0 left-0 h-full bg-[#2B4EFF] transition-all duration-300"
                    style={{ width: `${progress.exp % 100}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-3">
              <div className="flex items-center gap-2 px-3 md:px-4 py-2 bg-[#FFF5E5] rounded-xl">
                <Star className="h-4 w-4 md:h-5 md:w-5 text-[#FF9900] fill-[#FF9900]" />
                <span className="font-semibold text-[#B36B00] text-sm md:text-base">{progress.stars}</span>
              </div>
              <div className="flex items-center gap-2 px-3 md:px-4 py-2 bg-[#FFE5E5] rounded-xl">
                <Flame className="h-4 w-4 md:h-5 md:w-5 text-[#FF4B4B]" />
                <span className="font-semibold text-[#CC0000] text-sm md:text-base">{progress.streak} 天</span>
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-3 px-4">
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-2 text-sm mb-1">
                <span className="text-gray-500">課程進度</span>
                <span className="font-medium">{progress.completedLessons.length}/{lessons.length}</span>
              </div>
              <div className="w-32 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#58CC02] transition-all duration-300"
                  style={{ width: `${(progress.completedLessons.length / lessons.length) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 md:py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8 md:mb-12">
            <h1 className="text-3xl md:text-4xl font-bold mb-3 md:mb-4 text-gray-900">
              Excel 大師挑戰
            </h1>
            <p className="text-lg md:text-xl text-gray-600">
              踏上 Excel 技能提升之旅，成為數據分析專家！
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8 md:mb-12">
            {/* 每日目標進度 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#FFE5E5] flex items-center justify-center">
                  <Flame className="h-5 w-5 text-[#FF4B4B]" />
                </div>
                <div>
                  <div className="text-sm text-gray-500">今日進度</div>
                  <div className="text-xl font-bold text-gray-900">
                    {progress.dailyProgress}/{progress.dailyGoal} XP
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#FF4B4B] transition-all duration-300"
                    style={{ width: `${(progress.dailyProgress / progress.dailyGoal) * 100}%` }}
                  />
                </div>
                <div className="text-sm text-gray-500 text-center">
                  再獲得 {progress.dailyGoal - progress.dailyProgress} XP 完成今日目標
                </div>
              </div>
            </div>

            {/* 技能掌握度 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#F5F7FF] flex items-center justify-center">
                  <Trophy className="h-5 w-5 text-[#2B4EFF]" />
                </div>
                <div>
                  <div className="text-sm text-gray-500">技能掌握</div>
                  <div className="text-xl font-bold text-gray-900">
                    Level {progress.level}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#2B4EFF] transition-all duration-300"
                    style={{ width: `${progress.exp % 100}%` }}
                  />
                </div>
                <div className="text-sm text-gray-500 text-center">
                  距離下一等級還需 {100 - (progress.exp % 100)} XP
                </div>
              </div>
            </div>

            {/* 成就展示 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#FFF5E5] flex items-center justify-center">
                  <Star className="h-5 w-5 text-[#FF9900] fill-[#FF9900]" />
                </div>
                <div>
                  <div className="text-sm text-gray-500">星星收集</div>
                  <div className="text-xl font-bold text-gray-900">
                    {progress.stars}/50
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#FF9900] transition-all duration-300"
                    style={{ width: `${(progress.stars / 50) * 100}%` }}
                  />
                </div>
                <div className="text-sm text-gray-500 text-center">
                  {progress.stars >= 50 ? '可兌換特別獎勵！' : `再收集 ${50 - progress.stars} 顆星星可兌換獎勵`}
                </div>
              </div>
            </div>
          </div>

          {/* 主要內容區塊 */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr,320px] gap-6">
            {/* 左側課程列表 */}
            <div className="space-y-4">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6">
                <h2 className="text-xl font-bold mb-6 text-gray-900">學習路線圖</h2>
                <div className="relative">
                  {/* 連接線 */}
                  <div className="absolute top-0 left-5 w-0.5 h-full bg-gray-100" />
                  
                  <div className="space-y-4">
                    {mappedLessons.map((lesson, index) => {
                      const isCompleted = progress.completedLessons.includes(lesson.lesson_id);
                      const prevLesson = index > 0 ? mappedLessons[index - 1] : null;
                      // 鎖定規則：
                      // - 必須已輸入學號姓名
                      // - 前導課程（0）在有學號後永遠可進
                      // - 其他關卡需「上一關已完成」才解鎖
                      const canEnter = hasStudentId && (
                        lesson.number === 0 || (
                          !!prevLesson && progress.completedLessons.includes(prevLesson.lesson_id)
                        )
                      );
                      const isLocked = !canEnter;

                      return (
                        <div key={lesson.lesson_id} className="relative">
                          {index > 0 && (
                            <div className={`absolute left-[30px] -top-[50px] h-[70px] w-[2px] ${
                              isCompleted ? 'bg-[#1CB0F6]' : 'bg-gray-200'
                            }`} />
                          )}
                          
                          <div className="relative mb-10">
                            <Link 
                              href={isLocked ? "#" : `/lessons/${lesson.lesson_id}`}
                              className={`
                                block relative no-underline
                                ${isLocked ? 'cursor-not-allowed opacity-60' : ''}
                              `}
                              onClick={(e) => isLocked && e.preventDefault()}
                            >
                              <div className={`
                                bg-white rounded-xl shadow-sm border 
                                ${isCompleted ? 'border-[#1CB0F6]' : 'border-gray-100'} 
                                transition-transform hover:scale-[1.01] hover:shadow-md
                              `}>
                                <div className="p-4 sm:p-6">
                                  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                                    <div className={`
                                      w-[60px] h-[60px] rounded-full flex items-center justify-center 
                                      ${isCompleted 
                                        ? 'bg-[#1CB0F6] text-white' 
                                        : 'bg-gray-100 text-gray-500'}
                                      `}
                                    >
                                      <span className="text-2xl font-bold">{lesson.number}</span>
                                    </div>
                                    <div className="flex-1">
                                      <h2 className="text-lg font-semibold text-gray-900">{lesson.title}</h2>
                                      <p className="text-sm text-gray-600 mt-1">{lesson.description}</p>
                                    </div>
                                    <div>
                                      <div className={`
                                        px-3 py-2 rounded-lg flex items-center gap-1
                                        ${isLocked 
                                          ? 'bg-gray-100 text-gray-400' 
                                          : isCompleted
                                            ? 'bg-[#58CC02] text-white'
                                            : 'bg-[#2B4EFF] text-white'}
                                      `}>
                                        {lesson.number === 0 ? (
                                          isCompleted ? (
                                            <>
                                              <span className="text-sm font-medium">完成課程</span>
                                              <ChevronRight className="h-4 w-4" />
                                            </>
                                          ) : (
                                            <>
                                              <span className="text-sm font-medium">開始學習</span>
                                              <ChevronRight className="h-4 w-4" />
                                            </>
                                          )
                                        ) : isCompleted ? (
                                          <>
                                            <Star className="h-4 w-4 fill-current" />
                                            <span className="text-sm font-medium">10</span>
                                          </>
                                        ) : (
                                          <>
                                            <span className="text-sm font-medium">開始挑戰</span>
                                            <ChevronRight className="h-4 w-4" />
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </Link>
                            
                            {isLocked && (
                              <div className="absolute top-[24px] right-[24px]">
                                <div className="bg-gray-100 p-2 rounded-full">
                                  <Lock className="h-5 w-5 text-gray-500" />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* 右側區塊 */}
            <div className="space-y-6">
              {/* 排行榜卡片 */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-[#2B4EFF]" />
                    <h2 className="text-xl font-bold text-gray-900">排行榜</h2>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-sm"
                    onClick={() => setShowLeaderboardDialog(true)}
                  >
                    查看全部
                  </Button>
                </div>
                <div className="space-y-4">
                  {/* 修改排行榜顯示，僅在完成所有課程後顯示總時間和排名 */}
                  {progress.completedLessons.length === mappedLessons.length && mappedLessons.length > 0 ? (
                    <div 
                      className="flex items-center justify-between p-3 bg-[#F5F7FF] rounded-lg cursor-pointer hover:bg-[#EEF1FF] transition-colors"
                      onClick={() => setShowLeaderboardDialog(true)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#2B4EFF] flex items-center justify-center text-white font-bold">
                          {playerRank || '--'}
                        </div>
                        <div>
                          <div className="font-medium">您的排名</div>
                          <div className="text-sm text-gray-500">{completionTime || '--:--'}</div>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </div>
                  ) : (
                    <div className="p-3 text-center text-gray-500 bg-gray-50 rounded-lg">
                      完成所有關卡後顯示總時間和排名
                    </div>
                  )}
                </div>
              </div>

              {/* 開始學習按鈕卡片 */}
              <div className="bg-[#2B4EFF] rounded-2xl shadow-lg p-4 md:p-6 text-white">
                <h2 className="text-lg md:text-xl font-bold mb-3 md:mb-4">準備好開始嗎？</h2>
                <p className="mb-4 md:mb-6 text-white/90 text-sm md:text-base">
                  立即開始您的 Excel 學習之旅，一步步成為數據分析專家！
                </p>
                {isCompleted ? (
                  <Button
                    onClick={handleReset}
                    className="w-full bg-white text-[#2B4EFF] hover:bg-blue-50 font-bold text-base md:text-lg py-3 md:py-4 rounded-xl shadow-lg transition duration-300 ease-in-out transform hover:-translate-y-1 flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="h-4 w-4 md:h-5 md:w-5" />
                    重新挑戰
                  </Button>
                ) : (
                  <Button
                    onClick={handleStartLearning}
                    className="w-full bg-white text-[#2B4EFF] hover:bg-blue-50 font-bold text-base md:text-lg py-3 md:py-4 rounded-xl shadow-lg transition duration-300 ease-in-out transform hover:-translate-y-1"
                  >
                    {hasStudentId ? '繼續學習' : '開始學習'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 學號輸入對話框 */}
      <Dialog open={showStudentIdDialog} onOpenChange={setShowStudentIdDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">開始學習</DialogTitle>
            <DialogDescription className="text-base">
              請輸入您的學號和姓名以開始學習
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
                        entry.student_id === localStorage.getItem('student_id')
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
