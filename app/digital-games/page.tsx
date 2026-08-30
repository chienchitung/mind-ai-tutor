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
  Search,
  Grid,
  List,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useLanguage } from "@/app/contexts/LanguageContext";
import { useTranslation } from "@/utils/translations";
import { LessonOrderManager, type LessonOverride } from "@/components/LessonOrderManager";
import {
  createMappingFromOrder,
  updateLessonOrderMapping,
} from "@/lib/lessonOrderUtils";
import { PageLoader } from '@/components/ui/page-state';
import { EditorWorkspace } from '@/components/layout/EditorWorkspace';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { DeleteConfirmation } from '@/components/ui/delete-confirmation';

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
  is_active?: boolean;
  settings?: {
    lessonOverrides?: Record<string, LessonOverride>;
    [key: string]: unknown;
  };
}

function normalizeLessonOverrides(
  lessonIds: string[],
  overrides: Record<string, LessonOverride>,
  lessons: Lesson[],
): Record<string, LessonOverride> {
  const startsWithIntro = overrides[lessonIds[0]]?.role === 'intro';

  return lessonIds.reduce<Record<string, LessonOverride>>((result, lessonId, index) => {
    const lesson = lessons.find(item => item.id === lessonId);
    const existing = overrides[lessonId] ?? {};
    result[lessonId] = {
      ...existing,
      number: startsWithIntro ? index : index + 1,
      role: existing.role ?? 'standard',
      cardDescription: existing.cardDescription ?? lesson?.description ?? '',
    };
    return result;
  }, {});
}

