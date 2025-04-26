import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 預設課程順序映射函數（作為後備使用）
 * 當資料庫中沒有用戶定義的映射時，這個函數會提供默認的課程順序
 * 在資料庫中有用戶自定義的映射後，會優先使用資料庫中的順序
 */
export const getLessonNumber = (lessonId: string): number => {
  const lessonMap: { [key: string]: number } = {
    "a1b2c3d4-e5f6-47a8-9b0c-1d2e3f4a5b6c": 1,
    "b2c3d4e5-f6a7-58b9-ac0d-2e3f4a5b6c7d": 2,
    "c3d4e5f6-a7b8-69ca-bd1e-3f4a5b6c7d8e": 3,
    "d4e5f6a7-b8c9-7adb-ce2f-4a5b6c7d8e9f": 4,
    "e5f6a7b8-c9da-8bec-df3a-5b6c7d8e9f0a": 5,
  };
  return lessonMap[lessonId] || 0;
};
