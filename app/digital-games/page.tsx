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
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import {
  createMappingFromOrder,
  updateLessonOrderMapping,
} from "@/lib/lessonOrderUtils";
import { PageLoader } from '@/components/ui/page-state';
import { EditorWorkspace } from '@/components/layout/EditorWorkspace';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { DeleteConfirmation } from '@/components/ui/delete-confirmation';
import { GameCoverInput } from '@/components/GameCoverInput';
import { normalizeLessonOverrides, serializeLessonOverrides } from "@/lib/game-lesson-settings";
import { coverErrorMessage } from '@/lib/game-cover';
import { GameCoverSaveRejected, saveWithGameCover } from '@/lib/game-cover-storage';

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
    theme?: { template?: GameVisualTemplate; [key: string]: unknown };
    lessonOverrides?: Record<string, LessonOverride>;
    [key: string]: unknown;
  };
}

type GameVisualTemplate = 'discovery' | 'neo-brutal' | 'arcade';
const visualTemplateOf = (value: unknown): GameVisualTemplate =>
  value === 'neo-brutal' || value === 'arcade' ? value : 'discovery';
const visualTemplates = [
  { id: 'discovery', zh: '探索基地', en: 'Discovery', zhDescription: '沉穩、清楚，適合一般課程與較長教材。', enDescription: 'Calm and clear for general courses and longer materials.', artwork: '/games/template-art/discovery-hero.webp' },
  { id: 'neo-brutal', zh: '玩色積木', en: 'Neo Blocks', zhDescription: '粗框、硬陰影與高彩度，適合活潑的闖關活動。', enDescription: 'Bold borders and vivid colors for playful challenges.', artwork: '/games/template-art/neo-blocks-hero.webp' },
  { id: 'arcade', zh: '午夜電玩', en: 'Midnight Arcade', zhDescription: '深色霓虹介面，適合競賽、科技與遊戲化課程。', enDescription: 'A dark neon interface for competitions and game-driven lessons.', artwork: '/games/template-art/arcade-hero.webp' },
] satisfies Array<{ id: GameVisualTemplate; zh: string; en: string; zhDescription: string; enDescription: string; artwork: string }>;

