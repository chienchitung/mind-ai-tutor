import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import type { Keyword } from '@/types/feedback';

// 用於驗證環境配置的函數
function validateEnvironment() {
  if (!process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is not configured');
  }
  return process.env.NEXT_PUBLIC_GEMINI_API_KEY;
}

// 驗證請求數據的函數
function validateRequestData(data: any) {
  if (!data) {
    throw new Error('Request data is missing');
  }

  if (!data.keywords || !Array.isArray(data.keywords)) {
    throw new Error('Invalid or missing keywords data');
  }

  const requiredFields = [
    'totalFeedbacks',
    'averageRating',
    'positiveRatio',
    'neutralRatio',
    'negativeRatio'
  ];

  for (const field of requiredFields) {
    if (typeof data[field] === 'undefined') {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  return data;
}

// 生成提示詞的函數
function generatePrompt(data: any) {
  const currentDate = new Date().toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return `請根據以下數據生成一份簡單扼要的分析報告，並遵循指定的格式要求：

  報告日期：${currentDate}
  
  分析數據：
  - 總回饋數量：${data.totalFeedbacks}
  - 平均評分：${data.averageRating}
  - 正面評價比例：${(data.positiveRatio * 100).toFixed(1)}%
  - 中性評價比例：${(data.neutralRatio * 100).toFixed(1)}%
  - 負面評價比例：${(data.negativeRatio * 100).toFixed(1)}%
  
  關鍵詞出現頻率（前20名）：
  ${data.keywords.map((k: Keyword) => `${k.word}: ${k.count}次`).join('\n')}
  
  請依照以下格式生成分析報告：
  
  [整體分析]
  1. [趨勢觀察點1]
  2. [趨勢觀察點2]
  3. [趨勢觀察點3]
  
  [具體問題]
  1. [問題點1]
  2. [問題點2]
  3. [問題點3]
  
  [改進建議
  1. [建議1]
  2. [建議2]
  3. [建議3]
  
  [優先執行事項]
  1. [優先項目1]
  2. [優先項目2]
  3. [優先項目3]
  
  請注意：
  1. 每個分析點都需要具體的數據支持
  2. 使用繁體中文
  3. 保持專業、具體且有洞察力
  4. 不要使用項目符號(*)，請使用數字列表
  5. 確保內容清晰易讀，重點突出
  6. 每點不超過30字`;
}

// Gemini API 配置
const GEMINI_CONFIG = {
  model: 'gemini-1.5-pro',
  generationConfig: {
    temperature: 0.7,
    maxOutputTokens: 512,
    topK: 20,
    topP: 0.8,
  }
} as const;

export const maxDuration = 60; // 改為 60 秒以符合免費版本限制

// 主要的處理函數
export async function POST(req: Request) {
  try {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 9000);
    });

    const dataPromise = async () => {
      try {
        // 只讀取一次 request body
        const requestData = await req.json();
        
        const logs = {
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV,
          vercelEnvironment: process.env.VERCEL_ENV,
        };

        console.log('Starting request processing:', logs);

        // 驗證環境變數
        const apiKey = validateEnvironment();
        console.log('Environment validated, API key present:', !!apiKey);

        // 驗證請求數據
        const validatedData = validateRequestData(requestData);
        console.log('Request data validated');

        // 初始化 Gemini
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel(GEMINI_CONFIG);
        console.log('Gemini model initialized with config:', GEMINI_CONFIG);

        // 生成提示詞
        const prompt = generatePrompt(validatedData);
        console.log('Prompt generated, length:', prompt.length);

        // 調用 Gemini API
        console.log('Calling Gemini API...');
        const result = await model.generateContent(prompt);
        
        if (!result?.response) {
          throw new Error('Invalid response from Gemini API');
        }

        const text = result.response.text();
        
        if (!text?.length) {
          throw new Error('Empty response from Gemini API');
        }

        console.log('Successfully generated response, length:', text.length);

        // 返回成功結果
        return { 
          analysis: text,
          metadata: {
            generatedAt: new Date().toISOString(),
            promptLength: prompt.length,
            responseLength: text.length
          }
        };

      } catch (error) {
        // 詳細的錯誤日誌
        const errorDetails = {
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV,
          vercelEnvironment: process.env.VERCEL_ENV,
          error: {
            message: error instanceof Error ? error.message : 'Unknown error',
            type: error instanceof Error ? error.constructor.name : typeof error,
            stack: error instanceof Error ? error.stack : undefined
          }
        };

        console.error('Error in API route:', errorDetails);

        throw error; // 向上拋出錯誤，讓外層統一處理
      }
    };

    // 使用 Promise.race 來處理超時情況
    const result = await Promise.race([dataPromise(), timeoutPromise]);
    
    return NextResponse.json(result);
    
  } catch (error: any) {
    console.error('Generate insights error:', error);
    
    if (error.message === 'Request timeout') {
      return NextResponse.json(
        { 
          error: '由於處理時間限制，建議您：\n1. 減少輸入數據量\n2. 分批處理數據\n3. 簡化分析要求',
          suggestion: '建議將數據量減少一半後重試'
        },
        { status: 504 }
      );
    }
    
    return NextResponse.json(
      { 
        error: '生成洞察分析時發生錯誤',
        message: error.message
      },
      { status: 500 }
    );
  }
}