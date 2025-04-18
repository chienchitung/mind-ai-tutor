import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || "");

export async function POST(req: NextRequest) {
  try {
    const { messages, systemPrompt } = await req.json();

    // Initialize the model with the same configuration as Chatbot.tsx
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-001",
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 512,
        topK: 20,
        topP: 0.8,
      }
    });

    // Format the conversation history and system prompt
    const prompt = `${systemPrompt}

用戶歷史對話：
${messages.map((msg: any) => `${msg.role === 'user' ? '用戶' : 'AI助手'}: ${msg.content}`).join('\n')}

當前用戶問題：
${messages[messages.length - 1].content}

請根據以上資訊和角色定位進行回答：`;

    // Generate content
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ response: text });
  } catch (error) {
    console.error("Error in chat route:", error);
    return NextResponse.json(
      { error: "Failed to process the request" },
      { status: 500 }
    );
  }
} 