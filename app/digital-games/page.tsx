"use client";

import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  PlusCircle,
  Gamepad2,
  ExternalLink,
  Pencil,
  Trash2,
  Clock,
  Book,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useLanguage } from "@/app/contexts/LanguageContext";
import { useTranslation } from "@/utils/translations";
import { LessonOrderManager } from "@/components/LessonOrderManager";
import { getLessonNumber } from "@/lib/utils";
import {
  createMappingFromOrder,
  updateLessonOrderMapping,
  getLessonOrderMapping,
} from "@/lib/lessonOrderUtils";

interface Lesson {
  id: string;
  title: string;
  description: string;
  duration: number;
  level: string;
}

interface DigitalGame {
  id: string;
  title: string;
  description: string;
  url: string;
  thumbnail_url?: string;
  lesson_ids?: string[];
  created_at: string;
  user_id: string;
}

export default function DigitalGamesPage() {
  const [digitalGames, setDigitalGames] = useState<DigitalGame[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingGame, setEditingGame] = useState<DigitalGame | null>(null);
  const [selectedLessons, setSelectedLessons] = useState<string[]>([]);
  const [lessonOrderMapping, setLessonOrderMapping] = useState<
    Record<string, number>
  >({});
  const [gameOrderMappings, setGameOrderMappings] = useState<
    Record<string, Record<string, number>>
  >({});
  const { toast } = useToast();
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  // Form schema with translated validation messages
  const digitalGameFormSchema = z.object({
    title: z.string().min(1, t("title") + " " + t("exercise_required")),
    description: z
      .string()
      .min(1, t("description") + " " + t("exercise_required")),
    url: z.string().url(t("enter_url")),
    thumbnailUrl: z
      .union([z.string().url(t("enter_thumbnail_url")), z.string().length(0)])
      .optional(),
    lessonIds: z
      .array(z.string())
      .max(5, t("maximum_lessons_selected"))
      .optional(),
  });

  // Create translated levels for use in UI
  const translatedLevels = useMemo(
    () => ({
      beginner: t("beginner"),
      intermediate: t("intermediate"),
      advanced: t("advanced"),
    }),
    [t],
  );

  // Function to translate level text
  const translateLevel = (level: string) => {
    const lowerLevel = level.toLowerCase();
    return lowerLevel === "beginner"
      ? translatedLevels.beginner
      : lowerLevel === "intermediate"
        ? translatedLevels.intermediate
        : lowerLevel === "advanced"
          ? translatedLevels.advanced
          : level;
  };

  // Sort lessons by their order if they are in the selectedLessons array
  const getSortedLessonIds = (lessonIds: string[], gameId: string) => {
    if (!lessonIds?.length) return [];

    // Create a copy of the array to sort
    return [...lessonIds].sort((a, b) => {
      // First check the dynamic mapping
      const orderA =
        gameOrderMappings[gameId]?.[a] ||
        lessonOrderMapping[a] ||
        getLessonNumber(a);
      const orderB =
        gameOrderMappings[gameId]?.[b] ||
        lessonOrderMapping[b] ||
        getLessonNumber(b);
      return orderA - orderB;
    });
  };

  // Form setup
  const form = useForm<z.infer<typeof digitalGameFormSchema>>({
    resolver: zodResolver(digitalGameFormSchema),
    defaultValues: {
      title: "",
      description: "",
      url: "",
      thumbnailUrl: "",
      lessonIds: [],
    },
  });

  // Fetch digital games and lessons
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // 動態導入 supabase 函數
        const { supabase } = await import("@/lib/supabase");
        const supabaseClient = supabase();

        // 使用 as any 臨時解決類型問題
        const supabaseWithTypes = supabaseClient as any;

        // Get the current user
        const {
          data: { user },
          error: userError,
        } = await supabaseWithTypes.auth.getUser();

        if (userError) throw userError;

        // Fetch lessons for selection
        const { data: lessonsData, error: lessonsError } =
          await supabaseWithTypes
            .from("lessons")
            .select("id, title, description, duration, level");

        if (lessonsError) {
          throw lessonsError;
        }

        // Fetch digital games
        const { data: gamesData, error: gamesError } = await supabaseWithTypes
          .from("digital_games")
          .select("*");

        if (gamesError) {
          throw gamesError;
        }

        // Fetch lesson order mapping if user is logged in
        if (user) {
          const mapping = await getLessonOrderMapping(
            supabaseWithTypes,
            user.id,
            "global",
          );
          setLessonOrderMapping(mapping);
        }

        // 如果用戶已登入並有遊戲，則為每個遊戲載入排序
        if (user && gamesData && gamesData.length > 0) {
          const mappings: Record<string, Record<string, number>> = {};

          // 為每個遊戲查詢排序映射
          for (const game of gamesData) {
            if (game.lesson_ids && game.lesson_ids.length > 0) {
              const mapping = await getLessonOrderMapping(
                supabaseWithTypes,
                user.id,
                game.id,
              );
              mappings[game.id] = mapping;
            }
          }

          setGameOrderMappings(mappings);
        }

        setLessons(lessonsData || []);
        setDigitalGames(gamesData || []);
      } catch (error: any) {
        toast({
          title: t("error"),
          description: error.message || t("error_fetch_data"),
          variant: "destructive",
        });
        console.error("Error fetching data:", error);

        // Initialize with empty arrays on error
        setLessons([]);
        setDigitalGames([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [toast]);

  // Set form values when editing
  useEffect(() => {
    if (editingGame) {
      form.reset({
        title: editingGame.title,
        description: editingGame.description,
        url: editingGame.url,
        thumbnailUrl: editingGame.thumbnail_url || "",
        lessonIds: editingGame.lesson_ids || [],
      });
      setSelectedLessons(editingGame.lesson_ids || []);
    } else {
      form.reset({
        title: "",
        description: "",
        url: "",
        thumbnailUrl: "",
        lessonIds: [],
      });
      setSelectedLessons([]);
    }
  }, [editingGame, form]);

  const onSubmit = async (values: z.infer<typeof digitalGameFormSchema>) => {
    try {
      // 動態導入 supabase 函數
      const { supabase } = await import("@/lib/supabase");
      const supabaseClient = supabase();

      // 使用 as any 臨時解決類型問題
      const supabaseWithTypes = supabaseClient as any;

      // Get the current user
      const {
        data: { user },
        error: userError,
      } = await supabaseWithTypes.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("User not authenticated");

      const gameData = {
        title: values.title,
        description: values.description,
        url: values.url,
        thumbnail_url: values.thumbnailUrl,
        lesson_ids: selectedLessons,
        user_id: user.id,
      };

      // 確保我們有最新的課程映射
      const currentGameId = editingGame?.id || "temp-game-id";
      let currentMapping = gameOrderMappings[currentGameId];
      
      // 如果映射不存在或需要更新，則從當前選擇創建一個新的映射
      if (!currentMapping || Object.keys(currentMapping).length !== selectedLessons.length) {
        currentMapping = createMappingFromOrder(selectedLessons);
        // 更新本地狀態
        setGameOrderMappings((prev) => ({
          ...prev,
          [currentGameId]: currentMapping,
        }));
      }

      if (editingGame) {
        // Update existing game
        const { error } = await supabaseWithTypes
          .from("digital_games")
          .update(gameData)
          .eq("id", editingGame.id)
          .eq("user_id", user.id);

        if (error) throw error;

        setDigitalGames((prev) =>
          prev.map((game) =>
            game.id === editingGame.id ? { ...game, ...gameData } : game,
          ),
        );

        // 如果正在編輯，儲存目前的排序
        if (user && selectedLessons.length > 0) {
          await updateLessonOrderMapping(
            supabaseWithTypes,
            user.id,
            editingGame.id,
            currentMapping,
          );
        }

        toast({
          title: t("success"),
          description: t("game_updated"),
        });
      } else {
        // Create new game
        const { data, error } = await supabaseWithTypes
          .from("digital_games")
          .insert([gameData])
          .select()
          .single();

        if (error) throw error;

        // 當創建新遊戲時，儲存排序
        if (user && selectedLessons.length > 0 && data) {
          // 更新映射中的遊戲ID
          await updateLessonOrderMapping(
            supabaseWithTypes,
            user.id,
            data.id,
            currentMapping,
          );

          // 更新本地狀態，使用實際的遊戲ID替換臨時ID
          setGameOrderMappings((prev) => {
            const updated = { ...prev };
            if (updated[currentGameId]) {
              updated[data.id] = updated[currentGameId];
              delete updated[currentGameId];
            }
            return updated;
          });
        }

        setDigitalGames((prev) => [...prev, data]);

        toast({
          title: t("success"),
          description: t("game_created"),
        });
      }

      setShowEditForm(false);
      setEditingGame(null);
      form.reset();
      setSelectedLessons([]);
    } catch (error: any) {
      toast({
        title: t("error"),
        description: error.message || t("error_save_game"),
        variant: "destructive",
      });
      console.error("Error saving game:", error);
    }
  };

  const deleteGame = async (gameId: string) => {
    try {
      // 動態導入 supabase 函數
      const { supabase } = await import("@/lib/supabase");
      const supabaseClient = supabase();

      // 使用 as any 臨時解決類型問題
      const supabaseWithTypes = supabaseClient as any;

      const {
        data: { user },
        error: userError,
      } = await supabaseWithTypes.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("User not authenticated");

      // 1. 刪除遊戲本身
      const { error } = await supabaseWithTypes
        .from("digital_games")
        .delete()
        .eq("id", gameId)
        .eq("user_id", user.id);

      if (error) throw error;

      // 2. 同步刪除對應的 lesson_order_mapping 記錄
      const { error: mappingError } = await supabaseWithTypes
        .from("lesson_order_mappings")
        .delete()
        .eq("game_id", gameId)
        .eq("user_id", user.id);

      if (mappingError) {
        console.error("Error deleting lesson order mapping:", mappingError);
        // 繼續執行，不中斷流程，因為主要的遊戲已經成功刪除
      }

      // 3. 更新本地狀態
      setDigitalGames((prev) => prev.filter((game) => game.id !== gameId));
      
      // 也從本地映射狀態中移除
      setGameOrderMappings((prev) => {
        const updated = { ...prev };
        delete updated[gameId];
        return updated;
      });

      toast({
        title: t("success"),
        description: t("game_deleted"),
      });
    } catch (error: any) {
      toast({
        title: t("error"),
        description: error.message || t("error_delete_game"),
        variant: "destructive",
      });
    }
  };

  const handleLessonSelection = (lessonId: string) => {
    setSelectedLessons((prev) => {
      let newSelection;
      
      if (prev.includes(lessonId)) {
        // 移除課程
        newSelection = prev.filter((id) => id !== lessonId);
        
        // 更新當前遊戲的課程順序映射
        const currentGameId = editingGame?.id || "temp-game-id";
        setGameOrderMappings((prevMappings) => {
          const updatedMapping = { ...prevMappings };
          
          // 如果存在該遊戲的映射，則更新它
          if (updatedMapping[currentGameId]) {
            // 創建新的映射對象，刪除被移除的課程
            const newMapping = { ...updatedMapping[currentGameId] };
            delete newMapping[lessonId];
            
            // 更新映射，確保序號連續
            const remainingLessons = newSelection;
            const reorderedMapping = createMappingFromOrder(remainingLessons);
            updatedMapping[currentGameId] = reorderedMapping;
          }
          
          return updatedMapping;
        });
      } else {
        // 新增課程
        if (prev.length >= 5) {
          toast({
            title: "Maximum lessons reached",
            description: "You can only select up to 5 lessons per game",
            variant: "destructive",
          });
          return prev;
        }
        newSelection = [...prev, lessonId];
        
        // 更新當前遊戲的課程順序映射，為新課程分配序號
        const currentGameId = editingGame?.id || "temp-game-id";
        setGameOrderMappings((prevMappings) => {
          const updatedMapping = { ...prevMappings };
          
          // 為新課程分配序號
          if (!updatedMapping[currentGameId]) {
            updatedMapping[currentGameId] = {};
          }
          
          // 使用 createMappingFromOrder 確保序號連續
          updatedMapping[currentGameId] = createMappingFromOrder(newSelection);
          
          return updatedMapping;
        });
      }
      
      return newSelection;
    });
  };

  const handleLessonReorder = async (reorderedLessons: string[]) => {
    setSelectedLessons(reorderedLessons);

    // 遊戲 ID（如果正在編輯遊戲，使用該遊戲 ID；否則創建一個臨時 ID）
    const currentGameId = editingGame?.id || "temp-game-id";

    // 根據重排列的順序創建新的映射
    const newMapping = createMappingFromOrder(reorderedLessons);

    // 更新特定遊戲的排序映射
    setGameOrderMappings((prev) => ({
      ...prev,
      [currentGameId]: newMapping,
    }));

    // 如果不是臨時 ID（即正在編輯已有遊戲），則保存到資料庫
    if (currentGameId !== "temp-game-id") {
      try {
        // 動態導入 supabase 函數
        const { supabase } = await import("@/lib/supabase");
        const supabaseClient = supabase();

        // 獲取當前用戶
        const {
          data: { user },
        } = await supabaseClient.auth.getUser();

        if (user) {
          await updateLessonOrderMapping(
            supabaseClient,
            user.id,
            currentGameId,
            newMapping,
          );
        }
      } catch (error) {
        console.error("Failed to update lesson order mapping:", error);
      }
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        heading={t("digital_games")}
        text={t("manage_games")}
        actions={
          !showEditForm && (
            <Button
              onClick={() => {
                setEditingGame(null);
                setShowEditForm(true);
                setSelectedLessons([]);
                form.reset();
              }}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              {t("create_game")}
            </Button>
          )
        }
      />

      {isLoading ? (
        <div className="text-center py-10">{t("loading_games")}</div>
      ) : (
        <>
          {showEditForm ? (
            <>
              <div className="mb-6 flex justify-between items-center">
                <h2 className="text-xl font-semibold">
                  {editingGame ? t("edit_game") : t("create_game")}
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowEditForm(false);
                    setEditingGame(null);
                    form.reset();
                  }}
                >
                  {t("cancel")}
                </Button>
              </div>

              {editingGame && (
                <div className="mb-6">
                  <Card className="overflow-hidden">
                    <div className="flex flex-col md:flex-row">
                      {editingGame.thumbnail_url ? (
                        <div className="relative w-full md:w-1/3 pt-[56.25%] md:pt-0">
                          <img
                            src={editingGame.thumbnail_url}
                            alt={editingGame.title}
                            className="absolute inset-0 w-full h-full object-cover md:position-static md:h-auto"
                          />
                        </div>
                      ) : (
                        <div className="bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center h-40 md:w-1/3">
                          <Gamepad2 className="h-16 w-16 text-white/80" />
                        </div>
                      )}
                      <div className="md:w-2/3">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xl">
                            {editingGame.title}
                          </CardTitle>
                          <CardDescription>
                            {editingGame.description}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="mt-2">
                            <a
                              href={editingGame.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 flex items-center hover:underline"
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              {t("url")}
                            </a>
                          </div>
                          {editingGame.lesson_ids &&
                            editingGame.lesson_ids.length > 0 && (
                              <div className="space-y-1 mt-4">
                                <p className="text-sm font-medium">
                                  {t("associated_lessons")}:
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {editingGame.lesson_ids.map((lessonId) => {
                                    const lesson = lessons.find(
                                      (l) => l.id === lessonId,
                                    );
                                    return lesson ? (
                                      <Badge key={lessonId} variant="outline">
                                        {lesson.title}
                                      </Badge>
                                    ) : null;
                                  })}
                                </div>
                              </div>
                            )}
                        </CardContent>
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                >
                  <div className="grid md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("title")}</FormLabel>
                          <FormControl>
                            <Input
                              placeholder={t("enter_game_title")}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("url")}</FormLabel>
                          <FormControl>
                            <Input placeholder={t("enter_url")} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("description")}</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={t("enter_game_description")}
                            className="min-h-24"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="thumbnailUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t("thumbnail_url")} ({t("optional")})
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t("enter_thumbnail_url")}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-2">
                    <FormLabel>
                      {t("associated_lessons")} ({t("max")} 5)
                    </FormLabel>
                    <div className="grid gap-2 border rounded-md p-4 bg-muted/20">
                      {selectedLessons.length > 0 && (
                        <div className="mb-3">
                          <LessonOrderManager
                            selectedLessons={selectedLessons}
                            onLessonsReordered={handleLessonReorder}
                            onLessonRemoved={handleLessonSelection}
                            lessons={lessons}
                          />
                        </div>
                      )}

                      {lessons.length > 0 ? (
                        <>
                          <div className="relative">
                            <Input
                              placeholder={t("search_lessons")}
                              className="mb-2"
                              onChange={(e) => {
                                const searchValue =
                                  e.target.value.toLowerCase();
                                const lessonsContainer =
                                  document.getElementById("lessons-container");
                                if (lessonsContainer) {
                                  Array.from(lessonsContainer.children).forEach(
                                    (child) => {
                                      const text =
                                        child.textContent?.toLowerCase() || "";
                                      if (text.includes(searchValue)) {
                                        (child as HTMLElement).style.display =
                                          "flex";
                                      } else {
                                        (child as HTMLElement).style.display =
                                          "none";
                                      }
                                    },
                                  );
                                }
                              }}
                            />
                          </div>

                          <div
                            id="lessons-container"
                            className="space-y-2 max-h-[300px] overflow-y-auto pr-1"
                          >
                            {lessons
                              .filter(
                                (lesson) =>
                                  !selectedLessons.includes(lesson.id),
                              )
                              .map((lesson) => (
                                <div
                                  key={lesson.id}
                                  className="flex items-start space-x-2 py-2 px-2 border border-transparent hover:border-muted-foreground/20 hover:bg-muted/40 rounded-md cursor-pointer"
                                  onClick={() =>
                                    selectedLessons.length < 5 &&
                                    handleLessonSelection(lesson.id)
                                  }
                                >
                                  <div className="flex-1">
                                    <div className="font-medium">
                                      {lesson.title}
                                    </div>
                                    <div className="text-muted-foreground text-xs mt-1 line-clamp-1">
                                      {lesson.description}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                      <Clock className="h-3 w-3" />
                                      <span>
                                        {lesson.duration}
                                        {t("minutes")}
                                      </span>
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        {translateLevel(lesson.level)}
                                      </Badge>
                                    </div>
                                  </div>
                                  {selectedLessons.length < 5 && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-6 rounded-full"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleLessonSelection(lesson.id);
                                      }}
                                    >
                                      <PlusCircle className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              ))}
                          </div>

                          {selectedLessons.length >= 5 && (
                            <p className="text-xs text-amber-600 mt-2 flex items-center">
                              <span className="mr-1">
                                {t("maximum_lessons_selected")}
                              </span>
                            </p>
                          )}
                        </>
                      ) : (
                        <div className="text-center py-4 text-muted-foreground">
                          <Book className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>{t("no_lessons_available")}</p>
                          <p className="text-xs mt-1">
                            {t("create_lessons_first")}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowEditForm(false);
                        setEditingGame(null);
                        form.reset();
                      }}
                    >
                      {t("cancel")}
                    </Button>
                    <Button type="submit">
                      {editingGame ? t("update_game") : t("create_game")}
                    </Button>
                  </div>
                </form>
              </Form>
            </>
          ) : (
            <>
              {digitalGames.length === 0 ? (
                <div className="text-center py-10">
                  <Gamepad2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">
                    {t("no_games_yet")}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {t("add_first_game")}
                  </p>
                  <Button
                    onClick={() => {
                      setEditingGame(null);
                      setShowEditForm(true);
                    }}
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    {t("create_game")}
                  </Button>
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {digitalGames.map((game) => (
                    <Card key={game.id} className="flex flex-col h-full">
                      {game.thumbnail_url ? (
                        <div className="relative w-full pt-[56.25%]">
                          <img
                            src={game.thumbnail_url}
                            alt={game.title}
                            className="absolute inset-0 w-full h-full object-cover rounded-t-lg"
                          />
                        </div>
                      ) : (
                        <div className="bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center h-40 rounded-t-lg">
                          <Gamepad2 className="h-16 w-16 text-white/80" />
                        </div>
                      )}

                      <CardHeader className="pb-2">
                        <CardTitle className="text-xl">{game.title}</CardTitle>
                        <CardDescription className="line-clamp-2">
                          {game.description}
                        </CardDescription>
                      </CardHeader>

                      <CardContent className="flex-grow">
                        <div className="space-y-2">
                          {game.lesson_ids && game.lesson_ids.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-sm font-medium">
                                {t("associated_lessons")}:
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {getSortedLessonIds(
                                  game.lesson_ids,
                                  game.id,
                                ).map((lessonId) => {
                                  const lesson = lessons.find(
                                    (l) => l.id === lessonId,
                                  );
                                  // 獲取遊戲特定的課程編號
                                  const lessonNumber =
                                    gameOrderMappings[game.id]?.[lessonId] ||
                                    lessonOrderMapping[lessonId] ||
                                    getLessonNumber(lessonId);
                                  return lesson ? (
                                    <Badge
                                      key={lessonId}
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      {lessonNumber > 0
                                        ? `${lessonNumber}. `
                                        : ""}
                                      {lesson.title}
                                    </Badge>
                                  ) : null;
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>

                      <CardFooter className="pt-2">
                        <div className="flex justify-between items-center w-full">
                          <Button variant="outline" size="sm" asChild>
                            <a
                              href={game.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="mr-2 h-4 w-4" />
                              {t("play_game")}
                            </a>
                          </Button>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingGame(game);
                                setShowEditForm(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteGame(game.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
