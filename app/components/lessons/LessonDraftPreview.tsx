"use client";
import { useWatch, type Control } from "react-hook-form";
import { useLanguage } from "@/app/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";

export interface LessonEditorValues {
  title: string;
  cardDescription: string;
  duration: number;
  level: string;
  topics: string;
  markdownContent: string;
  teachingContent: string;
  geniallyLink?: string;
  practiceExercises: {
    question: string;
    answer: string;
    explanation: string;
  }[];
}

// The preview subscribes only to card fields, so typing lesson Markdown does
// not rebuild it. It reflects the draft, never the stale saved lesson.
export function LessonDraftPreview({
  control,
}: {
  control: Control<LessonEditorValues>;
}) {
  const { language } = useLanguage();
  const [title, summary, duration, level, topics] = useWatch({
    control,
    name: ["title", "cardDescription", "duration", "level", "topics"],
  });
  const zh = language === "zh-TW";
  const levels: Record<string, string> = {
    Beginner: "初級",
    Intermediate: "中級",
    Advanced: "高級",
  };
  return (
    <details className="mb-6 rounded-2xl border bg-muted/20 p-4 sm:p-5">
      <summary className="cursor-pointer text-sm font-medium">
        {zh
          ? "學生看到的課程卡片 · 即時預覽"
          : "Student lesson card · Live preview"}
      </summary>
      <div className="mt-4 max-w-xl space-y-3 rounded-xl border bg-card p-5">
        <h3 className="break-words text-lg font-semibold">
          {title || (zh ? "課程名稱" : "Lesson title")}
        </h3>
        <p className="break-words text-sm leading-6 text-muted-foreground">
          {summary ||
            (zh
              ? "加入摘要，讓學生快速了解學習目標。"
              : "Add a summary so students know what they will learn.")}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>
            {Number.isFinite(duration) ? duration : "—"} {zh ? "分鐘" : "min"}
          </span>
          <Badge variant="outline">
            {zh ? (levels[level] ?? level) : level}
          </Badge>
          {String(topics || "")
            .split(/[,，]/)
            .map((topic) => topic.trim())
            .filter(Boolean)
            .map((topic, i) => (
              <Badge key={i} variant="secondary">
                {topic}
              </Badge>
            ))}
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {zh
          ? "預覽不會自動發布，完成後請儲存變更。"
          : "Preview does not publish changes. Save when ready."}
      </p>
    </details>
  );
}
