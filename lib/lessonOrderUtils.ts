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
    // 如果 gameId 是 "global"，直接返回預設映射而不查詢資料庫
    if (gameId === "global") {
      return createDefaultMapping();
    }

    const { data, error } = await supabaseClient
      .from("lesson_order_mappings")
      .select("mapping")
      .eq("user_id", userId)
      .eq("game_id", gameId)
      .single();

    if (error) {
      // 先輸出錯誤訊息以便調試
      console.log("Debug - Error Object:", JSON.stringify(error));
      
      // 資料表不存在或尚未建立時不報錯，只返回預設值
      if (
        error.code === "PGRST116" ||
        (error.message && error.message.includes("does not exist")) ||
        Object.keys(error).length === 0
      ) {
        return createDefaultMapping();
      }

      // 其他錯誤情況同樣返回預設值，避免應用崩潰
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
    console.log(`updateLessonOrderMapping called - gameId: ${gameId}, lessonCount: ${Object.keys(lessonOrder).length}`);
    console.trace('Call stack trace');
    
    // 如果 gameId 是 "global"，不進行任何操作
    if (gameId === "global") {
      console.log("Skipping update for global mapping");
      return true;
    }

    // 記錄操作開始
    console.log(`Updating lesson order for gameId: ${gameId}`);
    
    try {
      // 先嘗試檢查映射是否存在
      const { data: existingMapping, error: checkError } = await supabaseClient
        .from("lesson_order_mappings")
        .select("id")
        .eq("user_id", userId)
        .eq("game_id", gameId)
        .single();

      // 如果查詢出錯（例如 406 錯誤），直接嘗試創建新記錄
      if (checkError) {
        console.log("Error checking existing mapping:", JSON.stringify(checkError));
        console.log("Attempting to create new mapping directly");
        
        const { error: insertError } = await supabaseClient
          .from("lesson_order_mappings")
          .insert([
            {
              user_id: userId,
              game_id: gameId,
              mapping: lessonOrder,
            },
          ]);

        if (insertError) {
          console.error("Failed to create mapping:", JSON.stringify(insertError));
          return false;
        }
        
        return true;
      }

      // 存在映射時更新
      if (existingMapping) {
        const { error: updateError } = await supabaseClient
          .from("lesson_order_mappings")
          .update({ mapping: lessonOrder })
          .eq("user_id", userId)
          .eq("game_id", gameId);

        if (updateError) {
          console.error("Failed to update mapping:", JSON.stringify(updateError));
          return false;
        }
      } else {
        // 不存在時創建
        const { error: insertError } = await supabaseClient
          .from("lesson_order_mappings")
          .insert([
            {
              user_id: userId,
              game_id: gameId,
              mapping: lessonOrder,
            },
          ]);

        if (insertError) {
          console.error("Failed to create mapping:", JSON.stringify(insertError));
          return false;
        }
      }

      return true;
    } catch (innerError) {
      console.error("Exception during mapping operation:", innerError);
      return false;
    }
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
