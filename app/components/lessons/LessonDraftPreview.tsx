"use client";
import { useWatch, type Control } from "react-hook-form";
import { useLanguage } from "@/app/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, BookOpen, CheckCircle2, Gamepad2, Sparkles, Target } from "lucide-react";

export interface LessonEditorValues {
  title: string;
  cardDescription: string;
  duration: number;
  level: string;
  topics: string;
  markdownContent: string;
  teachingContent: string;
  geniallyLink?: string;
  learningObjective: string;
  learningFlow: "challenge_first" | "content_first";
  missionScenario: string;
  mentorMessage: string;
  completionMessage: string;
  practiceExercises: {
    question: string;
    answer: string;
    explanation: string;
  }[];
}

// This preview reflects the current draft rather than the stale saved lesson.
export function LessonDraftPreview({
  control,
}: {
  control: Control<LessonEditorValues>;
}) {
  const { language } = useLanguage();
  const [title, summary, duration, level, topics, objective, flow, geniallyLink, exercises, scenario, mentorMessage, completionMessage] = useWatch({
    control,
    name: ["title", "cardDescription", "duration", "level", "topics", "learningObjective", "learningFlow", "geniallyLink", "practiceExercises", "missionScenario", "mentorMessage", "completionMessage"],
  });
  const zh = language === "zh-TW";
  const levels: Record<string, string> = {
    Beginner: "初級",
    Intermediate: "中級",
    Advanced: "高級",
  };
  return (
    <details open className="mb-6 rounded-2xl border bg-muted/20 p-4 sm:p-5">
      <summary className="cursor-pointer text-sm font-medium">
        {zh
          ? "學生任務流程 · 即時預覽"
          : "Student mission flow · Live preview"}
      </summary>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.7fr)]">
        <div className="space-y-3 rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{Number.isFinite(duration) ? duration : "—"} {zh ? "分鐘" : "min"}</span>
            <Badge variant="outline">{zh ? (levels[level] ?? level) : level}</Badge>
            {String(topics || "").split(/[,，]/).map((topic) => topic.trim()).filter(Boolean).map((topic, i) => <Badge key={i} variant="secondary">{topic}</Badge>)}
          </div>
          <h3 className="break-words text-lg font-semibold">{title || (zh ? "課程名稱" : "Lesson title")}</h3>
          <p className="break-words text-sm leading-6 text-muted-foreground">{summary || (zh ? "加入摘要，讓學生快速了解這一關。" : "Add a summary so students understand this mission.")}</p>
          {scenario && <p className="rounded-lg bg-muted/50 p-3 text-sm leading-6"><span className="font-medium">{zh ? "任務情境：" : "Scenario: "}</span>{scenario}</p>}
          <div className="flex gap-3 rounded-lg border border-primary/15 bg-primary/5 p-3 text-sm">
            <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div><span className="text-xs font-medium text-muted-foreground">{zh ? "完成目標" : "Outcome"}</span><p className="mt-1 leading-6">{objective || (zh ? "填寫學生完成後能做到的事。" : "Describe what students can do after this lesson.")}</p></div>
          </div>
          {mentorMessage && <div className="flex gap-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900"><Sparkles className="mt-0.5 h-4 w-4 shrink-0" /><p className="leading-6">Ellis：{mentorMessage}</p></div>}
          {completionMessage && <p className="text-xs leading-5 text-muted-foreground">{zh ? "完成回饋：" : "Completion feedback: "}{completionMessage}</p>}
        </div>

        <div className="rounded-xl border bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{zh ? "學生操作順序" : "Student sequence"}</p>
          <ol className="mt-4 space-y-3">
            {(flow === "content_first"
              ? [
                  { icon: BookOpen, text: zh ? "閱讀核心教材" : "Read core content" },
                  ...(geniallyLink ? [{ icon: Gamepad2, text: zh ? "進行互動教學" : "Try the interactive activity" }] : []),
                  { icon: CheckCircle2, text: zh ? `完成理解檢查（${exercises?.length || 0} 題）` : `Complete the check (${exercises?.length || 0})` },
                ]
              : [
                  { icon: Target, text: zh ? "先嘗試任務" : "Try the mission first" },
                  { icon: BookOpen, text: zh ? "卡住時查看教材" : "Use content when needed" },
                  ...(geniallyLink ? [{ icon: Gamepad2, text: zh ? "進行互動教學" : "Try the interactive activity" }] : []),
                  { icon: CheckCircle2, text: zh ? `完成理解檢查（${exercises?.length || 0} 題）` : `Complete the check (${exercises?.length || 0})` },
                ]).map(({ icon: Icon, text }, index, items) => (
              <li key={text} className="flex items-center gap-3 text-sm">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted"><Icon className="h-3.5 w-3.5" /></span>
                <span className="flex-1">{text}</span>
                {index < items.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}
              </li>
            ))}
          </ol>
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