export default function DigitalGamesPage() {
  const [digitalGames, setDigitalGames] = useState<DigitalGame[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<DigitalGame | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingGame, setEditingGame] = useState<DigitalGame | null>(null);
  const [gameSearch, setGameSearch] = useState("");
  const [lessonSearch, setLessonSearch] = useState("");
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedLessons, setSelectedLessons] = useState<string[]>([]);
  const [lessonOverrides, setLessonOverrides] = useState<Record<string, LessonOverride>>({});
  const { toast } = useToast();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const normalizedGameSearch = gameSearch.trim().toLowerCase();
  const visibleGames = digitalGames.filter((game) =>
    !normalizedGameSearch
    || game.title.toLowerCase().includes(normalizedGameSearch)
    || game.description?.toLowerCase().includes(normalizedGameSearch)
  );

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

  const getGameEngineUrl = (game: DigitalGame) => {
    const engineBaseUrl = process.env.NEXT_PUBLIC_GAME_ENGINE_URL?.replace(/\/$/, "");
    return engineBaseUrl ? `${engineBaseUrl}/games/${game.id}` : game.url;
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

        if (userError || !user) throw userError || new Error("Please sign in again.");

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
      setLessonOverrides(normalizeLessonOverrides(
        editingGame.lesson_ids || [],
        editingGame.settings?.lessonOverrides || {},
        lessons,
      ));
    } else {
      form.reset({
        title: "",
        description: "",
        url: "",
        thumbnailUrl: "",
        lessonIds: [],
      });
      setSelectedLessons([]);
      setLessonOverrides({});
    }
  }, [editingGame, form, lessons]);

  const pathDirty = JSON.stringify({ ids: selectedLessons, overrides: lessonOverrides }) !== JSON.stringify({
    ids: editingGame?.lesson_ids || [],
    overrides: normalizeLessonOverrides(editingGame?.lesson_ids || [], editingGame?.settings?.lessonOverrides || {}, lessons),
  });
  const confirmLeave = useUnsavedChanges(showEditForm && (form.formState.isDirty || pathDirty), showEditForm && form.formState.isSubmitting);
  const closeEditor = () => {
    if (!confirmLeave()) return;
    setShowEditForm(false);
    setEditingGame(null);
    setSelectedLessons([]);
    setLessonOverrides({});
    form.reset();
  };

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

      // 保存當前編輯的遊戲ID，避免狀態變更導致的副作用
      const currentEditingGameId = editingGame?.id;

      const normalizedOverrides = normalizeLessonOverrides(selectedLessons, lessonOverrides, lessons);
      const gameData = {
        title: values.title,
        description: values.description,
        url: values.url,
        thumbnail_url: values.thumbnailUrl,
        lesson_ids: selectedLessons,
        user_id: user.id,
        is_active: true,
        settings: {
          ...(editingGame?.settings || {}),
          lessonOverrides: normalizedOverrides,
        },
      };

      // 確保我們有最新的課程映射
      const currentMapping = createMappingFromOrder(selectedLessons);

      if (currentEditingGameId) {
        // Update existing game
        const { error } = await supabaseWithTypes
          .from("digital_games")
          .update(gameData)
          .eq("id", currentEditingGameId)
          .eq("user_id", user.id);

        if (error) throw error;

        setDigitalGames((prev) =>
          prev.map((game) =>
            game.id === currentEditingGameId ? { ...game, ...gameData } : game,
          ),
        );

        // 如果正在編輯，儲存目前的排序
        if (user && selectedLessons.length > 0) {
          await updateLessonOrderMapping(
            supabaseWithTypes,
            user.id,
            currentEditingGameId,
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
      setLessonOverrides({});
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
    if (isDeleting) return;
    setIsDeleting(true);
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
      setDeleteTarget(null);
      

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
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLessonSelection = (lessonId: string) => {
    const newSelection = selectedLessons.includes(lessonId)
      ? selectedLessons.filter(id => id !== lessonId)
      : [...selectedLessons, lessonId];
    setSelectedLessons(newSelection);
    setLessonOverrides(previous => {
      const next = { ...previous };
      if (selectedLessons.includes(lessonId)) {
        delete next[lessonId];
      } else {
        const lesson = lessons.find(item => item.id === lessonId);
        next[lessonId] = {
          role: 'standard',
          cardDescription: lesson?.description ?? '',
        };
      }
      return normalizeLessonOverrides(newSelection, next, lessons);
    });

  };

  const handleLessonOverrideChange = (lessonId: string, override: Partial<LessonOverride>) => {
    setLessonOverrides(previous => {
      const next = { ...previous };

      if (override.role === 'intro' || override.role === 'final') {
        Object.entries(next).forEach(([id, existing]) => {
          if (id !== lessonId && existing.role === override.role) {
            next[id] = { ...existing, role: 'standard' };
          }
        });
      }

      next[lessonId] = { ...next[lessonId], ...override };
      return normalizeLessonOverrides(selectedLessons, next, lessons);
    });
  };

  const handleLessonReorder = (reorderedLessons: string[]) => {
    setSelectedLessons(reorderedLessons);
    setLessonOverrides(previous => normalizeLessonOverrides(reorderedLessons, previous, lessons));
  };

  return (
    <div className="space-y-6">
      <DeleteConfirmation name={deleteTarget?.title ?? null} busy={isDeleting} onCancel={() => setDeleteTarget(null)} onConfirm={() => { if (deleteTarget) void deleteGame(deleteTarget.id); }} />
      <PageHeader
        heading={t("digital_games")}
        text={t("manage_games")}
        actions={
          !showEditForm && (<>
            <div className="flex rounded-lg bg-muted p-1" aria-label={language === 'zh-TW' ? '檢視模式' : 'View mode'}>
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 px-2.5"
                onClick={() => setViewMode('grid')}
                aria-label={language === 'zh-TW' ? '卡片檢視' : 'Grid view'}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 px-2.5"
                onClick={() => setViewMode('list')}
                aria-label={language === 'zh-TW' ? '列表檢視' : 'List view'}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
            <Button
              onClick={() => {
                setEditingGame(null);
                setShowEditForm(true);
                setSelectedLessons([]);
                setLessonOverrides({});
                form.reset();
              }}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              {t("create_game")}
            </Button>
          </>)
        }
      />

      {!showEditForm && !isLoading && (
        <div className="app-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={gameSearch}
              onChange={(event) => setGameSearch(event.target.value)}
              placeholder={language === 'zh-TW' ? '搜尋遊戲名稱或說明' : 'Search games by name or description'}
              className="pl-9"
            />
          </div>
          <span className="text-sm text-muted-foreground">
            {language === 'zh-TW' ? `顯示 ${visibleGames.length} / ${digitalGames.length} 款遊戲` : `Showing ${visibleGames.length} of ${digitalGames.length} games`}
          </span>
        </div>
      )}

      {isLoading ? (
        <PageLoader />
      ) : (
        <>
          {showEditForm ? (
            <>
              <EditorWorkspace
                title={editingGame ? t("edit_game") : t("create_game")}
                description={language === 'zh-TW' ? '先完成遊戲資料，再安排學習路線與各關卡顯示內容。' : 'Complete the game details, then arrange the learning path and level content.'}
                sections={[
                  { id: 'game-basics', label: language === 'zh-TW' ? '遊戲資料' : 'Game details' },
                  { id: 'game-lessons', label: language === 'zh-TW' ? '學習路線' : 'Learning path' },
                ]}
                actions={<Button
                  variant="outline"
                  size="sm"
                  disabled={form.formState.isSubmitting}
                  onClick={closeEditor}
                >
                  {t("cancel")}
                </Button>}
              />

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

              <Card className="shadow-none">
                <CardContent className="pt-5 md:pt-6">
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                  aria-busy={form.formState.isSubmitting}
                >
                  <fieldset disabled={form.formState.isSubmitting} className="space-y-4 min-w-0">
                  <section id="game-basics" className="scroll-mt-24 lg:scroll-mt-64 space-y-4 rounded-xl border border-border/70 p-4 sm:p-5">
                    <div>
                      <h3 className="font-semibold">{language === 'zh-TW' ? '遊戲資料' : 'Game details'}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{language === 'zh-TW' ? '設定名稱、入口網址與列表顯示內容。' : 'Set the name, launch URL and listing content.'}</p>
                    </div>
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
                  </section>

                  <section id="game-lessons" className="scroll-mt-24 lg:scroll-mt-64 space-y-4 rounded-xl border border-border/70 p-4 sm:p-5">
                    <div>
                      <h3 className="font-semibold">{language === 'zh-TW' ? '學習路線' : 'Learning path'}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{language === 'zh-TW' ? '選取並排序關卡；此處的名稱與摘要會覆蓋課程預設值。' : 'Choose and reorder levels; names and summaries here override lesson defaults.'}</p>
                    </div>
                  <div className="space-y-2">
                    <FormLabel>
                      {t("associated_lessons")}
                    </FormLabel>
                    <div className="grid gap-2 border rounded-md p-4 bg-muted/20">
                      {selectedLessons.length > 0 && (
                        <div className="mb-3">
                          <LessonOrderManager
                            disabled={form.formState.isSubmitting}
                            selectedLessons={selectedLessons}
                            onLessonsReordered={handleLessonReorder}
                            onLessonRemoved={handleLessonSelection}
                            lessons={lessons}
                            lessonOverrides={lessonOverrides}
                            onLessonOverrideChange={handleLessonOverrideChange}
                          />
                        </div>
                      )}

                      {lessons.length > 0 ? (
                        <>
                          <div className="relative">
                            <Input
                              placeholder={t("search_lessons")}
                              className="mb-2"
                              value={lessonSearch}
                              onChange={(e) => setLessonSearch(e.target.value)}
                            />
                          </div>

                          <div
                            id="lessons-container"
                            className="space-y-2 max-h-[300px] overflow-y-auto pr-1"
                          >
                            {lessons
                              .filter(
                                (lesson) =>
                                  !selectedLessons.includes(lesson.id)
                                  && (!lessonSearch.trim()
                                    || lesson.title.toLowerCase().includes(lessonSearch.trim().toLowerCase())
                                    || lesson.description?.toLowerCase().includes(lessonSearch.trim().toLowerCase())),
                              )
                              .map((lesson) => (
                                <button
                                  type="button"
                                  key={lesson.id}
                                  className="flex w-full items-start space-x-2 rounded-md border border-transparent px-2 py-2 text-left hover:border-muted-foreground/20 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                  onClick={() => handleLessonSelection(lesson.id)}
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
                                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-background" aria-hidden="true">
                                    <PlusCircle className="h-3 w-3" />
                                  </span>
                                </button>
                              ))}
                          </div>

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
                  </section>

                  <div className="flex justify-end space-x-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={closeEditor}
                    >
                      {t("cancel")}
                    </Button>
                    <Button type="submit" disabled={form.formState.isSubmitting}>
                      {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {form.formState.isSubmitting ? (language === 'zh-TW' ? '儲存中…' : 'Saving…') : editingGame ? t("update_game") : t("create_game")}
                    </Button>
                  </div>
                  </fieldset>
                </form>
              </Form>
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              {visibleGames.length === 0 ? (
                <div className="text-center py-10">
                  <Gamepad2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">
                    {digitalGames.length === 0 ? t("no_games_yet") : t('no_results_found')}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {digitalGames.length === 0
                      ? t("add_first_game")
                      : (language === 'zh-TW' ? '請調整搜尋關鍵字後再試一次。' : 'Adjust your search and try again.')}
                  </p>
                  <Button
                    onClick={() => {
                      if (digitalGames.length === 0) {
                        setEditingGame(null);
                        setShowEditForm(true);
                      } else {
                        setGameSearch('');
                      }
                    }}
                  >
                    {digitalGames.length === 0 && <PlusCircle className="mr-2 h-4 w-4" />}
                    {digitalGames.length === 0
                      ? t("create_game")
                      : (language === 'zh-TW' ? '清除搜尋' : 'Clear search')}
                  </Button>
                </div>
              ) : (
                <div className={viewMode === 'grid' ? "grid gap-4 md:grid-cols-2 xl:grid-cols-3" : "space-y-3"}>
                  {visibleGames.map((game) => (
                    viewMode === 'grid' ? <Card key={game.id} className="flex h-full flex-col overflow-hidden shadow-none transition-colors hover:border-foreground/25">
                      {game.thumbnail_url ? (
                        <div className="relative w-full pt-[56.25%]">
                          <img
                            src={game.thumbnail_url}
                            alt={game.title}
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="flex h-40 items-center justify-center bg-foreground">
                          <Gamepad2 className="h-14 w-14 text-background/80" />
                        </div>
                      )}

                      <CardHeader className="pb-2">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <Badge variant={game.is_active === false ? 'secondary' : 'default'}>
                            {game.is_active === false
                              ? (language === 'zh-TW' ? '草稿' : 'Draft')
                              : (language === 'zh-TW' ? '已發布' : 'Published')}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {language === 'zh-TW'
                              ? `${game.lesson_ids?.length || 0} 個關卡`
                              : `${game.lesson_ids?.length || 0} levels`}
                          </span>
                        </div>
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
                                {game.lesson_ids.map((lessonId, index) => {
                                  const lesson = lessons.find(
                                    (l) => l.id === lessonId,
                                  );
                                  // Use the same ordered IDs and display overrides as the game manifest.
                                  const override = game.settings?.lessonOverrides?.[lessonId];
                                  const lessonNumber = override?.number ?? index + 1;
                                  return lesson ? (
                                    <Badge
                                      key={lessonId}
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      {lessonNumber}. {lesson.title}
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
                              href={getGameEngineUrl(game)}
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
                              aria-label={`${t("edit_game")}: ${game.title}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteTarget(game)}
                              aria-label={`${t("delete")}: ${game.title}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardFooter>
                    </Card> : (
                      <Card key={game.id} className="shadow-none transition-colors hover:border-foreground/25">
                        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-foreground">
                            {game.thumbnail_url ? (
                              <img src={game.thumbnail_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <Gamepad2 className="h-6 w-6 text-background/80" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold">{game.title}</h3>
                              <Badge variant={game.is_active === false ? 'secondary' : 'default'}>
                                {game.is_active === false
                                  ? (language === 'zh-TW' ? '草稿' : 'Draft')
                                  : (language === 'zh-TW' ? '已發布' : 'Published')}
                              </Badge>
                            </div>
                            <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{game.description}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {language === 'zh-TW' ? `${game.lesson_ids?.length || 0} 個關卡` : `${game.lesson_ids?.length || 0} levels`}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                            <Button variant="outline" size="sm" asChild>
                              <a href={getGameEngineUrl(game)} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="mr-2 h-4 w-4" />
                                {t("play_game")}
                              </a>
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => { setEditingGame(game); setShowEditForm(true); }}>
                              <Pencil className="mr-2 h-4 w-4" />{t("edit")}
                            </Button>
                            <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(game)}>
                              <Trash2 className="mr-2 h-4 w-4" />{t("delete")}
                            </Button>
                          </div>
                        </div>
                      </Card>
                    )
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
