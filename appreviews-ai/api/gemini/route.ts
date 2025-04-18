import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Helper function to delay execution
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Retry function with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>, 
  retries = 3, 
  baseDelayMs = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    // If we've run out of retries or this isn't a rate limit error, rethrow
    if (retries <= 0 || error?.status !== 429) {
      throw error;
    }
    
    // Calculate delay with exponential backoff and jitter
    const delay = baseDelayMs * Math.pow(2, 3 - retries) * (0.5 + Math.random() * 0.5);
    console.log(`Rate limit hit. Retrying in ${Math.round(delay)}ms. Retries left: ${retries-1}`);
    
    // Wait before retrying
    await sleep(delay);
    
    // Retry with one less retry available
    return retryWithBackoff(fn, retries - 1, baseDelayMs);
  }
}

// 新增：清理和預處理API響應，確保返回格式正確的JSON
function cleanResponseText(text: string): string {
  // 移除Markdown代碼塊標記
  let cleaned = text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();
  
  // 檢查是否有完整的JSON對象（以{開始，以}結束）
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }
  
  // 修復常見JSON格式問題
  cleaned = cleaned
    .replace(/,(\s*[}\]])/g, '$1') // 移除尾隨逗號
    .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":') // 確保屬性名稱有引號
    .replace(/:\s*'([^']*)'/g, ': "$1"') // 將單引號替換為雙引號
    .replace(/\\n/g, ' ') // 移除換行符
    .replace(/"/g, '"') // 修復可能的異常引號
    .replace(/'/g, '"') // 將所有單引號轉換為雙引號
    .replace(/「/g, '"').replace(/」/g, '"'); // 處理中文引號
  
  // 驗證JSON格式是否有效
  try {
    JSON.parse(cleaned);
    console.log('API response cleaned and validated as valid JSON');
  } catch (e) {
    console.warn('Cleaned response is still not valid JSON:', e);
  }
  
  return cleaned;
}

export async function POST(request: Request) {
  try {
    const { prompt, model } = await request.json();

    if (!process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
      throw new Error('NEXT_PUBLIC_GEMINI_API_KEY is not configured');
    }

    const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY);
    const modelInstance = genAI.getGenerativeModel({ model });

    // Use the retry function to handle potential rate limiting
    const text = await retryWithBackoff(async () => {
      const result = await modelInstance.generateContent(prompt);
      const response = await result.response;
      return response.text();
    });

    // 新增：預處理和清理響應
    const cleanedText = cleanResponseText(text);

    return NextResponse.json({ 
      response: cleanedText,
      originalResponse: text  // 保留原始響應，用於調試
    });
  } catch (error) {
    console.error('Gemini API error:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to process request';
    let statusCode = 500;
    
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    // Check for specific error types
    if (typeof error === 'object' && error !== null) {
      const err = error as any;
      if (err.status === 429) {
        errorMessage = 'Rate limit exceeded. Please try again later.';
        statusCode = 429;
      } else if (err.status === 400) {
        errorMessage = 'Invalid request to Gemini API';
        statusCode = 400;
      } else if (err.status === 403) {
        errorMessage = 'API key issue or quota exceeded';
        statusCode = 403;
      }
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
} 