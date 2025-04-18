import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

// 添加延遲函數
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 添加重試邏輯的包裝函數
async function fetchWithRetry(url: string, options: RequestInit, maxRetries: number = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      
      // 如果不是 503 錯誤，直接返回響應
      if (response.status !== 503) {
        return response;
      }
      
      // 如果是 503 錯誤且還有重試次數，等待後重試
      if (i < maxRetries - 1) {
        const waitTime = Math.min(2000 * Math.pow(2, i), 30000); // 指數退避，最多等待 30 秒
        console.log(`HuggingFace API 暫時不可用，等待 ${waitTime/1000} 秒後重試... (第 ${i + 1} 次)`);
        await delay(waitTime);
        continue;
      }
    } catch (error) {
      if (i < maxRetries - 1) {
        const waitTime = Math.min(2000 * Math.pow(2, i), 30000);
        console.log(`網絡錯誤，等待 ${waitTime/1000} 秒後重試... (第 ${i + 1} 次)`);
        await delay(waitTime);
        continue;
      }
      throw error;
    }
  }
  throw new Error('超過最大重試次數');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { model, inputs } = body;
    
    if (!model || !inputs) {
      return NextResponse.json(
        { error: 'Missing required fields: model and inputs' },
        { status: 400 }
      );
    }

    const huggingFaceApiKey = process.env.NEXT_PUBLIC_HUGGING_FACE_API_KEY;
    if (!huggingFaceApiKey) {
      return NextResponse.json(
        { error: 'HuggingFace API key is not configured' },
        { status: 500 }
      );
    }

    const response = await fetchWithRetry(
      `https://api-inference.huggingface.co/models/${model}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${huggingFaceApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ inputs })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { 
          error: `HuggingFace API request failed: ${response.status}`, 
          details: errorText,
          message: '請稍後重試，或聯繫系統管理員'
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in HuggingFace proxy:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: '系統發生錯誤，請稍後重試'
      },
      { status: 500 }
    );
  }
} 