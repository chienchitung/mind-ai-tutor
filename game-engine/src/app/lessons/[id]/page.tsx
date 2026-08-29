"use client"

import React, { useState, useEffect, useRef, use, useCallback } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Star, MessageCircle, ChevronRight, ChevronLeft, FileSpreadsheet, Trophy, Flame, X, Gift, CheckCircle, XCircle, KeyRound, Image as ImageIcon, Zap } from 'lucide-react'
import { lessons as legacyLessons } from '@/data/lessons'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { State, type ChatMessage } from '@/types/lesson'
import { getProgress, updateLessonProgress } from '@/lib/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { saveLearningRecord, saveLeaderboardEntry, getPlayerRank, getLeaderboardStats, supabase, getGeniallyLink, getLessonMarkdownContent } from '@/lib/supabase'
import { initializeGemini, getChatResponse } from '@/lib/gemini'
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm'
import { RobotAvatar } from '@/components/RobotAvatar'
import { getLearningRecordId, getOrCreateQuestionCount, incrementQuestionCount, saveChatMessage } from '@/lib/supabase'
import { getPublicGameManifest } from '@/lib/game-manifest'
import { gameStorageKey } from '@/lib/game-storage'
import type { Lesson } from '@/types/lesson'
import type { GameDefinition } from '@/types/game'


