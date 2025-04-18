import { NextResponse } from 'next/server';

const SEARCH_API_URL = process.env.SEARCH_API_URL;
const SEARCH_API_KEY = process.env.SEARCH_API_KEY;

export async function POST(request: Request): Promise<Response> {
  try {
    const { searchTerm } = await request.json();

    if (!searchTerm) {
      return NextResponse.json(
        { error: '請提供搜尋關鍵字' },
        { status: 400 }
      );
    }

    if (!SEARCH_API_URL) {
      console.error('Search API URL is not defined');
      return NextResponse.json(
        { error: 'Search API URL 未設定' },
        { status: 500 }
      );
    }

    const response = await fetch(SEARCH_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SEARCH_API_KEY}`
      },
      body: JSON.stringify({ searchTerm }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '搜尋失敗');
    }

    const data = await response.json();
    if (!data || data.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        message: "找不到相關應用程式"
      });
    }

    return NextResponse.json({
      success: true,
      data: data.data
    });

  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '搜尋處理失敗' },
      { status: 500 }
    );
  }
} 