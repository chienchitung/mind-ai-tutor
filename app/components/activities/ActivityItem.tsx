"use client";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/app/contexts/LanguageContext";
import { useTranslation } from "@/utils/translations";
import {
  GraduationCap,
  BookOpen,
  MessageSquare,
  Bell,
  Award,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhTW, enUS } from "date-fns/locale";
export interface Activity {
  id: string;
  title: string;
  description: string;
  type:
    | "student_progress"
    | "course_update"
    | "feedback"
    | "reminder"
    | "achievement";
  timestamp: string;
  source: "lessons" | "events" | "feedback";
  read: boolean;
  target?: { id: string; name: string };
}
function ActivityIcon({ type }: { type: string }) {
  switch (type) {
    case "student_progress":
      return (
        <div className="flex items-center justify-center w-10 h-10 shrink-0 rounded-full bg-gray-100">
          <GraduationCap className="h-5 w-5 text-black" />
        </div>
      );
    case "course_update":
      return (
        <div className="flex items-center justify-center w-10 h-10 shrink-0 rounded-full bg-green-100">
          <BookOpen className="h-5 w-5 text-green-500" />
        </div>
      );
    case "feedback":
      return (
        <div className="flex items-center justify-center w-10 h-10 shrink-0 rounded-full bg-purple-100">
          <MessageSquare className="h-5 w-5 text-purple-500" />
        </div>
      );
    case "reminder":
      return (
        <div className="flex items-center justify-center w-10 h-10 shrink-0 rounded-full bg-orange-100">
          <Bell className="h-5 w-5 text-orange-500" />
        </div>
      );
    case "achievement":
      return (
        <div className="flex items-center justify-center w-10 h-10 shrink-0 rounded-full bg-yellow-100">
          <Award className="h-5 w-5 text-yellow-500" />
        </div>
      );
    default:
      return (
        <div className="flex items-center justify-center w-10 h-10 shrink-0 rounded-full bg-gray-100">
          <Bell className="h-5 w-5 text-gray-500" />
        </div>
      );
  }
}

function ActivityTypeBadge({ type }: { type: string }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  switch (type) {
    case "student_progress":
      return (
        <Badge
          variant="outline"
          className="bg-gray-50 text-black border-gray-200 text-xs py-1 px-2 rounded-md"
        >
          {t("progress")}
        </Badge>
      );
    case "course_update":
      return (
        <Badge
          variant="outline"
          className="bg-green-50 text-green-700 border-green-200 text-xs py-1 px-2 rounded-md"
        >
          {t("update")}
        </Badge>
      );
    case "feedback":
      return (
        <Badge
          variant="outline"
          className="bg-purple-50 text-purple-700 border-purple-200 text-xs py-1 px-2 rounded-md"
        >
          {t("feedback")}
        </Badge>
      );
    case "reminder":
      return (
        <Badge
          variant="outline"
          className="bg-orange-50 text-orange-700 border-orange-200 text-xs py-1 px-2 rounded-md"
        >
          {t("reminder")}
        </Badge>
      );
    case "achievement":
      return (
        <Badge
          variant="outline"
          className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs py-1 px-2 rounded-md"
        >
          {t("achievement")}
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-xs py-1 px-2 rounded-md">
          {type}
        </Badge>
      );
  }
}

export function ActivityItem({
  activity,
  onClick,
}: {
  activity: Activity;
  onClick: () => void;
}) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`grid w-full grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-x-4 gap-y-3 rounded-2xl border bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:p-5 ${!activity.read ? "border-primary/40" : "border-border/80"}`}
    >
      <ActivityIcon type={activity.type} />
      <div className="min-w-0 space-y-1.5">
        <p className="break-words font-semibold leading-6">{activity.title}</p>
        <p className="break-words text-sm leading-6 text-muted-foreground">
          {activity.description}
        </p>
        <time
          dateTime={activity.timestamp}
          className="block text-xs text-muted-foreground"
        >
          {formatDistanceToNow(new Date(activity.timestamp), {
            addSuffix: true,
            locale: language === "zh-TW" ? zhTW : enUS,
          })}
        </time>
      </div>
      <div className="col-start-2 flex flex-wrap items-center gap-2 sm:col-start-3 sm:row-start-1 sm:justify-end">
        <ActivityTypeBadge type={activity.type} />
        {!activity.read && (
          <Badge variant="default" className="text-xs">
            {t("new")}
          </Badge>
        )}
      </div>
    </button>
  );
}