function TemplatePreview({ template }: { template: (typeof visualTemplates)[number] }) {
  const surface = template.id === 'neo-brutal'
    ? 'border-black bg-[#ffde59] shadow-[4px_4px_0_#111]'
    : template.id === 'arcade'
      ? 'border-[#7c5cff] bg-[#100c2f] shadow-[inset_0_0_18px_#7c5cff66]'
      : 'border-[#5acddd] bg-[#102e4b]'
  return <span className={`block h-28 overflow-hidden rounded-lg border-2 ${surface}`} aria-hidden="true">
    {/* Generated decorative preview; native img avoids routing it through the admin app image proxy. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={template.artwork} alt="" className="h-full w-full object-contain p-1.5" />
  </span>
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
  // A thumbnail_url can point at a deleted/missing storage object - falls
  // back to the game icon placeholder instead of the browser's broken-image icon.
  const [brokenThumbnailIds, setBrokenThumbnailIds] = useState<Set<string>>(new Set());
  const markThumbnailBroken = (id: string) => setBrokenThumbnailIds((previous) => (previous.has(id) ? previous : new Set(previous).add(id)));
  const [selectedLessons, setSelectedLessons] = useState<string[]>([]);
  const [lessonOverrides, setLessonOverrides] = useState<Record<string, LessonOverride>>({});
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverEditing, setCoverEditing] = useState(false);
  const [openSection, setOpenSection] = useState("game-basics");
  const [visualTemplate, setVisualTemplate] = useState<GameVisualTemplate>('discovery');
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
    thumbnailUrl: coverFile ? z.string().optional() : z
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
    setCoverFile(null);
    setCoverEditing(false);
    setOpenSection("game-basics");
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
      setVisualTemplate(visualTemplateOf(editingGame.settings?.theme?.template));
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
      setVisualTemplate('discovery');
    }
  }, [editingGame, form, lessons]);

  const pathDirty = JSON.stringify({ ids: selectedLessons, overrides: lessonOverrides, template: visualTemplate }) !== JSON.stringify({
    ids: editingGame?.lesson_ids || [],
    overrides: normalizeLessonOverrides(editingGame?.lesson_ids || [], editingGame?.settings?.lessonOverrides || {}, lessons),
    template: visualTemplateOf(editingGame?.settings?.theme?.template),
  });
  const confirmLeave = useUnsavedChanges(showEditForm && (form.formState.isDirty || pathDirty || Boolean(coverFile) || coverEditing), showEditForm && form.formState.isSubmitting);
  const closeEditor = () => {
    if (!confirmLeave()) return;
    setShowEditForm(false);
    setEditingGame(null);
    setSelectedLessons([]);
    setLessonOverrides({});
    setVisualTemplate('discovery');
    setCoverFile(null);
    setCoverEditing(false);
    form.reset();
  };

  const onSubmit = async (values: z.infer<typeof digitalGameFormSchema>) => {
    if (coverEditing) return;
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

      const normalizedOverrides = serializeLessonOverrides(normalizeLessonOverrides(selectedLessons, lessonOverrides, lessons));
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
          theme: { ...(editingGame?.settings?.theme || {}), template: visualTemplate },
          lessonOverrides: normalizedOverrides,
        },
      };

      const currentMapping = createMappingFromOrder(selectedLessons);
      const savedGame = await saveWithGameCover(
        supabaseClient, user.id, coverFile, values.thumbnailUrl || '',
        async thumbnailUrl => {
          const payload = { ...gameData, thumbnail_url: thumbnailUrl };
          const query = currentEditingGameId
            ? supabaseClient.from('digital_games').update(payload).eq('id', currentEditingGameId).eq('user_id', user.id)
            : supabaseClient.from('digital_games').insert([payload]);
          const { data, error } = await query.select().single();
          if (error) {
            // Only confirmed database rejections permit removing the new upload.
            const Rejection = /^(?:[0-9A-Z]{5}|PGRST116)$/.test(error.code || '') ? GameCoverSaveRejected : Error;
            throw new Rejection(error.message);
          }
          if (!data) throw new Error(t('error_save_game'));
          return data as DigitalGame;
        },
      );
      setCoverFile(null);
      setCoverEditing(false);
      setDigitalGames(previous => currentEditingGameId
        ? previous.map(game => game.id === savedGame.id ? savedGame : game)
        : [...previous, savedGame]);
      if (selectedLessons.length > 0) {
        await updateLessonOrderMapping(supabaseWithTypes, user.id, savedGame.id, currentMapping);
      }
      toast({ title: t('success'), description: currentEditingGameId ? t('game_updated') : t('game_created') });

      setShowEditForm(false);
      setEditingGame(null);
      form.reset();
      setSelectedLessons([]);
      setLessonOverrides({});
      setVisualTemplate('discovery');
    } catch (error: any) {
      toast({
        title: t("error"),
        description: error instanceof Error && error.message.startsWith('COVER_')
          ? coverErrorMessage(error, language === 'zh-TW')
          : error.message || t("error_save_game"),
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

      if (error) {
        // 23503 = foreign_key_violation: learning_records/chat_messages/
        // question_counts/leaderboard all reference digital_games(id) with
        // no ON DELETE cascade, so a played game is intentionally blocked
        // from deletion rather than silently orphaning or wiping student data.
        if (error.code === "23503") throw new Error(t("error_delete_game_has_records"));
        throw error;
      }

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
                setVisualTemplate('discovery');
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
                  { id: 'game-style', label: language === 'zh-TW' ? '視覺樣板' : 'Visual template' },
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

              <Card className="shadow-none">
                <CardContent className="pt-5 md:pt-6">
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                  aria-busy={form.formState.isSubmitting}
                >
                  <fieldset disabled={form.formState.isSubmitting} className="min-w-0">
                  <Accordion type="single" collapsible value={openSection} onValueChange={value => setOpenSection(value)} className="space-y-4">
                  <AccordionItem value="game-basics" id="game-basics" className="scroll-mt-24 lg:scroll-mt-64">
                    <AccordionTrigger>
                      <div className="text-left">
                        <h3 className="font-semibold">{language === 'zh-TW' ? '遊戲資料' : 'Game details'}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{language === 'zh-TW' ? '設定名稱、入口網址與列表顯示內容。' : 'Set the name, launch URL and listing content.'}</p>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
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
                        <GameCoverInput
                          key={editingGame?.id || 'new-game'}
                          context={{ title: form.watch('title') || '', description: form.watch('description') || '', topics: selectedLessons.map(id => {
                            const lesson = lessons.find(item => item.id === id);
                            if (!lesson) return '';
                            const objective = lessonOverrides[id]?.mission?.objective || lesson.description || '';
                            return `${lesson.title}${objective ? `：${objective}` : ''}`;
                          }).filter(Boolean) }}
                          value={field.value || ''}
                          file={coverFile}
                          onChange={field.onChange}
                          onFileChange={setCoverFile}
                          onEditingChange={setCoverEditing}
                          disabled={form.formState.isSubmitting}
                          chinese={language === 'zh-TW'}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="game-style" id="game-style" className="scroll-mt-24 lg:scroll-mt-64">
                    <AccordionTrigger>
                      <div className="text-left">
                        <h3 className="font-semibold">{language === 'zh-TW' ? '視覺樣板' : 'Visual template'}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{language === 'zh-TW' ? '只改變遊戲外觀；關卡內容、作答、進度與資料紀錄保持相同。' : 'Changes presentation only. Lessons, answers, progress and tracking stay the same.'}</p>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <fieldset>
                        <legend className="sr-only">{language === 'zh-TW' ? '選擇視覺樣板' : 'Choose a visual template'}</legend>
                        <div className="grid gap-3 md:grid-cols-3">
                          {visualTemplates.map(template => {
                            const selected = visualTemplate === template.id;
                            return <label key={template.id} className={`cursor-pointer rounded-xl border-2 p-3 transition-colors ${selected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-foreground/30'}`}>
                              <input className="sr-only" type="radio" name="visual-template" value={template.id} checked={selected} onChange={() => setVisualTemplate(template.id)} />
                              <TemplatePreview template={template} />
                              <span className="mt-3 block font-semibold">{language === 'zh-TW' ? template.zh : template.en}</span>
                              <span className="mt-1 block text-xs leading-5 text-muted-foreground">{language === 'zh-TW' ? template.zhDescription : template.enDescription}</span>
                              {selected && <Badge className="mt-2">{language === 'zh-TW' ? '已選擇' : 'Selected'}</Badge>}
                            </label>;
                          })}
                        </div>
                      </fieldset>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="game-lessons" id="game-lessons" className="scroll-mt-24 lg:scroll-mt-64">
                    <AccordionTrigger>
                      <div className="text-left">
                        <h3 className="font-semibold">{language === 'zh-TW' ? '學習路線' : 'Learning path'}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{language === 'zh-TW' ? '選取並排序課程，直接套用任務地圖。課程名稱與教材保持原樣；可另填這款遊戲專用的摘要與任務情境。' : 'Choose and order lessons to build the mission map. Original lesson names and materials stay intact; summaries and optional mission stories apply only to this game.'}</p>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
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
                    </AccordionContent>
                  </AccordionItem>
                  </Accordion>

                  <div className="flex justify-end space-x-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={closeEditor}
                    >
                      {t("cancel")}
                    </Button>
                    <Button type="submit" disabled={form.formState.isSubmitting || coverEditing}>
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
                      {game.thumbnail_url && !brokenThumbnailIds.has(game.id) ? (
                        <div className="relative w-full pt-[56.25%]">
                          <img
                            src={game.thumbnail_url}
                            alt={game.title}
                            className="absolute inset-0 h-full w-full object-cover"
                            onError={() => markThumbnailBroken(game.id)}
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
                            {game.thumbnail_url && !brokenThumbnailIds.has(game.id) ? (
                              <img src={game.thumbnail_url} alt="" className="h-full w-full object-cover" onError={() => markThumbnailBroken(game.id)} />
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
