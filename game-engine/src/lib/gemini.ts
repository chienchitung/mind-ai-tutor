'use client';

import { GoogleGenAI } from '@google/genai';

// 系統提示詞
const SYSTEM_PROMPT = `
你是一位友善、樂於助人的 Microsoft Excel 教師，專注於解答 Excel 相關問題。請用繁體中文回答問題。請務必使用繁體中文，並避免使用簡體字。
你會根據學習科學原則，循序漸進地引導學生學習。

請使用 Markdown 格式來組織你的回覆：
- 使用 # ## ### 等標題層級
- 使用 * 或 - 來建立列表
- 使用 **粗體** 來強調重要概念
- 使用 \`code\` 來標示 Excel 函數或公式
- 使用 > 引用區塊來顯示重要提示
- 使用 --- 分隔線來區分不同段落
- 適當使用表格來組織資訊

#平台基本資訊：
1. 本平台共有5個關卡，每個關卡專注於不同的Excel技能。
2. 關卡1：基本Excel操作與函數介紹
3. 關卡2：VLOOKUP函數應用
4. 關卡3：IF條件函數應用
4. 關卡4：樞紐分析表應用
5. 關卡5：綜合應用

#通用問題回答指引：
如果學生詢問以下通用問題類型，請提供相應回答：

1. 關於平台：
   - 關卡數量：「本平台總共有5個關卡，依難度逐步提升。」
   - 學習進度：「您可以在頂部進度條查看當前關卡完成情況。」
   - 獎勵機制：「完成練習可獲得星星和經驗值，星星可用於兌換獎勵。」

2. 關於操作：
   - 如何提交答案：「在練習頁面輸入您的答案後點擊"檢查答案"按鈕。」
   - 如何上傳圖片：「您可以點擊相機圖標上傳圖片，或直接將圖片複製貼上。」
   - 如何進入下一關：「正確回答當前關卡習題後，點擊"繼續"或"下一關"按鈕。」

3. 關於輔助：
   - 獲取提示：「您可以直接詢問我特定習題的提示，我會循序漸進地引導您。」
   - 查看解釋：「提交正確答案後，系統會自動顯示詳細解釋。」
   - 學習資源：「每個關卡都有教學內容和互動練習，可以切換頁籤查看。」

#課程和練習題相關指導：
1. 您將收到課程內容和當前練習題目的資訊。請認真閱讀這些內容，以便能夠針對性地回答學生的問題。
2. 當學生詢問課程中的概念時，引用課程內容中的相關部分來解釋。
3. 當學生詢問練習題目時，提供循序漸進的引導，而非直接給出答案。
4. 如果學生已經提交了答案，您會看到正確答案和解釋。此時可以更詳細地討論這個題目。

#教學策略：
1. 理解學生的問題：務必確認理解學生的需求，必要時提出問題，使用問題來引導學生思考。
2. 分步指導：不要直接提供答案，而是引導學生找到解決方案。
    * 提供提示和線索：引導學生思考相關的 Excel 功能和概念。
    * 使用示例和演示：用簡單的例子說明如何應用特定功能。
    * 推薦學習資源：提供官方文檔或其他學習資源的鏈接。

3. 鼓勵主動學習：鼓勵學生嘗試不同方法並分析結果，例如：
    * 提問："你認為哪個函數最適合這個任務？為什麼？"
    * 提問："嘗試修改一下公式，看看結果會如何變化？"
    * 提問："你能解釋一下這個公式是如何工作的嗎？"

4. 控制認知負荷：將複雜任務分解成更小、易於管理的步驟，並根據學生的學習進度調整指導難度。一次只提出一個問題。

5. 促進元認知：引導學生反思學習過程，例如：
    * 提問："你覺得你在這個過程中學到了什麼？"
    * 提問："你覺得哪些方面你掌握得比較好？哪些方面還需要改進？"
    * 提問："你下次遇到類似問題時，會如何應對？"

#限制
- 如果學生偏離主題，請溫和地將他們引導回 Excel 相關話題。
- 請勿提供完整代碼或公式，除非學生已經理解了基本概念並嘗試過自己解決問題。重點是引導學生理解和應用，而不是直接給出答案。
- 每次回覆都必須使用 Markdown 格式。
`;

// 全局變數來保存 GoogleGenAI 實例
let genAI: GoogleGenAI | null = null;
// 使用最新的 Gemini 2.5 Flash Preview 模型
const MODEL_NAME = 'gemini-2.5-flash-lite';

// 驗證 API key 格式
function isValidApiKey(apiKey: string): boolean {
  // Gemini API keys 通常以 "AIza" 開頭
  return apiKey.startsWith('AIza') && apiKey.length > 30;
}

export async function initializeGemini(apiKey: string): Promise<void> {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  if (!isValidApiKey(apiKey)) {
    throw new Error('Invalid API key format. API key should start with "AIza" and be longer than 30 characters.');
  }

  try {
    // 初始化 GoogleGenAI 客戶端
    genAI = new GoogleGenAI({ apiKey });
    // 不再在初始化時呼叫模型，避免因服務忙碌(503)而中斷初始化
    console.log('Gemini API client configured');
  } catch (error) {
    console.error('Failed to initialize Gemini API:', error);
    genAI = null; // 確保失敗時清除
    throw error;
  }
}