const ChatMessage = ({ message, isUser, imageUrl }: { message: string; isUser: boolean; imageUrl?: string }) => {
  const [isTyping, setIsTyping] = useState(!isUser);
  const [displayedMessage, setDisplayedMessage] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const messageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsVisible(true);
    if (!isUser) {
      setDisplayedMessage('');
      setIsTyping(true);
      
      if (message) {
        const timer = setTimeout(() => {
          setIsTyping(false);
          setDisplayedMessage(message);
          // 當消息內容更新時滾動到底部
          messageRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 800);
        return () => clearTimeout(timer);
      }
      return () => {};
    } else {
      setIsTyping(false);
      setDisplayedMessage(message);
      // 用戶消息立即滾動到底部
      messageRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [message, isUser]);

  return (
    <div 
      ref={messageRef}
      className={`message-container ${isUser ? 'user' : 'bot'} transition-all duration-300 ease-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} w-full`}>
        {!isUser && (
          <div className="flex w-full gap-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center overflow-hidden border-2 border-gray-200">
                <RobotAvatar className="w-full h-full" />
              </div>
            </div>
            <div className="flex-grow">
              {isTyping ? (
                <div className="typing-indicator p-4 bg-gray-50 rounded-2xl">
                  <div className="flex gap-1">
                    <div className="typing-dot animate-bounce delay-0"></div>
                    <div className="typing-dot animate-bounce delay-150"></div>
                    <div className="typing-dot animate-bounce delay-300"></div>
                  </div>
                </div>
              ) : (
                <div className="chat-bubble bot transition-all duration-300 ease-out">
                  <div className="prose prose-base max-w-none dark:prose-invert markdown-content text-sm md:text-base [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                    {/* 如果有圖片，顯示圖片 */}
                    {imageUrl && (
                      <div className="mb-3">
                        <Image
                          src={imageUrl}
                          alt="Uploaded"
                          width={400}
                          height={300}
                          className="max-w-full rounded-lg"
                        />
                      </div>
                    )}
                    {!displayedMessage.trim() && isUser ? (
                      <span className="text-gray-300">圖片</span>
                    ) : (
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        components={{
                          h1: ({children}: any) => <h1 className="text-xl font-bold mb-4 text-blue-600">{children}</h1>,
                          h2: ({children}: any) => <h2 className="text-lg font-semibold mb-3 mt-6">{children}</h2>,
                          h3: ({children}: any) => <h3 className="text-md font-semibold mb-2 mt-4">{children}</h3>,
                          h4: ({children}: any) => <h4 className="font-medium mb-2 mt-4">{children}</h4>,
                          table: ({ children }: any) => (
                            <div className="overflow-x-auto my-4">
                              <table className="min-w-full border-collapse border border-gray-300">
                                {children}
                              </table>
                            </div>
                          ),
                          th: ({ children }: any) => (
                            <th className="border border-gray-300 bg-gray-100 px-4 py-2 text-left">
                              {children}
                            </th>
                          ),
                          td: ({ children }: any) => (
                            <td className="border border-gray-300 px-4 py-2">
                              {children}
                            </td>
                          ),
                          p: ({ children }: any) => (
                            <p className="mb-4 last:mb-0 whitespace-pre-wrap">
                              {children}
                            </p>
                          ),
                          ul: ({children}: any) => <ul className="list-disc pl-6 mb-4">{children}</ul>,
                          ol: ({children}: any) => <ol className="list-decimal pl-6 mb-4">{children}</ol>,
                          li: ({children}: any) => <li className="mb-1">{children}</li>,
                          blockquote: ({children}: any) => {
                            // 檢查內容是否包含特殊提示標記
                            const childrenArray = React.Children.toArray(children);
                            const firstChild = childrenArray[0];
                            
                            // 類型斷言和類型守衛
                            const isReactElement = (obj: unknown): obj is React.ReactElement => {
                              return obj !== null && typeof obj === 'object' && 'props' in obj;
                            };

                            // 檢查是否為警告提示
                            if (isReactElement(firstChild) && 
                                (firstChild.props as any)?.children) {
                              // 將子元素轉換為字符串，但先確保它是可以toString()的類型
                              const childContent = String((firstChild.props as any).children);
                              if (childContent.includes('⚠️ **Warning:**')) {
                                return (
                                  <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-4 rounded-r">
                                    <div className="flex">
                                      <div className="flex-shrink-0 text-amber-500">⚠️</div>
                                      <div className="ml-3 text-amber-700">{children as React.ReactNode}</div>
                                    </div>
                                  </div>
                                );
                              }
                            }
                            
                            // 檢查是否為提示
                            if (isReactElement(firstChild) && 
                                (firstChild.props as any)?.children) {
                              // 將子元素轉換為字符串，但先確保它是可以toString()的類型
                              const childContent = String((firstChild.props as any).children);
                              if (childContent.includes('💡 **Tip:**')) {
                                return (
                                  <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4 rounded-r">
                                    <div className="flex">
                                      <div className="flex-shrink-0 text-blue-500">💡</div>
                                      <div className="ml-3 text-blue-700">{children as React.ReactNode}</div>
                                    </div>
                                  </div>
                                );
                              }
                            }
                            
                            // 檢查是否為注意事項
                            if (isReactElement(firstChild) && 
                                (firstChild.props as any)?.children) {
                              // 將子元素轉換為字符串，但先確保它是可以toString()的類型
                              const childContent = String((firstChild.props as any).children);
                              if (childContent.includes('**Note:**')) {
                                return (
                                  <div className="bg-gray-50 border-l-4 border-gray-500 p-4 mb-4 rounded-r">
                                    <div className="flex">
                                      <div className="ml-3 text-gray-700">{children as React.ReactNode}</div>
                                    </div>
                                  </div>
                                );
                              }
                            }
                            
                            // 默認引用塊樣式
                            return (
                              <blockquote className="border-l-4 border-gray-300 pl-4 py-1 mb-4 italic text-gray-700">
                                {children as React.ReactNode}
                              </blockquote>
                            );
                          },
                          code: ({ children, className }) => {
                            const match = /language-(\w+)/.exec(className || '')
                            if (match) {
                              return (
                                <div className="my-6 border-l-4 border-blue-500">
                                  <pre className="pl-4 py-4 bg-blue-50 overflow-x-auto text-gray-800 font-mono text-sm">
                                    <code className={className}>{children}</code>
                                  </pre>
                                </div>
                              )
                            }
                            return <code className="px-1.5 py-0.5 bg-blue-50 rounded text-blue-600 font-mono text-sm">{children}</code>
                          }
                        }}
                      >
                        {displayedMessage}
                      </ReactMarkdown>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {isUser && (
          <div className="chat-bubble user">
            {/* 如果用戶訊息有圖片，也顯示圖片 */}
            {imageUrl && (
              <div className="mb-2 max-w-xs md:max-w-sm">
                <Image
                  src={imageUrl}
                  alt="Uploaded"
                  width={300}
                  height={200}
                  className="w-full rounded-lg object-contain"
                />
              </div>
            )}
            {displayedMessage.trim() ? (
              <span className="text-sm md:text-base whitespace-pre-wrap">{displayedMessage}</span>
            ) : imageUrl ? (
              <span className="text-sm md:text-base text-gray-300 italic">圖片</span>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

const getInitialMessage = (gameTitle = '學習挑戰', lessonCount = 5) => {
  return `# 您好，我是艾利斯，${gameTitle}學習助手！

我可以協助您理解目前的課程內容與練習：

* 共有${lessonCount}個關卡
* 完成練習可獲得星星和經驗值
* 累積足夠星星可兌換特別獎勵
* 您可以針對課程與題目向我提問
* 可以上傳截圖以獲得更精確的協助

## 如何使用我的協助：

1. **關於課程內容**：詢問關於當前課程的概念和技巧
2. **關於練習題**：我可以提供循序漸進的引導和提示
3. **延伸問題**：詢問課程相關的概念與操作技巧

請告訴我您需要什麼幫助？`;
};

// 定義聊天上下文介面
interface ChatContext {
  context: Array<{
    content: string;
    isUser: boolean;
  }>;
  lessonInfo: string;
  gameTitle?: string;
  tutorPrompt?: string;
}

// Add table rendering for practice exercises
const formatExerciseContent = (content: string) => {
  // Check if the content contains table-like data with line-separated rows
  if (content.includes('\\n\\n')) {
    // Format table data correctly
    return content
      .split('\\n\\n')
      .map(line => {
        // Process each line to create proper table formatting
        if (line.includes('|')) {
          return line.replace(/\\n/g, '\n');
        }
        return line;
      })
      .join('\n\n');
  }
  // If it looks like a table with pipe separators
  if (content.includes('|')) {
    return content.replace(/\\n/g, '\n');
  }
  
  // Handle numbered lists with line breaks
  let formattedContent = content
    // Replace escaped newlines before numbered items with actual newlines
    .replace(/\\n(\d+)\./g, '\n$1.')
    // Replace all other escaped newlines with actual newlines
    .replace(/\\n/g, '\n')
    // Add a space after numbered bullets if missing
    .replace(/(\d+)\.([\S])/g, '$1. $2');
  
  // Handle special characters and formatting
  formattedContent = formattedContent
    // Format function names with backticks for code style
    .replace(/=([A-Z]+)\(/g, '=`$1(`')
    .replace(/\)/g, '`)');
  
  return formattedContent;
};

// For better explanation formatting in the answer section
const formatExplanation = (explanation: string) => {
  if (!explanation) return '';
  
  // First handle the basic formatting
  let formatted = explanation
    // Replace escaped newlines before numbered items with actual newlines
    .replace(/\\n(\d+)\./g, '\n$1.')
    // Replace all other escaped newlines with actual newlines
    .replace(/\\n/g, '\n')
    // Add space after numbered items if missing
    .replace(/(\d+)\.([\S])/g, '$1. $2');
  
  // Format Excel functions as code
  formatted = formatted
    .replace(/=([A-Z]+)\(([^)]+)\)/g, '`=$1($2)`');
  
  return formatted;
};

export default function ExcelLearningPlatform({
  params,
  gameId,
}: {
  params: Promise<{ id: string }>
  gameId?: string
}) {
  const resolvedParams = use(params);
  const [gameDefinition, setGameDefinition] = useState<GameDefinition | null>(null);
  const [gameLessons, setGameLessons] = useState<Lesson[]>(gameId ? [] : legacyLessons);
  const [gameLoadError, setGameLoadError] = useState<string | null>(null);
  const lessons = gameLessons;
  const storageKey = (key: string) => gameStorageKey(gameId, key);
  const lessonHref = (lessonId: string) =>
    gameId ? `/games/${gameId}/lessons/${lessonId}` : `/lessons/${lessonId}`;

  useEffect(() => {
    if (!gameId) return;
    getPublicGameManifest(gameId)
      .then(manifest => {
        if (!manifest.lessons.some(lesson => lesson.lesson_id === resolvedParams.id)) {
          throw new Error('這個關卡不屬於指定的遊戲');
        }
        setGameDefinition(manifest);
        setGameLessons(manifest.lessons);
        setGameLoadError(null);
      })
      .catch(error => {
        console.error('Failed to load game manifest:', error);
        setGameLoadError(error instanceof Error ? error.message : '遊戲載入失敗');
      });
  }, [gameId, resolvedParams.id]);
  const [showRewardDialog, setShowRewardDialog] = useState(false);
  const [completionTime, setCompletionTime] = useState<string | null>(null);
  const [playerRank, setPlayerRank] = useState<number | null>(null);
  const [leaderboardStats, setLeaderboardStats] = useState<{
    total_participants: number;
    fastest_time: string;
    average_time: string;
  }>({
    total_participants: 0,
    fastest_time: '--:--',
    average_time: '--:--'
  });
  const [lessonState, setLessonState] = useState<State>({
    currentLesson: resolvedParams.id,
    completed: false,
    stars: 0,
    completedLessons: [],
    answer: "",
    hasSubmitted: false,
    isCorrect: false,
    showChat: false,
    exp: 0,
    level: 1,
    dailyProgress: 0,
    dailyGoal: 50,
    streak: 1
  });
  const [isExpanded, setIsExpanded] = useState(false);
  const [exercisesData, setExercisesData] = useState<Array<{question: string, answer: string, explanation: string}>>([]);
  const [currentExplanation, setCurrentExplanation] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 追蹤"檢查答案"的嘗試次數
  const [answerAttempts, setAnswerAttempts] = useState<number>(0);

  // 添加用於暫存對話記錄和提問次數的 state
  const [pendingChatMessages, setPendingChatMessages] = useState<Array<{
    content: string;
    is_user: boolean;
    timestamp: string;
    imageUrl?: string;
  }>>([]);
  
  const [pendingQuestionCount, setPendingQuestionCount] = useState<number>(0);

  // 添加 lessonMarkdown 狀態
  const [lessonMarkdown, setLessonMarkdown] = useState<string | null>(null);

  // 修改 getLessonNumber 函數使用 lesson_id
  const getLessonNumber = (lessonId: string): number => {
    const configuredLesson = lessons.find(lesson => lesson.lesson_id === lessonId);
    if (gameId) return configuredLesson?.number ?? 0;

    // Direct mapping of lesson UUIDs to numbers
    const lessonMapping: {[key: string]: number} = {
      "a1b2c3d4-e5f6-47a8-9b0c-1d2e3f4a5b6c": 1, 
      "b2c3d4e5-f6a7-58b9-ac0d-2e3f4a5b6c7d": 2, 
      "d4e5f6a7-b8c9-7adb-ce2f-4a5b6c7d8e9f": 3, 
      "c3d4e5f6-a7b8-69ca-bd1e-3f4a5b6c7d8e": 4, 
      "e5f6a7b8-c9da-8bec-df3a-5b6c7d8e9f0a": 5
    };
    
    // Return the mapped number or fallback to finding the lesson in the lessons array
    return lessonMapping[lessonId] || configuredLesson?.number || 0;
  };

  const isIntroLesson = (lessonId: string) => {
    const lesson = lessons.find(item => item.lesson_id === lessonId);
    return lesson?.role === 'intro' || (!gameId && lesson?.number === 0);
  };

  const isFinalLesson = (lessonId: string) => {
    const lesson = lessons.find(item => item.lesson_id === lessonId);
    return lesson?.role === 'final' || lesson?.isFinal === true || (!gameId && lesson?.number === 5);
  };

  // 修改 getNextLessonId 函數
  const getNextLessonId = (currentId: string): string | null => {
    const currentIndex = lessons.findIndex(lesson => lesson.lesson_id === currentId);
    return currentIndex >= 0 ? lessons[currentIndex + 1]?.lesson_id ?? null : null;
  };

  // 修改 getPrevLessonId 函數
  const getPrevLessonId = (currentId: string): string | null => {
    const currentIndex = lessons.findIndex(lesson => lesson.lesson_id === currentId);
    return currentIndex > 0 ? lessons[currentIndex - 1]?.lesson_id ?? null : null;
  };

  // Define the function with useCallback to avoid redefining on every render
  const fetchExercisesAndProgress = useCallback(async (currentLessonId: string) => {
    try {
      // 每次加載課程時都重置答案嘗試次數為0
      setAnswerAttempts(0);
      
      // New game routes receive exercises in the safe public manifest. The
      // direct lessons query remains only for the legacy Excel route.
      const configuredExercises = lessons.find(
        lesson => lesson.lesson_id === currentLessonId,
      )?.practiceExercises;
      let practiceExercises = configuredExercises;

      if (!gameId) {
        const { data, error } = await supabase
          .from('lessons')
          .select('practice_exercises')
          .eq('id', currentLessonId)
          .single();

        if (error) {
          console.error('Error fetching exercises:', error.message || error);
          return;
        }
        practiceExercises = data?.practice_exercises;
      }

      if (practiceExercises) {
        const parsedExercises = typeof practiceExercises === 'string'
          ? JSON.parse(practiceExercises)
          : practiceExercises;
        setExercisesData(parsedExercises);
      } else {
        setExercisesData([]);
      }

      // Get progress
      const progress = getProgress(gameId, lessons[0]?.lesson_id);
      const isLessonCompleted = progress.completedLessons.includes(currentLessonId);
      
      // 記錄關卡開始時間
      if (!isLessonCompleted) {
        const now = new Date();
        const lessonStartTime = new Date(now.toISOString());
        localStorage.setItem(storageKey(`lesson_${currentLessonId}_start_time`), lessonStartTime.toISOString());

        // The first visited lesson starts this game's timer. This removes the
        // old assumptions that level 1 starts and level 5 ends every game.
        if (!localStorage.getItem(storageKey('start_time'))) {
          localStorage.setItem(storageKey('start_time'), lessonStartTime.toISOString());
        }
      }
      
      // Set current lesson state based on progress
      setLessonState(prev => ({
        ...prev,
        currentLesson: currentLessonId,
        stars: progress.stars,
        completedLessons: progress.completedLessons,
        hasSubmitted: isLessonCompleted,
        isCorrect: isLessonCompleted,
        // 僅在切換課程時重置答案，避免輸入時被清空
        answer: prev.currentLesson !== currentLessonId ? "" : prev.answer,
        exp: progress.exp,
        level: progress.level,
        dailyProgress: progress.dailyProgress,
        streak: progress.streak || 1
      }));

      // If lesson was already completed, get the explanation
      if (isLessonCompleted && exercisesData.length > 0) {
        setCurrentExplanation(exercisesData[0].explanation || '');
      }

      // 讀取完成時間和排行榜統計
      if (showRewardDialog) {
        const savedTime = localStorage.getItem(storageKey('completion_time'));
        if (savedTime) {
          setCompletionTime(savedTime);
        }

        // 獲取玩家排名
        const studentId = localStorage.getItem(storageKey('student_id')) || 'guest';
        getPlayerRank(studentId, gameId)
          .then(rank => {
            setPlayerRank(rank);
          })
          .catch(error => {
            console.error('Failed to fetch player rank:', error);
          });

        // 獲取排行榜統計數據
        getLeaderboardStats(gameId)
          .then(stats => {
            setLeaderboardStats(stats);
          })
          .catch(error => {
            console.error('Failed to fetch leaderboard stats:', error);
          });
      }

    } catch (error) {
      console.error('Error in fetchExercisesAndProgress:', error instanceof Error ? error.message : JSON.stringify(error));
    }
  }, [showRewardDialog, gameId, lessons]);

  useEffect(() => {
    // Initialize student ID and name if not already set
    if (!localStorage.getItem(storageKey('student_id'))) {
      const randomId = 'user_' + Math.random().toString(36).substring(2, 10);
      localStorage.setItem(storageKey('student_id'), randomId);
    }
    
    if (!localStorage.getItem(storageKey('student_name'))) {
      localStorage.setItem(storageKey('student_name'), 'Anonymous User');
    }
    
    // 獲取當前課程 ID
    const currentLessonId = resolvedParams.id;
    
    // Call the fetchExercisesAndProgress function
    fetchExercisesAndProgress(currentLessonId);
    
  }, [resolvedParams.id, showRewardDialog, fetchExercisesAndProgress, gameId]);

  // Add an extra effect to update explanation when exercises data changes
  useEffect(() => {
    if (lessonState.hasSubmitted && exercisesData.length > 0) {
      setCurrentExplanation(exercisesData[0].explanation || '');
    }
  }, [exercisesData, lessonState.hasSubmitted]);

  // 載入課程時獲取 Genially 連結 - 使用 useEffect 確保只在客戶端執行
  useEffect(() => {
    const fetchGeniallyLink = async () => {
      try {
        if (gameId) {
          const configuredLink = lessons.find(
            lesson => lesson.lesson_id === lessonState.currentLesson,
          )?.geniallyLink;
          setGeniallyLink(configuredLink ?? null);
          return;
        }
        // 從 Supabase 獲取當前課程的 Genially 連結
        const link = await getGeniallyLink(lessonState.currentLesson);
        if (link) {
          setGeniallyLink(link);
          console.log('Fetched Genially link:', link);
        } else {
          setGeniallyLink(null);
          console.log('No Genially link found for lesson');
        }
      } catch (error) {
        console.error('Error fetching Genially link:', error);
        setGeniallyLink(null);
      }
    };
    
    fetchGeniallyLink();
  }, [lessonState.currentLesson, gameId, lessons]);

  // 添加獲取課程 Markdown 內容的函數
  useEffect(() => {
    const fetchLessonMarkdown = async () => {
      setContentLoading(true); // 開始加載時設置為 true
      try {
        if (gameId) {
          const configuredContent = lessons.find(
            lesson => lesson.lesson_id === lessonState.currentLesson,
          )?.markdownContent;
          setLessonMarkdown(configuredContent || null);
          return;
        }
        // 從 Supabase 獲取當前課程的 Markdown 內容
        const markdown = await getLessonMarkdownContent(lessonState.currentLesson);
        if (markdown) {
          setLessonMarkdown(markdown);
          console.log('Fetched lesson markdown content');
        } else {
          setLessonMarkdown(null);
          console.log('No markdown content found for lesson');
        }
      } catch (error) {
        console.error('Error fetching lesson markdown content:', error);
        setLessonMarkdown(null);
      } finally {
        // 無論成功或失敗，都將加載狀態設為 false
        setTimeout(() => {
          setContentLoading(false);
        }, 300); // 短暫延遲確保 DOM 更新
      }
    };
    
    fetchLessonMarkdown();
  }, [lessonState.currentLesson, gameId, lessons]);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      content: getInitialMessage(),
      isUser: false,
      timestamp: new Date()
    }
  ]);

  const [chatInput, setChatInput] = useState('');
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  const tabsRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (tabsRef.current) {
      const activeValue = isFinalLesson(lessonState.currentLesson) ? 'game' : 'content';
      const tabsElement = tabsRef.current;
      const activeTab = tabsElement.querySelector(`[data-state="active"]`);
      if (!activeTab) {
        const targetTab = tabsElement.querySelector(`[data-value="${activeValue}"]`);
        if (targetTab instanceof HTMLElement) {
          targetTab.click();
        }
      }
    }
  }, [lessonState.currentLesson]);

  // 修改獲取當前課程的方式
  const currentLesson = lessons.find(lesson => lesson.lesson_id === lessonState.currentLesson);

  useEffect(() => {
    // Save initial welcome message to local state instead of Supabase
    const saveInitialMessage = () => {
      try {
        // Add welcome message to pending messages
        setPendingChatMessages([{
          content: getInitialMessage(gameDefinition?.title, lessons.length || 5),
          is_user: false,
          timestamp: new Date().toISOString(),
        }]);
      } catch (err) {
        console.error('Error saving initial message to local state:', err);
      }
    };
    
    saveInitialMessage();
  }, [lessonState.currentLesson, gameDefinition?.title, lessons.length]);

  const geminiReadyRef = useRef(false);
  useEffect(() => {
    // Initialize Gemini API with your API key
    const initializeAI = async () => {
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        console.error('Gemini API key is not set in environment variables');
        return;
      }

      try {
        await initializeGemini(apiKey);
        geminiReadyRef.current = true;
      } catch (error) {
        console.error('Failed to initialize Gemini API:', error);
        geminiReadyRef.current = false;
        // 可以在這裡添加錯誤提示 UI
      }
    };

    initializeAI();
  }, []);

  const handleAnswerSubmit = async () => {
    if (!exercisesData || exercisesData.length === 0) return;
    
    const userAnswer = lessonState.answer.trim().toLowerCase();
    const correctAnswer = exercisesData[0].answer.trim().toLowerCase();
    
    console.log('User answer:', userAnswer);
    console.log('Correct answer:', correctAnswer);
    
    // 增加答案提交次數，僅在當前會話中計算
    const newAttemptCount = answerAttempts + 1;
    setAnswerAttempts(newAttemptCount);
    
    // Set explanation if available and not in level 5
    if (!isFinalLesson(lessonState.currentLesson)) {
      const explanation = exercisesData[0].explanation || '';
      setCurrentExplanation(explanation);
    }
    
    // Update lesson state
    setLessonState({
      ...lessonState,
      hasSubmitted: true,
      isCorrect: userAnswer === correctAnswer,
    });
    
    // Record completion time and update progress (only if correct)
    if (userAnswer === correctAnswer) {
      const now = new Date();
      // 修改時區處理方式，確保儲存為 UTC 時間，讓 Supabase 能正確處理
      const utc8Time = new Date(now.toISOString());
      
      // Get the start time from localStorage
      const startTimeKey = storageKey(`lesson_${lessonState.currentLesson}_start_time`);
      const startTimeStr = localStorage.getItem(startTimeKey);
      
      // Save completion data
      const completionData = {
        lessonId: lessonState.currentLesson,
        completedAt: utc8Time.toISOString(),
      };
      
      // Add completion data to localStorage
      const completions = JSON.parse(localStorage.getItem(storageKey('completions')) || '[]');
      completions.push(completionData);
      localStorage.setItem(storageKey('completions'), JSON.stringify(completions));
      
      // Calculate time spent in seconds
      let timeSpentSeconds = 0;
      if (startTimeStr) {
        // 將帶有時區標記的時間轉換為 Date 物件
        const startTime = new Date(startTimeStr.replace('+08:00', 'Z'));
        timeSpentSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        
        // Format time for display (MM:SS)
        const minutes = Math.floor(timeSpentSeconds / 60);
        const seconds = timeSpentSeconds % 60;
        const formattedTime = `${minutes}分${seconds}秒`;
        
        // Save completion time for display
        localStorage.setItem(storageKey('completion_time'), formattedTime);
        
        // Save to Supabase
        const studentId = localStorage.getItem(storageKey('student_id')) || 'guest';
        const studentName = localStorage.getItem(storageKey('student_name')) || 'Guest User';
        
        // Get the lesson number for database compatibility
        const lessonNumber = getLessonNumber(lessonState.currentLesson);
        console.log('Mapped lesson ID to number:', lessonState.currentLesson, ' -> ', lessonNumber);
        
        if (!lessonNumber) {
          console.error('Could not map lesson ID to a lesson number');
          // Use a fallback numeric value
          const fallbackLessonNumber = 1;
          console.log('Using fallback lesson number:', fallbackLessonNumber);
          
          // Save learning record to Supabase with fallback number
          const learningRecordResult = await saveLearningRecord({
            student_id: studentId,
            student_name: studentName,
            lesson_id: lessonState.currentLesson, // 使用原始的 lesson_id 代替數字
            started_at: startTimeStr.replace('+08:00', 'Z'), // 轉換為 UTC 時間
            completed_at: utc8Time.toISOString(),
            time_spent_seconds: timeSpentSeconds,
            answer_attempts: newAttemptCount,
            game_id: gameId ?? null,
          });
          
          // 如果成功儲存學習記錄，則儲存暫存的聊天資料
          if (learningRecordResult && learningRecordResult.length > 0) {
            await savePendingChatData(learningRecordResult[0].id);
          }
          
          // For level 5 (final level), also save to leaderboard
          if (isFinalLesson(lessonState.currentLesson)) {
            try {
              // 確保 start_time 已設置
              if (!localStorage.getItem(storageKey('start_time'))) {
                // Check if lesson 1 start time exists and use that
                const lesson1StartTime = localStorage.getItem(storageKey(`lesson_${lessons[0]?.lesson_id}_start_time`));
                if (lesson1StartTime) {
                  localStorage.setItem(storageKey('start_time'), lesson1StartTime);
                  console.log('Setting global start_time from lesson 1:', lesson1StartTime);
                } else {
                  // Fallback to current time if no lesson 1 start time
                  const currentTime = new Date();
                  const newGlobalStartTime = new Date(currentTime.getTime() - (currentTime.getTimezoneOffset() * 60000))
                    .toISOString()
                    .replace('Z', '+08:00');
                  localStorage.setItem(storageKey('start_time'), newGlobalStartTime);
                  console.log('Setting default global start_time:', newGlobalStartTime);
                }
              }

              // 計算全部課程總時間
              const globalStartTimeStr = localStorage.getItem(storageKey('start_time'));
              let totalTimeSpentSeconds = timeSpentSeconds; // Default to current lesson time
              
              if (globalStartTimeStr) {
                const globalStartDate = new Date(globalStartTimeStr);
                totalTimeSpentSeconds = Math.floor((now.getTime() - globalStartDate.getTime()) / 1000);
                
                // Format total time for display
                const totalMinutes = Math.floor(totalTimeSpentSeconds / 60);
                const totalSeconds = totalTimeSpentSeconds % 60;
                const totalFormattedTime = `${totalMinutes}分${totalSeconds}秒`;
                
                console.log('Calculated total time:', totalFormattedTime, '(', totalTimeSpentSeconds, 'seconds)');
                
                // Save total completion time for display
                localStorage.setItem(storageKey('completion_time'), totalFormattedTime);
                
                // 使用固定的 50 顆星星，這是完成所有課程後的預期星星數
                const maxStars = gameDefinition?.settings.rewards?.claimCost ?? 50;
                
                console.log('Preparing leaderboard entry with TOTAL time:', {
                  student_id: studentId,
                  student_name: studentName,
                  completion_time_seconds: totalTimeSpentSeconds,
                  completion_time_string: totalFormattedTime,
                  completed_at: utc8Time.toISOString(),
                  stars_earned: maxStars,
                  game_id: gameId ?? null,
                });
                
                await saveLeaderboardEntry({
                  student_id: studentId,
                  student_name: studentName,
                  completion_time_seconds: totalTimeSpentSeconds,
                  completion_time_string: totalFormattedTime,
                  completed_at: utc8Time.toISOString(),
                  stars_earned: maxStars,
                  game_id: gameId ?? null,
                });
                
                console.log('Successfully saved to leaderboard');
              } else {
                console.error('Unable to calculate total time: missing global start time');
              }
            } catch (leaderboardError) {
              console.error('Failed to save leaderboard entry:', leaderboardError instanceof Error ? leaderboardError.message : JSON.stringify(leaderboardError));
            }
          }
          return;
        }
        
        // Log data being sent to help with debugging
        console.log('Saving learning record:', {
          student_id: studentId,
          student_name: studentName,
          lesson_id: lessonState.currentLesson, // 使用原始的 lesson_id 而不是數字
          started_at: startTimeStr.replace('+08:00', 'Z'), // 轉換為 UTC 時間
          completed_at: utc8Time.toISOString(),
          time_spent_seconds: timeSpentSeconds,
          answer_attempts: newAttemptCount,
          game_id: gameId ?? null,
        });
        
        // Save learning record to Supabase
        const learningRecordResult = await saveLearningRecord({
          student_id: studentId,
          student_name: studentName,
          lesson_id: lessonState.currentLesson, // 使用原始的 lesson_id 而不是數字
          started_at: startTimeStr.replace('+08:00', 'Z'), // 轉換為 UTC 時間
          completed_at: utc8Time.toISOString(),
          time_spent_seconds: timeSpentSeconds,
          answer_attempts: newAttemptCount,
          game_id: gameId ?? null,
        });
        
        // 如果成功儲存學習記錄，則儲存暫存的聊天資料
        if (learningRecordResult && learningRecordResult.length > 0) {
          await savePendingChatData(learningRecordResult[0].id);
        }

        // For level 5 (final level), also save to leaderboard
        if (isFinalLesson(lessonState.currentLesson)) {
          try {
            // 確保 start_time 已設置
            if (!localStorage.getItem(storageKey('start_time'))) {
              // Check if lesson 1 start time exists and use that
              const lesson1StartTime = localStorage.getItem(storageKey(`lesson_${lessons[0]?.lesson_id}_start_time`));
              if (lesson1StartTime) {
                localStorage.setItem(storageKey('start_time'), lesson1StartTime);
                console.log('Setting global start_time from lesson 1:', lesson1StartTime);
              } else {
                // Fallback to current time if no lesson 1 start time
                const currentTime = new Date();
                const newGlobalStartTime = new Date(currentTime.toISOString())
                  .toISOString();
                localStorage.setItem(storageKey('start_time'), newGlobalStartTime);
                console.log('Setting default global start_time:', newGlobalStartTime);
              }
            }

            // 計算全部課程總時間
            const globalStartTimeStr = localStorage.getItem(storageKey('start_time'));
            let totalTimeSpentSeconds = timeSpentSeconds; // Default to current lesson time
            
            if (globalStartTimeStr) {
              const globalStartDate = new Date(globalStartTimeStr);
              totalTimeSpentSeconds = Math.floor((now.getTime() - globalStartDate.getTime()) / 1000);
              
              // Format total time for display
              const totalMinutes = Math.floor(totalTimeSpentSeconds / 60);
              const totalSeconds = totalTimeSpentSeconds % 60;
              const totalFormattedTime = `${totalMinutes}分${totalSeconds}秒`;
              
              console.log('Calculated total time:', totalFormattedTime, '(', totalTimeSpentSeconds, 'seconds)');
              
              // Save total completion time for display
              localStorage.setItem(storageKey('completion_time'), totalFormattedTime);
              
              // 使用固定的 50 顆星星，這是完成所有課程後的預期星星數
              const maxStars = gameDefinition?.settings.rewards?.claimCost ?? 50;
              
              console.log('Preparing leaderboard entry with TOTAL time:', {
                student_id: studentId,
                student_name: studentName,
                completion_time_seconds: totalTimeSpentSeconds,
                completion_time_string: totalFormattedTime,
                completed_at: utc8Time.toISOString(),
                stars_earned: maxStars,
                game_id: gameId ?? null,
              });
     
              await saveLeaderboardEntry({
                student_id: studentId,
                student_name: studentName,
                completion_time_seconds: totalTimeSpentSeconds,
                completion_time_string: totalFormattedTime,
                completed_at: utc8Time.toISOString(),
                stars_earned: maxStars,
                game_id: gameId ?? null,
              });
              
              console.log('Successfully saved to leaderboard');
            } else {
              console.error('Unable to calculate total time: missing global start time');
            }
          } catch (leaderboardError) {
            console.error('Failed to save leaderboard entry:', leaderboardError instanceof Error ? leaderboardError.message : JSON.stringify(leaderboardError));
          }
        }
      }
      
      // Update lesson progress to add stars
      updateLessonProgress(
        lessonState.currentLesson,
        gameDefinition?.settings.rewards?.starsPerLesson ?? 10,
        gameDefinition?.settings.rewards?.xpPerLesson ?? 20,
        gameId,
        lessons[0]?.lesson_id,
      );
    }
  };

  const handleNextLesson = () => {
    const nextId = getNextLessonId(lessonState.currentLesson);
    if (nextId) {
      router.push(lessonHref(nextId));
    }
  };

  const handlePrevLesson = () => {
    const prevId = getPrevLessonId(lessonState.currentLesson);
    if (prevId) {
      router.push(lessonHref(prevId));
    }
  };

  // 前導課程完成處理（不給星星與經驗值）
  const handlePreludeComplete = () => {
    // 標記為完成但不增加星星/XP
    updateLessonProgress(lessonState.currentLesson, 0, 0, gameId, lessons[0]?.lesson_id);
    setLessonState(prev => ({
      ...prev,
      hasSubmitted: true,
      isCorrect: true,
      completedLessons: Array.from(new Set([...(prev.completedLessons || []), prev.currentLesson]))
    }));
    // 直接前往下一關
    handleNextLesson();
  };

  const handleAnswerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLessonState(prev => ({
      ...prev,
      answer: e.target.value,
      // Only reset hasSubmitted and isCorrect when the user changes the answer
      // after having submitted a wrong answer
      ...(prev.hasSubmitted && !prev.isCorrect ? {
        hasSubmitted: false,
        isCorrect: false
      } : {})
    }));
  };

  const toggleChat = () => {
    setLessonState(prev => ({
      ...prev,
      showChat: !prev.showChat
    }));
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  // 前導課程（編號 0）僅顯示內容；第 5 關顯示遊戲；其他顯示內容+挑戰
  const lessonNumber = getLessonNumber(lessonState.currentLesson);
  const showTabs = isFinalLesson(lessonState.currentLesson)
    ? ['game']
    : isIntroLesson(lessonState.currentLesson)
      ? ['content']
      : ['practice', 'content'];

  const chatEndRef = useRef<HTMLDivElement>(null);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // 檢查檔案類型
    if (!file.type.startsWith('image/')) {
      alert('請上傳圖片檔案');
      return;
    }
    
    // 檢查檔案大小 (限制為 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('圖片大小不能超過 5MB');
      return;
    }
    
    // 將檔案轉為 Data URL
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };
  
  const handleCancelImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSendMessage = async () => {
    const hasContent = chatInput.trim() || imagePreview;
    if (!hasContent) return;

    // 確保在送出訊息前，Gemini 已初始化（避免尚未完成初始化就呼叫）
    if (!geminiReadyRef.current) {
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (apiKey) {
        try {
          await initializeGemini(apiKey);
          geminiReadyRef.current = true;
        } catch (e) {
          console.error('Failed to lazily initialize Gemini before sending message:', e);
          setChatMessages(prev => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              content: '抱歉，AI 助教尚未啟用，請稍後再試或檢查 API 金鑰設定。',
              isUser: false,
              timestamp: new Date()
            }
          ]);
          return;
        }
      } else {
        setChatMessages(prev => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            content: '抱歉，尚未設定 Gemini API 金鑰（NEXT_PUBLIC_GEMINI_API_KEY）。',
            isUser: false,
            timestamp: new Date()
          }
        ]);
        return;
      }
    }
    
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      content: chatInput.trim(),
      isUser: true,
      timestamp: new Date(),
      imageUrl: imagePreview || undefined
    };
    
    setChatMessages(prev => [...prev, newMessage]);
    setChatInput('');
    
    // 重置輸入框高度為固定值
    const textarea = chatInputRef.current;
    if (textarea) {
      textarea.style.height = '4rem';
    }
    
    // 保存圖片URL，然後清空圖片預覽
    const currentImageUrl = imagePreview;
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    try {
      const studentId = localStorage.getItem(storageKey('student_id')) || 'anonymous';
      
      // 檢查用戶是否已完成此課程（答案正確且已提交）
      const hasCompletedLesson = lessonState.hasSubmitted && lessonState.isCorrect;
      let learningRecordId: string | null = null;
      
      // 如果已完成課程，則嘗試獲取現有的learning_record_id
      if (hasCompletedLesson) {
        learningRecordId = await getLearningRecordId(studentId, lessonState.currentLesson, gameId);
      }
      
      // 根據是否找到 learning_record_id 決定如何處理消息
      if (hasCompletedLesson && learningRecordId) {
        // 已完成課程且存在 learning_record_id，直接儲存到 Supabase
        await saveChatMessage({
          learning_record_id: learningRecordId,
          student_id: studentId,
          lesson_id: lessonState.currentLesson,
          message_content: newMessage.content,
          is_user: true,
          timestamp: new Date().toISOString(),
          game_id: gameId ?? null,
        });
        
        // 更新問題計數
        const questionCountRecord = await getOrCreateQuestionCount({
          learning_record_id: learningRecordId,
          student_id: studentId,
          lesson_id: lessonState.currentLesson,
          game_id: gameId ?? null,
        });
        
        if (questionCountRecord) {
          await incrementQuestionCount(questionCountRecord.id);
        }
      } else {
        // 未完成課程或沒有 learning_record_id，先暫存
        setPendingChatMessages(prev => [
          ...prev, 
          {
            content: newMessage.content,
            is_user: true,
            timestamp: new Date().toISOString(),
            imageUrl: currentImageUrl ? currentImageUrl : undefined
          }
        ]);
        
        // 增加暫存提問次數
        setPendingQuestionCount(prev => prev + 1);
      }
      
      // 立即添加一個空的機器人消息來顯示打字動畫
      const tempBotMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: '',
        isUser: false,
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, tempBotMessage]);
      
      // 確保滾動到底部
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      
      // 構建上下文訊息
      const contextMessages = chatMessages.slice(-4).map(msg => ({
        content: msg.content,
        isUser: msg.isUser
      }));
      
      // 增強課程上下文，加入完整課程內容和練習題信息
      let lessonContext = `當前課程：第 ${getLessonNumber(lessonState.currentLesson)} 關 - ${currentLesson?.title}
課程內容：${currentLesson?.description}`;

      // 添加完整課程內容（如果有）
      if (currentLesson?.content) {
        // 移除HTML標籤以獲取純文本內容
        const contentText = currentLesson.content.replace(/<[^>]*>?/gm, ' ').trim();
        lessonContext += `\n\n完整課程內容：${contentText}`;
      }

      // 添加練習題信息（如果有）
      if (exercisesData.length > 0) {
        const currentExercise = exercisesData[0];
        lessonContext += `\n\n當前練習題：${currentExercise.question}`;
        
        // 如果學生已提交答案，也提供正確答案和解釋
        if (lessonState.hasSubmitted) {
          lessonContext += `\n正確答案：${currentExercise.answer}`;
          lessonContext += `\n解釋：${currentExercise.explanation}`;
        }
      }

      const chatContext: ChatContext = {
        context: contextMessages,
        lessonInfo: lessonContext,
        gameTitle: gameDefinition?.title,
        tutorPrompt: gameDefinition?.settings.tutorPrompt,
      };
      
      // 使用更新後的 getChatResponse 函數，傳遞圖片
      const aiResponse = await getChatResponse(chatInput, chatContext, currentImageUrl || undefined);
      
      // 根據是否找到 learning_record_id 決定如何處理AI回應
      if (hasCompletedLesson && learningRecordId) {
        // 已完成課程且存在 learning_record_id，直接儲存到 Supabase
        await saveChatMessage({
          learning_record_id: learningRecordId,
          student_id: studentId,
          lesson_id: lessonState.currentLesson,
          message_content: aiResponse,
          is_user: false,
          timestamp: new Date().toISOString(),
          game_id: gameId ?? null,
        });
      } else {
        // 未完成課程或沒有 learning_record_id，先暫存
        setPendingChatMessages(prev => [
          ...prev, 
          {
            content: aiResponse,
            is_user: false,
            timestamp: new Date().toISOString()
          }
        ]);
      }
      
      // 更新機器人的實際回應
      setChatMessages(prev => [
        ...prev.slice(0, -1),
        {
          id: (Date.now() + 1).toString(),
          content: aiResponse,
          isUser: false,
          timestamp: new Date()
        }
      ]);
      
      // 確保在回應後再次滾動到底部
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      
    } catch (error) {
      console.error('Error getting AI response:', error);
      
      setChatMessages(prev => [
        ...prev.slice(0, -1),
        {
          id: (Date.now() + 1).toString(),
          content: '抱歉，我現在無法回應。請稍後再試。',
          isUser: false,
          timestamp: new Date()
        }
      ]);

      // 錯誤時也要滾動到底部
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  // 插入預設問題到輸入框
  const handleInsertPreset = (text: string) => {
    setChatInput(prev => (prev ? prev + '\n' + text : text));
    requestAnimationFrame(() => {
      if (chatInputRef.current) {
        chatInputRef.current.focus();
        chatInputRef.current.style.height = '4rem';
        chatInputRef.current.style.height = `${chatInputRef.current.scrollHeight}px`;
      }
    });
  };

  // 添加一個儲存暫存聊天記錄到 Supabase 的函數
  const savePendingChatData = async (learningRecordId: string) => {
    try {
      const studentId = localStorage.getItem(storageKey('student_id')) || 'anonymous';
      
      // 儲存所有暫存的聊天訊息
      for (const message of pendingChatMessages) {
        await saveChatMessage({
          learning_record_id: learningRecordId,
          student_id: studentId,
          lesson_id: lessonState.currentLesson,
          message_content: message.content,
          is_user: message.is_user,
          timestamp: message.timestamp,
          game_id: gameId ?? null,
        });
      }
      
      // 創建或更新問題計數記錄
      if (pendingQuestionCount > 0) {
        const questionCountRecord = await getOrCreateQuestionCount({
          learning_record_id: learningRecordId,
          student_id: studentId,
          lesson_id: lessonState.currentLesson,
          game_id: gameId ?? null,
        });
        
        if (questionCountRecord) {
          // 更新為累計的提問次數
          for (let i = 0; i < pendingQuestionCount; i++) {
            await incrementQuestionCount(questionCountRecord.id);
          }
        }
      }
      
      // 清空暫存資料
      setPendingChatMessages([]);
      setPendingQuestionCount(0);
      
      console.log('Successfully saved all pending chat data to Supabase');
    } catch (error) {
      console.error('Error saving pending chat data:', error);
    }
  };

  const handleContinue = () => {
    if (isFinalLesson(lessonState.currentLesson)) {
      // 第五關顯示獎勵兌換視窗
      setShowRewardDialog(true);
    } else {
      // 前四關直接進入下一關
      handleNextLesson();
    }
  };

  const handleRewardClaim = () => {
    const claimCost = gameDefinition?.settings.rewards?.claimCost ?? 50;
    if (lessonState.stars >= claimCost) {
      const updatedProgress = updateLessonProgress(
        lessonState.currentLesson,
        -claimCost,
        0,
        gameId,
        lessons[0]?.lesson_id,
      );
      
      setLessonState(prev => ({
        ...prev,
        stars: updatedProgress.stars
      }));
      
      setShowRewardDialog(false);
      // 導向到問卷連結
      const completionUrl = gameDefinition?.settings.rewards?.completionUrl;
      if (completionUrl) window.location.href = completionUrl;
    }
  };

  // Update renderQuestion function to properly display only the answer input field
  const renderQuestion = () => {
    if (exercisesData.length === 0) return null;
    
    return (
      <div className="bg-gray-50 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#58CC02] flex items-center justify-center flex-shrink-0">
            <MessageCircle className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-3">您的答案</h3>
            <div className="space-y-4">
              <input
                type="text"
                value={lessonState.answer}
                onChange={handleAnswerChange}
                className="w-full p-4 border border-gray-200 rounded-xl text-lg focus:outline-none focus:ring-2 focus:ring-[#2B4EFF] focus:border-transparent"
                placeholder="輸入您的答案..."
                disabled={lessonState.hasSubmitted && lessonState.isCorrect}
              />
              {lessonState.hasSubmitted && (
                <div className={`p-4 rounded-xl ${
                  lessonState.isCorrect 
                    ? 'bg-[#E5FFE1] text-[#58CC02]' 
                    : 'bg-[#FFE5E5] text-[#FF4B4B]'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {lessonState.isCorrect ? (
                      <>
                        <Star className="h-5 w-5 fill-current" />
                        <span className="font-medium">太棒了！答案正確！獲得 10 星星！</span>
                      </>
                    ) : (
                      <>
                        <X className="h-5 w-5" />
                        <span className="font-medium">答案不正確，請重試。</span>
                      </>
                    )}
                  </div>
                  {currentExplanation && (
                    <div className="mt-3 p-3 bg-white rounded-lg text-gray-700">
                      <h4 className="font-medium mb-1">解釋說明：</h4>
                      <div className="prose prose-sm max-w-none">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({children}) => <p className="mb-2 last:mb-0">{children}</p>,
                            li: ({children}) => <li className="mb-1">{children}</li>,
                            code: ({ children, className, node, ...rest }) => {
                              const match = /language-(\w+)/.exec(className || '')
                              return match 
                                ? <pre className="p-4 bg-gray-100 rounded overflow-x-auto"><code className={className}>{children}</code></pre>
                                : <code className="px-1 py-0.5 bg-gray-100 rounded text-blue-600">{children}</code>
                            }
                          }}
                        >
                          {formatExplanation(currentExplanation)}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <Button 
                onClick={lessonState.isCorrect ? handleContinue : handleAnswerSubmit}
                className={`w-full py-4 text-lg font-semibold rounded-xl transition-transform hover:scale-105 ${
                  lessonState.hasSubmitted && lessonState.isCorrect
                    ? 'bg-[#58CC02] hover:bg-[#46a001]'
                    : 'bg-[#2B4EFF] hover:bg-blue-700'
                } text-white`}
                disabled={!lessonState.isCorrect && !lessonState.answer.trim()}
              >
                {lessonState.hasSubmitted && lessonState.isCorrect ? '繼續' : '檢查答案'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Update the final question rendering for consistency
  const renderFinalQuestion = () => {
    if (!exercisesData || exercisesData.length === 0) return null;
    
    return (
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="flex items-start">
          <div className="flex-1">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#2B4EFF] flex items-center justify-center flex-shrink-0 mr-3">
                <KeyRound className="h-5 w-5 text-white" />
              </div>
              <h3 className="font-semibold text-lg">終極密碼</h3>
            </div>
            
            {lessonState.hasSubmitted && lessonState.isCorrect && (
              <div className="p-4 rounded-lg mb-4 bg-[#E5FFE1] border border-[#C8F0C3]">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-[#58CC02] mr-2" />
                  <p className="font-medium text-[#58CC02]">
                    答案正確！
                  </p>
                </div>
              </div>
            )}
            
            {lessonState.hasSubmitted && !lessonState.isCorrect && (
              <div className="p-4 rounded-lg mb-4 bg-[#FFE5E5] border border-[#F0C3C3]">
                <div className="flex items-center">
                  <XCircle className="h-5 w-5 text-[#FF4B4B] mr-2" />
                  <p className="font-medium text-[#FF4B4B]">
                    答案不正確，請重試。
                  </p>
                </div>
              </div>
            )}
            
            <div className="space-y-4">
              <div className="flex flex-col">
                <label htmlFor="answer" className="font-medium text-gray-700 mb-2">
                  輸入你的答案：
                </label>
                <div className="relative">
                  <input
                    id="answer"
                    type="text"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="在此輸入答案..."
                    value={lessonState.answer}
                    onChange={handleAnswerChange}
                    disabled={lessonState.hasSubmitted && lessonState.isCorrect}
                  />
                </div>
              </div>
              {!lessonState.hasSubmitted || !lessonState.isCorrect ? (
                <button
                  className="w-full px-4 py-3 bg-[#2B4EFF] text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  onClick={handleAnswerSubmit}
                  disabled={!lessonState.answer.trim()}
                >
                  提交答案
                </button>
              ) : (
                lessonState.isCorrect && (
                  <button
                    className="w-full px-4 py-3 bg-[#58CC02] text-white font-medium rounded-lg hover:bg-[#46a001] transition-colors"
                    onClick={handleContinue}
                  >
                    完成課程
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 添加 geniallyLink 狀態來存儲連結
  const [geniallyLink, setGeniallyLink] = useState<string | null>(null);

  // 在組件渲染前確保 Markdown 內容已準備好
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // 增加內容加載狀態
  const [contentLoading, setContentLoading] = useState(true);

  // 預設提問模板
  const presetQuestions: string[] = [
    '我不確定應該用哪個函數來解這題，能一步一步引導我嗎？',
    '請用生活化的例子解釋一下 VLOOKUP 的用途與限制。',
    '我寫了這個公式但結果怪怪的，可以幫我檢查嗎：=VLOOKUP( , , , )',
    '如果我要同時根據兩個條件做查找，應該怎麼做？',
    '能給我 3 個練習題，從簡單到中等，再附上解答嗎？',
    '請把剛剛的重點整理成 5 行筆記，便於我複習。'
  ];
  const starsPerLesson = gameDefinition?.settings.rewards?.starsPerLesson ?? 10;
  const xpPerLesson = gameDefinition?.settings.rewards?.xpPerLesson ?? 20;
  const rewardClaimCost = gameDefinition?.settings.rewards?.claimCost ?? 50;

  if (gameLoadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-gray-900 mb-2">無法載入關卡</h1>
          <p className="text-gray-600">{gameLoadError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="container mx-auto h-16 md:h-20 flex items-center justify-between px-4 md:px-6">
          <Link href={gameId ? `/games/${gameId}` : "/"} className="flex items-center py-2 hover:opacity-80 transition-opacity">
            <div className="flex items-center">
              <span className="text-xl md:text-3xl font-bold bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent">
                {gameDefinition?.settings.theme?.brandLabel ?? gameDefinition?.title ?? 'excel master'}
              </span>
              <div className="w-5 h-5 md:w-6 md:h-6 relative mx-0.5">
                <FileSpreadsheet className="w-5 h-5 md:w-6 md:h-6 text-cyan-500" />
                <div className="absolute -top-1 -right-1 w-1.5 h-1.5 md:w-2 md:h-2 bg-blue-500 rounded-full" />
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-2 md:gap-6">
            <div className="hidden sm:flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 bg-[#F5F7FF] rounded-xl">
              <div className="flex items-center gap-1 md:gap-2">
                <Trophy className="h-4 w-4 md:h-5 md:w-5 text-[#2B4EFF]" />
                <span className="font-semibold text-gray-900 text-sm md:text-base">Level {lessonState.level}</span>
              </div>
              <div className="h-4 md:h-5 w-px bg-gray-200" />
              <div className="flex flex-col w-28 md:w-36">
                <div className="flex justify-between items-center text-xs md:text-sm text-gray-600 mb-1">
                  <span>經驗值</span>
                  <span>{lessonState.exp % 100}/100 XP</span>
                </div>
                <div className="relative h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="absolute top-0 left-0 h-full bg-[#2B4EFF] transition-all duration-300"
                    style={{ width: `${lessonState.exp % 100}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 md:gap-3">
              <div className="flex items-center gap-1 md:gap-2 px-2 md:px-4 py-1.5 md:py-2 bg-[#FFF5E5] rounded-xl">
                <Star className="h-4 w-4 md:h-5 md:w-5 text-[#FF9900] fill-[#FF9900]" />
                <span className="font-semibold text-[#B36B00] text-xs md:text-base">{lessonState.stars}</span>
              </div>
              <div className="flex items-center gap-1 md:gap-2 px-2 md:px-4 py-1.5 md:py-2 bg-[#FFE5E5] rounded-xl">
                <Flame className="h-4 w-4 md:h-5 md:w-5 text-[#FF4B4B]" />
                <span className="font-semibold text-[#CC0000] text-xs md:text-base">{lessonState.streak} 天</              span>
              </div>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-3 px-2 md:px-4">
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-1 md:gap-2 text-xs md:text-sm mb-1">
                <span className="text-gray-500">課程進度</span>
                <span className="font-medium">{lessonState.completedLessons.length}/{lessons.length}</span>
              </div>
              <div className="w-24 md:w-32 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#58CC02] transition-all duration-300"
                  style={{ width: `${lessons.length ? (lessonState.completedLessons.length / lessons.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 md:py-8 flex flex-col md:flex-row gap-4 md:gap-6">
        <main className={`transition-all duration-300 ${lessonState.showChat ? (isExpanded ? 'w-0 md:w-0' : 'w-full md:w-[calc(100%-24rem)]') : 'w-full'}`}>
          <div className="mb-6 md:mb-8">
            <div className="flex items-center gap-4 mb-4">
              <Link 
                href={gameId ? `/games/${gameId}` : "/"}
                className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors"
              >
                <ChevronLeft className="h-4 w-4 md:h-5 md:w-5" />
                <span className="text-sm md:text-base">返回首頁</span>
              </Link>
              <div className="h-4 w-px bg-gray-200" />
              <Badge variant="outline" className="bg-blue-600 text-white border-0 text-sm md:text-base">
                {isIntroLesson(lessonState.currentLesson) ? '前導課程' : `第 ${lessonNumber} 關`}
              </Badge>
            </div>
            <h1 className="text-xl md:text-2xl font-bold mb-2">{currentLesson?.title}</h1>
            <p className="text-sm md:text-base text-gray-600">{currentLesson?.description}</p>
          </div>

          <Tabs ref={tabsRef} defaultValue={isFinalLesson(lessonState.currentLesson) ? 'game' : 'content'} className="mb-6 md:mb-8">
            {!isIntroLesson(lessonState.currentLesson) && (
            <TabsList className="grid w-full gap-2 border-b border-gray-100 mb-2" style={{ gridTemplateColumns: `repeat(${showTabs.length}, 1fr)` }}>
              {showTabs.includes('content') && (
                <TabsTrigger
                  value="content"
                  className={`
                    flex items-center justify-center gap-2 px-6 py-2 rounded-full border-2 border-[#58CC02] font-bold text-base
                    text-[#58CC02] bg-white
                    transition-all duration-200
                    shadow-sm
                    data-[state=active]:bg-[#58CC02] data-[state=active]:text-white data-[state=active]:shadow-lg
                    hover:bg-[#E6F9E6] hover:text-[#58CC02] cursor-pointer
                    focus:outline-none
                  `}
                >
                  課程內容
                </TabsTrigger>
              )}
              {showTabs.includes('practice') && (
                <TabsTrigger
                  value="practice"
                  className={`
                    flex items-center justify-center gap-2 px-6 py-2 rounded-full border-2 border-[#58CC02] font-bold text-base
                    text-[#58CC02] bg-white
                    transition-all duration-200
                    shadow-sm
                    data-[state=active]:bg-[#58CC02] data-[state=active]:text-white data-[state=active]:shadow-lg
                    hover:bg-[#E6F9E6] hover:text-[#58CC02] cursor-pointer
                    focus:outline-none
                  `}
                >
                  <Zap className="w-5 h-5" />
                  挑戰題
                </TabsTrigger>
              )}
              {showTabs.includes('game') && (
                <TabsTrigger
                  value="game"
                  className={`
                    flex items-center justify-center gap-2 px-6 py-2 rounded-full border-2 border-[#58CC02] font-bold text-base
                    text-[#58CC02] bg-white
                    transition-all duration-200
                    shadow-sm
                    data-[state=active]:bg-[#58CC02] data-[state=active]:text-white data-[state=active]:shadow-lg
                    hover:bg-[#E6F9E6] hover:text-[#58CC02] cursor-pointer
                    focus:outline-none
                  `}
                >
                  <FileSpreadsheet className="w-5 h-5" />
                  遊戲關卡
                </TabsTrigger>
              )}
            </TabsList>
            )}
            
            {showTabs.includes('content') && (
              <TabsContent value="content">
                <Card className="bg-white rounded-2xl shadow-sm border border-gray-100">
                  <div className="bg-gray-900 text-white p-4 rounded-t-2xl">
                    <h2 className="text-lg md:text-xl font-semibold">課程內容</h2>
                  </div>
                  <div className="p-6">
                    {contentLoading ? (
                      // 顯示加載骨架屏，完全替代內容直到加載完成
                      <div className="animate-pulse space-y-4">
                        <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                        <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                        <div className="space-y-2">
                          <div className="h-4 bg-gray-200 rounded w-4/5"></div>
                          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                        </div>
                        <div className="h-32 bg-gray-200 rounded"></div>
                      </div>
                    ) : (
                      <div className="prose max-w-none">
                        {lessonMarkdown ? (
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            components={{
                              h1: ({children}: any) => <h1 className="text-3xl font-bold mb-6 text-blue-600">{children}</h1>,
                              h2: ({children}: any) => <h2 className="text-2xl font-semibold mb-4 mt-8 text-blue-600">{children}</h2>,
                              h3: ({children}: any) => <h3 className="text-xl font-semibold mb-3 mt-6">{children}</h3>,
                              h4: ({children}: any) => <h4 className="text-lg font-medium mb-2 mt-4">{children}</h4>,
                              table: ({ children }: any) => (
                                <div className="overflow-x-auto my-4">
                                  <table className="min-w-full border-collapse border border-gray-300">
                                    {children}
                                  </table>
                                </div>
                              ),
                              th: ({ children }: any) => (
                                <th className="border border-gray-300 bg-gray-100 px-4 py-2 text-left">
                                  {children}
                                </th>
                              ),
                              td: ({ children }: any) => (
                                <td className="border border-gray-300 px-4 py-2">
                                  {children}
                                </td>
                              ),
                              p: ({ children }: any) => (
                                <p className="mb-4 last:mb-0 whitespace-pre-wrap">
                                  {children}
                                </p>
                              ),
                              ul: ({children}: any) => <ul className="list-disc pl-6 mb-4">{children}</ul>,
                              ol: ({children}: any) => <ol className="list-decimal pl-6 mb-4">{children}</ol>,
                              li: ({children}: any) => <li className="mb-1">{children}</li>,
                              blockquote: ({children}: any) => {
                                // 檢查內容是否包含特殊提示標記
                                const childrenArray = React.Children.toArray(children);
                                const firstChild = childrenArray[0];
                                
                                // 類型斷言和類型守衛
                                const isReactElement = (obj: unknown): obj is React.ReactElement => {
                                  return obj !== null && typeof obj === 'object' && 'props' in obj;
                                };

                                // 檢查是否為警告提示
                                if (isReactElement(firstChild) && 
                                    (firstChild.props as any)?.children) {
                                  // 將子元素轉換為字符串，但先確保它是可以toString()的類型
                                  const childContent = String((firstChild.props as any).children);
                                  if (childContent.includes('⚠️ **Warning:**')) {
                                    return (
                                      <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-4 rounded-r">
                                        <div className="flex">
                                          <div className="flex-shrink-0 text-amber-500">⚠️</div>
                                          <div className="ml-3 text-amber-700">{children as React.ReactNode}</div>
                                        </div>
                                      </div>
                                    );
                                  }
                                }
                                
                                // 檢查是否為提示
                                if (isReactElement(firstChild) && 
                                    (firstChild.props as any)?.children) {
                                  // 將子元素轉換為字符串，但先確保它是可以toString()的類型
                                  const childContent = String((firstChild.props as any).children);
                                  if (childContent.includes('💡 **Tip:**')) {
                                    return (
                                      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4 rounded-r">
                                        <div className="flex">
                                          <div className="flex-shrink-0 text-blue-500">💡</div>
                                          <div className="ml-3 text-blue-700">{children as React.ReactNode}</div>
                                        </div>
                                      </div>
                                    );
                                  }
                                }
                                
                                // 檢查是否為注意事項
                                if (isReactElement(firstChild) && 
                                    (firstChild.props as any)?.children) {
                                  // 將子元素轉換為字符串，但先確保它是可以toString()的類型
                                  const childContent = String((firstChild.props as any).children);
                                  if (childContent.includes('**Note:**')) {
                                    return (
                                      <div className="bg-gray-50 border-l-4 border-gray-500 p-4 mb-4 rounded-r">
                                        <div className="flex">
                                          <div className="ml-3 text-gray-700">{children as React.ReactNode}</div>
                                        </div>
                                      </div>
                                    );
                                  }
                                }
                                
                                // 默認引用塊樣式
                                return (
                                  <blockquote className="border-l-4 border-gray-300 pl-4 py-1 mb-4 italic text-gray-700">
                                    {children as React.ReactNode}
                                  </blockquote>
                                );
                              },
                            code: ({ children, className }) => {
                              const match = /language-(\w+)/.exec(className || '')
                              if (match) {
                                return (
                                  <div className="my-6 border-l-4 border-blue-500">
                                    <pre className="pl-4 py-4 bg-blue-50 overflow-x-auto text-gray-800 font-mono text-sm">
                                      <code className={className}>{children}</code>
                                    </pre>
                                  </div>
                                )
                              }
                              return <code className="px-1.5 py-0.5 bg-blue-50 rounded text-blue-600 font-mono text-sm">{children}</code>
                            }
                            }}
                          >
                            {lessonMarkdown}
                          </ReactMarkdown>
                        ) : isClient && currentLesson?.content ? (
                          <div dangerouslySetInnerHTML={{ __html: currentLesson.content }} />
                        ) : (
                          <p>課程內容加載失敗，請刷新頁面重試。</p>
                        )}
                      </div>
                    )}
                    
                    <div className="mt-8 border-t pt-8">
                      <h3 className="text-xl font-semibold mb-4">互動教學</h3>
                      {geniallyLink ? (
                        <div style={{width: '100%', margin: '0 auto', maxWidth: '1200px'}}>
                          <div style={{position: 'relative', paddingBottom: '56.25%', paddingTop: 0, height: 0}}>
                            <iframe 
                              title={currentLesson?.title ?? 'Interactive learning game'}
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                border: 'none'
                              }}
                              src={geniallyLink}
                              allowFullScreen={true}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-500">
                          互動教學內容正在加載中...
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </TabsContent>
            )}
            
            {showTabs.includes('practice') && (
              <TabsContent value="practice">
                <Card className="bg-white rounded-2xl shadow-sm border border-gray-100">
                  <div className="bg-gray-900 text-white p-4 rounded-t-2xl">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg md:text-xl font-semibold">挑戰題</h2>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 text-sm">
                          <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                          <span>+{starsPerLesson}</span>
                        </div>
                        <div className="flex items-center gap-1 text-sm">
                          <Trophy className="h-4 w-4 text-blue-400" />
                          <span>+{xpPerLesson} XP</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-6">
                    {/* 進度指示器 */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-500">練習進度</span>
                        <span className="text-sm font-medium">{lessonState.hasSubmitted ? "1/1" : "0/1"}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full">
                        <div 
                          className="h-full bg-[#58CC02] rounded-full transition-all duration-300" 
                          style={{ width: lessonState.hasSubmitted ? '100%' : '0%' }} 
                        />
                      </div>
                    </div>

                    {/* 練習題目區塊 */}
                    <div className="bg-gray-50 rounded-xl p-6 mb-6">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-[#2B4EFF] flex items-center justify-center flex-shrink-0">
                          <FileSpreadsheet className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg mb-3">練習題目</h3>
                          {exercisesData.length > 0 ? (
                            <div className="prose prose-sm max-w-none">
                              <ReactMarkdown 
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  table: ({ children }) => (
                                    <div className="overflow-x-auto my-4">
                                      <table className="min-w-full border-collapse border border-gray-300">
                                        {children}
                                      </table>
                                    </div>
                                  ),
                                  th: ({ children }) => (
                                    <th className="border border-gray-300 bg-gray-100 px-4 py-2 text-left">
                                      {children}
                                    </th>
                                  ),
                                  td: ({ children }) => (
                                    <td className="border border-gray-300 px-4 py-2 bg-white">
                                      {children}
                                    </td>
                                  ),
                                  p: ({ children }) => (
                                    <p className="mb-4 last:mb-0 whitespace-pre-wrap">
                                      {children}
                                    </p>
                                  )
                                }}
                              >
                                {formatExerciseContent(exercisesData[0].question)}
                              </ReactMarkdown>
                            </div>
                          ) : (
                            <p className="text-gray-700 mb-4">請完成遊戲後，輸入最終答案。</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 答案輸入區塊 */}
                    {renderQuestion()}
                  </div>
                </Card>
              </TabsContent>
            )}
            
            <TabsContent 
              value="game" 
              forceMount
              className={isFinalLesson(lessonState.currentLesson) ? 'block' : 'hidden'}
            >
              <Card className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="bg-gray-900 text-white p-4 rounded-t-2xl">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg md:text-xl font-semibold">遊戲關卡</h2>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-sm">
                        <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                        <span>+{starsPerLesson}</span>
                      </div>
                      <div className="flex items-center gap-1 text-sm">
                        <Trophy className="h-4 w-4 text-blue-400" />
                        <span>+{xpPerLesson} XP</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  {/* 進度指示器 */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-500">練習進度</span>
                      <span className="text-sm font-medium">{lessonState.hasSubmitted ? "1/1" : "0/1"}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full">
                      <div 
                        className="h-full bg-[#58CC02] rounded-full transition-all duration-300" 
                        style={{ width: lessonState.hasSubmitted ? '100%' : '0%' }} 
                      />
                    </div>
                  </div>

                  {/* 遊戲說明區塊 */}
                  <div className="space-y-6">
                    <div className="bg-gray-50 rounded-xl p-6">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-[#2B4EFF] flex items-center justify-center flex-shrink-0">
                          <FileSpreadsheet className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg mb-3">{currentLesson?.title ?? '綜合測驗說明'}</h3>
                          <p className="text-gray-700 mb-4">{currentLesson?.description}</p>
                          <p className="text-blue-600 font-semibold">完成遊戲後，輸入最終答案即可完成這個關卡。</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 遊戲區塊 */}
                  <div className="bg-gray-50 rounded-xl p-6">
                    <div style={{width: '100%', margin: '0 auto', maxWidth: '1200px'}}>
                      <div style={{position: 'relative', paddingBottom: '56.25%', paddingTop: 0, height: 0}}>
                        {geniallyLink ? (
                          <iframe 
                            title={currentLesson?.title ?? 'Interactive learning game'}
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: '100%',
                              border: 'none'
                            }}
                            src={geniallyLink}
                            allowFullScreen={true}
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
                            <p className="text-gray-500">遊戲內容正在加載中...</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 答案輸入區塊 */}
                  {renderFinalQuestion()}
                </div>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-between items-center">
            <div>
              {isIntroLesson(lessonState.currentLesson) ? null : (
                getPrevLessonId(lessonState.currentLesson) ? (
                  <Button 
                    variant="outline" 
                    className="flex items-center gap-2 text-sm md:text-base"
                    onClick={handlePrevLesson}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    上一關
                  </Button>
                ) : (
                  <Button 
                    variant="outline" 
                    className="flex items-center gap-2 text-sm md:text-base"
                    onClick={handlePrevLesson}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    上一關
                  </Button>
                )
              )}
            </div>
            <div className="flex-1">
              {isIntroLesson(lessonState.currentLesson) ? (
                <Button 
                  className="w-full py-4 md:py-5 text-base md:text-lg font-semibold rounded-xl shadow-md bg-[#58CC02] hover:bg-[#46a001] text-white flex items-center justify-center gap-2"
                  onClick={handlePreludeComplete}
                  aria-label="完成課程，前往下一關"
                >
                  完成課程
                  <ChevronRight className="h-5 w-5" />
                </Button>
              ) : (
                !isFinalLesson(lessonState.currentLesson) && (
                  <Button 
                    className={`flex items-center gap-2 ml-auto text-sm md:text-base ${
                      lessonState.completedLessons.includes(lessonState.currentLesson)
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-blue-300 text-white cursor-not-allowed'
                    }`}
                    onClick={handleNextLesson}
                    disabled={!lessonState.completedLessons.includes(lessonState.currentLesson)}
                  >
                    下一關
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )
              )}
            </div>
          </div>
        </main>

        {/* AI 助教側邊面板 */}
        <div 
          className={`
            fixed inset-0 md:inset-auto md:top-[4rem] md:right-0 md:h-[calc(100vh-4rem)] 
            bg-white border-l z-50 transition-all duration-300
            ${lessonState.showChat 
              ? 'translate-x-0 ' + (isExpanded ? 'w-full md:w-full' : 'w-full md:w-[480px]')
              : 'translate-x-full w-full md:w-0'
            }
          `}
        >
          <div className="h-full flex flex-col">
            <div className="p-4 border-b bg-[#F8F9FB] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center overflow-hidden border-2 border-gray-200">
                  <RobotAvatar className="w-full h-full" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900 text-lg">Ellis</h2>
                  <p className="text-sm text-gray-500">隨時為您解答問題</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={toggleExpand}
                  className="hover:bg-gray-100 rounded-lg"
                >
                  {isExpanded ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 3h6v6M14 10l6.1-6.1M9 21H3v-6M10 14l-6.1 6.1"/>
                    </svg>
                  )}
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={toggleChat}
                  className="hover:bg-gray-100 rounded-lg"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 px-6 py-4">
              <div className="space-y-6 max-w-3xl mx-auto">
                {chatMessages.map((message) => (
                  <ChatMessage
                    key={message.id}
                    message={message.content}
                    isUser={message.isUser}
                    imageUrl={message.imageUrl}
                  />
                ))}
                <div ref={chatEndRef} />
              </div>
            </ScrollArea>

            <div className="p-6 border-t bg-white">
              {/* 圖片預覽區域 */}
              {imagePreview && (
                  <div className="max-w-3xl mx-auto mb-4 relative">
                    <div className="border rounded-xl p-2 overflow-hidden">
                      <Image 
                        src={imagePreview} 
                        alt="Preview" 
                        width={400}
                        height={200}
                        className="max-h-48 rounded mx-auto object-contain"
                      />
                    <button 
                      onClick={handleCancelImage}
                      className="absolute top-2 right-2 bg-gray-800 bg-opacity-50 text-white rounded-full p-1 hover:bg-opacity-70"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
              
              {/* 預設提問模板 */}
              <div className="max-w-3xl mx-auto mb-3">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {presetQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleInsertPreset(q)}
                      className="whitespace-nowrap px-3 py-1.5 text-xs md:text-sm border rounded-full bg-gray-50 hover:bg-gray-100 text-gray-700"
                      title={q}
                    >
                      {q.length > 18 ? q.slice(0, 18) + '…' : q}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 max-w-3xl mx-auto">
                {/* 圖片上傳按鈕 */}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  ref={fileInputRef}
                  className="hidden"
                  id="image-upload"
                />
                <label 
                  htmlFor="image-upload"
                  className="p-2.5 border rounded-xl cursor-pointer hover:bg-gray-50"
                >
                  <ImageIcon className="h-5 w-5 text-gray-500" />
                </label>
                
                {/* 文字輸入框 */}
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  ref={chatInputRef}
                  onInput={(e) => {
                    e.currentTarget.style.height = '4rem';
                    e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      handleSendMessage();
                      e.preventDefault();
                    }
                  }}
                  onPaste={(e) => {
                    const items = e.clipboardData?.items;
                    if (items) {
                      for (let i = 0; i < items.length; i++) {
                        if (items[i].type.indexOf('image') !== -1) {
                          const blob = items[i].getAsFile();
                          if (blob) {
                            // 檢查檔案大小
                            if (blob.size > 5 * 1024 * 1024) {
                              alert('圖片大小不能超過 5MB');
                              return;
                            }
                            
                            // 將檔案轉為 Data URL
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setImagePreview(reader.result as string);
                            };
                            reader.readAsDataURL(blob);
                            
                            // 防止將圖片內容粘貼為文本
                            e.preventDefault();
                            break;
                          }
                        }
                      }
                    }
                  }}
                  placeholder="輸入您的問題..."
                  className="flex-1 px-4 py-3 border rounded-xl text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-[#2B4EFF] focus:border-transparent resize-none h-16"
                />
                
                {/* 發送按鈕 */}
                <Button 
                  onClick={handleSendMessage}
                  className="bg-[#2B4EFF] hover:bg-blue-700 text-white rounded-xl px-6 text-sm md:text-base"
                >
                  發送
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* AI 助教切換按鈕 */}
        {!lessonState.showChat && (
          <div className="fixed right-4 bottom-4 z-50">
            <Button
              onClick={toggleChat}
              className="
                bg-white hover:bg-gray-50 text-white 
                rounded-full w-16 h-16 md:w-20 md:h-20 shadow-lg 
                flex items-center justify-center overflow-hidden border-2 border-gray-200
                transition-opacity duration-300
              "
            >
              <RobotAvatar className="w-full h-full scale-110" />
            </Button>
            <span className="absolute -top-1 -right-1 w-6 h-6 md:w-7 md:h-7 bg-[#FF4B4B] rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg border-2 border-white">
              1
            </span>
          </div>
        )}
      </div>

      {/* 獎勵兌換視窗 */}
      <Dialog open={showRewardDialog} onOpenChange={setShowRewardDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Gift className="h-6 w-6 text-[#FF9900]" />
              兌換獎勵
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-4 text-base text-muted-foreground">
                <div>恭喜完成所有課程！</div>
                {completionTime && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[#2B4EFF] font-semibold">
                        完成時間：{completionTime}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#F5F7FF] rounded-lg">
                        <Trophy className="h-4 w-4 text-[#2B4EFF]" />
                        <span className="text-sm font-medium text-[#2B4EFF]">
                          第 {playerRank || '...'} 名
                        </span>
                      </span>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-xl space-y-3">
                      <h3 className="font-semibold text-gray-900">完成時間排行榜</h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                          <div className="text-sm text-gray-500">參與人數</div>
                          <div className="font-bold text-[#2B4EFF]">{leaderboardStats.total_participants}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm text-gray-500">最快紀錄</div>
                          <div className="font-bold text-[#58CC02]">{leaderboardStats.fastest_time}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm text-gray-500">平均時間</div>
                          <div className="font-bold text-[#FF9900]">{leaderboardStats.average_time}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div>您可以使用 {rewardClaimCost} 顆星星兌換特別獎勵。</div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="p-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-[#FFF5E5] rounded-xl">
                <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-[#FF9900] fill-[#FF9900]" />
                  <span className="font-semibold">所需星星</span>
                </div>
                <span className="text-lg font-bold text-[#FF9900]">{rewardClaimCost}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-[#FF9900] fill-[#FF9900]" />
                  <span className="font-semibold">您的星星</span>
                </div>
                <span className="text-lg font-bold text-[#FF9900]">{lessonState.stars}</span>
              </div>
              <Button
                onClick={handleRewardClaim}
                disabled={lessonState.stars < rewardClaimCost}
                className={`w-full py-4 text-lg font-semibold rounded-xl transition-transform hover:scale-105 
                  ${lessonState.stars >= rewardClaimCost
                    ? 'bg-[#FF9900] hover:bg-[#E68A00]' 
                    : 'bg-gray-300'
                  } text-white`}
              >
                {lessonState.stars >= rewardClaimCost ? '兌換獎勵' : '星星不足'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
