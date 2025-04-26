/**
 * Utility functions for managing lesson order mappings
 */

import { getLessonNumber } from "./utils";
import type { Database } from "@/types/supabase";

/**
 * Get the lesson order mapping for a user and game
 */
export async function getLessonOrderMapping(
  supabaseClient: any,
  userId: string,
  gameId: string,
) {
  try {
    const { data, error } = await supabaseClient
      .from("lesson_order_mappings")
      .select("mapping")
      .eq("user_id", userId)
      .eq("game_id", gameId)
      .single();

    if (error) {
      // 資料表不存在或尚未建立時不輸出錯誤，只使用預設值
      if (
        error.code === "PGRST116" ||
        error.message.includes("does not exist")
      ) {
        return createDefaultMapping();
      }

      // 只有在其他錯誤情況下輸出錯誤日誌
      console.error("Error fetching lesson order mapping:", error);
      return createDefaultMapping();
    }

    return data?.mapping || createDefaultMapping();
  } catch (error) {
    console.error("Failed to get lesson order mapping:", error);
    return createDefaultMapping();
  }
}

/**
 * Update the lesson order mapping for a user and game
 */
export async function updateLessonOrderMapping(
  supabaseClient: any,
  userId: string,
  gameId: string,
  lessonOrder: Record<string, number>,
) {
  try {
    // Check if mapping exists for user and game
    const { data: existingMapping } = await supabaseClient
      .from("lesson_order_mappings")
      .select("id")
      .eq("user_id", userId)
      .eq("game_id", gameId)
      .single();

    if (existingMapping) {
      // Update existing mapping
      const { error } = await supabaseClient
        .from("lesson_order_mappings")
        .update({ mapping: lessonOrder })
        .eq("user_id", userId)
        .eq("game_id", gameId);

      if (error) throw error;
    } else {
      // Create new mapping
      const { error } = await supabaseClient
        .from("lesson_order_mappings")
        .insert([
          {
            user_id: userId,
            game_id: gameId,
            mapping: lessonOrder,
          },
        ]);

      if (error) throw error;
    }

    return true;
  } catch (error) {
    console.error("Failed to update lesson order mapping:", error);
    return false;
  }
}

/**
 * Create a default mapping from the static mapping in utils
 */
export function createDefaultMapping(): Record<string, number> {
  // Create a mapping object from the IDs in the getLessonNumber function
  const mapping: Record<string, number> = {};

  // Define lesson IDs based on the ones in the template
  const lessonIds = [
    "a1b2c3d4-e5f6-47a8-9b0c-1d2e3f4a5b6c",
    "b2c3d4e5-f6a7-58b9-ac0d-2e3f4a5b6c7d",
    "c3d4e5f6-a7b8-69ca-bd1e-3f4a5b6c7d8e",
    "d4e5f6a7-b8c9-7adb-ce2f-4a5b6c7d8e9f",
    "e5f6a7b8-c9da-8bec-df3a-5b6c7d8e9f0a",
  ];

  // Create mapping using the getLessonNumber function
  lessonIds.forEach((id) => {
    mapping[id] = getLessonNumber(id);
  });

  return mapping;
}

/**
 * Updates the lesson number mapping based on ordered lesson IDs
 */
export function createMappingFromOrder(
  orderedLessonIds: string[],
): Record<string, number> {
  const mapping: Record<string, number> = {};

  // Assign sequential numbers based on array order
  orderedLessonIds.forEach((id, index) => {
    mapping[id] = index + 1;
  });

  return mapping;
}