interface ChatContext {
  context: Array<{
    content: string;
    isUser: boolean;
  }>;
  lessonInfo: string;
}

export async function getChatResponse(message: string, context?: ChatContext, image?: string): Promise<string> {
  if (!genAI) {
    console.error('Gemini API not initialized. Make sure to call initializeGemini(apiKey) with a valid key.');
    return '# 服務尚未啟用：Gemini\n\n> 抱歉，目前無法使用 AI 助教。\n\n**可能原因**\n- 未設定或設定了無效的 API 金鑰（需以 "AIza" 開頭）\n- 伺服器暫時無法連線\n\n**處理方式**\n1. 前往系統設定貼上有效的 Gemini API 金鑰\n2. 重新整理頁面後再試一次';
  }

  try {
    console.log('Creating chat with message:', message);
    
    // 建立完整的提示訊息，包含系統指令和上下文
    let completePrompt = SYSTEM_PROMPT + "\n\n";
    
    // 如果有上下文，加入聊天歷史
    if (context) {
      // 添加課程資訊
      completePrompt += `當前課程資訊：\n${context.lessonInfo}\n\n`;
      
      // 添加之前的對話
      for (const msg of context.context) {
        completePrompt += `${msg.isUser ? '學生' : 'AI助教'}：${msg.content}\n\n`;
      }
    }
    
    // 添加當前用戶消息
    completePrompt += `學生：${message}\n\nAI助教：`;
    
    // 發送請求到 Gemini API
    console.log('Sending message to API...');
    
    let result;
    const client = genAI as GoogleGenAI; // 先前已檢查非空，這裡斷言以通過型別檢查

    // 封裝呼叫，加入重試與退避（處理 503/UNAVAILABLE/429）
    const callWithRetry = async (): Promise<any> => {
      const maxAttempts = 5;
      const baseDelayMs = 800;
      let lastError: unknown;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          if (image) {
            console.log('Processing image with message');
            if (!image.startsWith('data:image/')) {
              return { text: '# 錯誤：圖片格式不正確\n\n> 抱歉，只支援 base64 編碼的圖片格式。' };
            }
            const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (!matches || matches.length !== 3) {
              return { text: '# 錯誤：圖片格式不正確\n\n> 抱歉，無法解析圖片格式。' };
            }
            const mimeType = matches[1];
            const base64Data = matches[2];
            return await client.models.generateContent({
              model: MODEL_NAME,
              contents: [
                { role: 'user', parts: [
                  { text: completePrompt },
                  { inlineData: { mimeType, data: base64Data } }
                ]}
              ],
            });
          } else {
            return await client.models.generateContent({
              model: MODEL_NAME,
              contents: completePrompt,
            });
          }
        } catch (err) {
          lastError = err;
          const errMsg = err instanceof Error ? err.message : String(err);
          const retriable = errMsg.includes('503') || errMsg.includes('UNAVAILABLE') || errMsg.includes('429') || errMsg.toLowerCase().includes('rate limit') || errMsg.toLowerCase().includes('quota');
          if (attempt < maxAttempts && retriable) {
            const jitter = Math.random() * 200;
            const delay = baseDelayMs * Math.pow(2, attempt - 1) + jitter;
            await new Promise(res => setTimeout(res, delay));
            continue;
          }
          throw err;
        }
      }
      throw lastError;
    };

    result = await callWithRetry();
    
    console.log('Received response from API');
    
    // 檢查回應
    if (!result || !result.text) {
      return '# 系統錯誤\n\n> 抱歉，AI 沒有提供回應。請稍後再試。';
    }
    
    return result.text;
  } catch (error) {
    console.error('Error in chat response:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      if (error.message.includes('503') || error.message.includes('UNAVAILABLE')) {
        return '# 服務繁忙\n\n> Google AI 目前過載，請稍後再試（已自動重試數次）。\n\n建議：等待數十秒再重試，或於離峰時段使用。';
      }
      if (error.message.includes('API_KEY_INVALID')) {
        return '# 錯誤：API 金鑰無效\n\n> 抱歉，AI 助教的 API 金鑰無效。請聯繫系統管理員。';
      } else if (error.message.includes('not found') || error.message.includes('not supported')) {
        return '# 錯誤：模型不可用\n\n> 抱歉，AI 模型暫時無法使用。請聯繫系統管理員檢查模型配置。';
      } else if (error.message.includes('PERMISSION_DENIED')) {
        return '# 錯誤：權限不足\n\n> 抱歉，目前沒有權限使用此 AI 模型。請聯繫系統管理員確認 API 金鑰權限。';
      } else if (error.message.includes('image')) {
        return '# 錯誤：圖片處理錯誤\n\n> 抱歉，上傳的圖片無法被處理。請確保圖片格式正確且檔案大小合適。';
      } else if (error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED') || error.message.includes('quota') || error.message.includes('rate limit')) {
        return '# 使用量超額\n\n> 抱歉，我們已經達到了 Google AI 的使用額度限制。請稍後再試，或聯繫系統管理員升級 API 配額。\n\n您仍然可以繼續使用本系統的其他功能。';
      }
    }
    return '# 系統錯誤\n\n> 抱歉，我現在無法回應。請稍後再試。';
  }
}
