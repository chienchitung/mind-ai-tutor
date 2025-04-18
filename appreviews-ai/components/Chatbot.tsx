'use client'

import { useState, useRef, useEffect } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { SITE_CONTENT } from '../utils/siteContent';
import { useMediaQuery } from 'react-responsive';
import { Bot, Globe } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

// 使用 NEXT_PUBLIC_ 前綴的環境變數
const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

// 只在有 API key 時初始化
let genAI: any = null;
let model: any = null;

if (GEMINI_API_KEY) {
  try {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    model = genAI.getGenerativeModel({
      model: "learnlm-1.5-pro-experimental",
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 512,
        topK: 20,
        topP: 0.8,
      }
    });
  } catch (error) {
    console.error('Failed to initialize Gemini:', error);
  }
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SYSTEM_PROMPT = {
  zh: `你是一個專業的APP評論分析平台助手，具備以下兩種專業能力，請根據問題類型自動切換合適的回答方式：

1. 平台服務諮詢能力：
- 熟悉平台所有功能和操作流程
- 可以解答關於平台使用方式的問題
- 提供付款方案和價格諮詢
- 處理技術支援相關問題
回答風格：專業、親切、具體明確，著重於解決用戶的實際問題

2. 數據分析諮詢能力：
- 熟悉App評論分析流程
- 可以解答關於App評論分析的問題
- 協助分析APP評論數據
- 提供專業的數據解讀和建議
- 找用戶反饋中的關鍵洞察
- 進方向和優化策略
回答風格：數據導向、專業分析、提供可行建議

回答原則：
1. 直接切入問題核心，提供解決方案
2. 保持專業且友善的對話風格
3. 回答要具體且簡潔扼要
4. 適時主動提供延伸建議
5. 如遇不明確的問題，主動詢問細節
6. 不要在回答中提及或說明目前使用哪種角色
7. 不要在回答中提及或說明目前使用哪種專業能力
8. 回答內容不要有 " * "符號
9. 回答請使用繁體中文`,

  en: `You are a professional APP review analysis platform assistant with two professional capabilities. Please switch between appropriate response methods based on the type of question:

1. Platform Service Consultation:
- Familiar with all platform features and processes
- Can answer questions about platform usage
- Provide payment plans and pricing consultation
- Handle technical support issues
Response style: Professional, friendly, specific, focusing on solving users' practical problems

2. Data Analysis Consultation:
- Help analyze APP review data
- Provide professional data interpretation and suggestions
- Find key insights from user feedback
- Provide direction and optimization strategies
Response style: Data-driven, professional analysis, providing actionable suggestions

Response principles:
1. Directly address the core issue and provide solutions
2. Maintain professional and friendly dialogue style
3. Answers should be specific and concise
4. Proactively provide extended suggestions when appropriate
5. For unclear questions, proactively ask for details
6. Do not mention or explain which role is currently being used
7. Do not mention or explain which professional capability is being used
8. Response content should not contain "*" symbols
9. Please respond in English`
};

const getRelevantContent = (query: string, language: string): string => {
  const queryLower = query.toLowerCase();
  let relevantInfo = [];

  // 定義關鍵字映射
  const keywordMappings = {
    pricing: {
      keywords: [
        // 中文關鍵字
        '價格', '方案', '收費', '費用', '付費', '訂閱', '基本版', '專業版', '進階版',
        // 英文關鍵字
        'price', 'pricing', 'plan', 'subscription', 'payment', 'cost', 'fee', 'basic', 'professional', 'premium'
      ],
      getContent: (lang: string) => lang === 'zh' ? `
價格方案詳細資訊：
基本版 ${SITE_CONTENT.pricing.basic.name}（${SITE_CONTENT.pricing.basic.price}）：
${SITE_CONTENT.pricing.basic.features.map(f => `- ${f}`).join('\n')}

專業版 ${SITE_CONTENT.pricing.pro.name}（${SITE_CONTENT.pricing.pro.price}）：
${SITE_CONTENT.pricing.pro.features.map(f => `- ${f}`).join('\n')}` : `
Pricing Plan Details:
Basic Plan ${SITE_CONTENT.pricing.basic.name} (${SITE_CONTENT.pricing.basic.price}):
${SITE_CONTENT.pricing.basic.features.map(f => `- ${f}`).join('\n')}

Professional Plan ${SITE_CONTENT.pricing.pro.name} (${SITE_CONTENT.pricing.pro.price}):
${SITE_CONTENT.pricing.pro.features.map(f => `- ${f}`).join('\n')}`
    },
    scraper: {
      keywords: [
        // 中文關鍵字
        '爬取', '收集', '下載', '資料來源', 'app store', 'play store',
        // 英文關鍵字
        'scrape', 'collect', 'download', 'data source', 'crawl', 'fetch', 'gather'
      ],
      getContent: (lang: string) => lang === 'zh' ? `
資料爬取功能說明：
${SITE_CONTENT.features.scraper.description}
使用方式：${SITE_CONTENT.features.scraper.usage}
費用說明：${SITE_CONTENT.features.scraper.pricing}` : `
Data Scraping Feature:
${SITE_CONTENT.features.scraper.description}
How to use: ${SITE_CONTENT.features.scraper.usage}
Pricing: ${SITE_CONTENT.features.scraper.pricing}`
    },
    analysis: {
      keywords: [
        // 中文關鍵字
        '分析', '報告', '見解', '洞察', '統計', '圖表', '儀表板', '情感分析', '關鍵字',
        // 英文關鍵字
        'analysis', 'report', 'insight', 'statistics', 'chart', 'dashboard', 'sentiment', 'keyword', 'analytics', 'analyze'
      ],
      getContent: (lang: string) => lang === 'zh' ? `
數據分析功能說明：
${SITE_CONTENT.features.analysis.description}

分析功能包含：
${SITE_CONTENT.features.analysis.features.map(f => `- ${f}`).join('\n')}

使用方式：${SITE_CONTENT.features.analysis.usage}` : `
Data Analysis Features:
${SITE_CONTENT.features.analysis.description}

Analysis Features Include:
${SITE_CONTENT.features.analysis.features.map(f => `- ${f}`).join('\n')}

How to use: ${SITE_CONTENT.features.analysis.usage}`
    },
    search: {
      keywords: [
        // 中文關鍵字
        '搜尋', '查詢', '找', '過濾', '篩選',
        // 英文關鍵字
        'search', 'query', 'find', 'filter', 'browse', 'look up', 'lookup'
      ],
      getContent: (lang: string) => lang === 'zh' ? `
搜尋功能說明：
${SITE_CONTENT.features.search.description}
使用方式：${SITE_CONTENT.features.search.usage}` : `
Search Feature:
${SITE_CONTENT.features.search.description}
How to use: ${SITE_CONTENT.features.search.usage}`
    },
    support: {
      keywords: [
        // 中文關鍵字
        '聯絡', '客服', '支援', '幫助', '問題', '聯繫', '電話', 'email', '信箱',
        // 英文關鍵字
        'contact', 'support', 'help', 'issue', 'phone', 'email', 'service', 'assistance'
      ],
      getContent: (lang: string) => lang === 'zh' ? `
客服支援資訊：
- 客服信箱：${SITE_CONTENT.support.contact.email}
- 服務電話：${SITE_CONTENT.support.contact.phone}
- 服務時間：${SITE_CONTENT.support.contact.hours}

常見問題：
${SITE_CONTENT.support.faq.map(faq => `Q: ${faq.question}\nA: ${faq.answer}`).join('\n\n')}` : `
Customer Support Information:
- Support Email: ${SITE_CONTENT.support.contact.email}
- Service Phone: ${SITE_CONTENT.support.contact.phone}
- Service Hours: ${SITE_CONTENT.support.contact.hours}

FAQ:
${SITE_CONTENT.support.faq.map(faq => `Q: ${faq.question}\nA: ${faq.answer}`).join('\n\n')}`
    }
  };

  // 檢查每個類別的關鍵字
  Object.entries(keywordMappings).forEach(([category, { keywords, getContent }]) => {
    if (keywords.some(keyword => queryLower.includes(keyword))) {
      relevantInfo.push(getContent(language));
    }
  });

  // 如果沒有找到相關內容，返回基本平台介紹
  if (relevantInfo.length === 0) {
    relevantInfo.push(language === 'zh' ? `
平台基本介紹：
我們的平台提供以下核心功能：
1. ${SITE_CONTENT.features.scraper.title}：${SITE_CONTENT.features.scraper.description}
2. ${SITE_CONTENT.features.analysis.title}：${SITE_CONTENT.features.analysis.description}
3. ${SITE_CONTENT.features.search.title}：${SITE_CONTENT.features.search.description}` : `
Platform Introduction:
Our platform provides the following core features:
1. ${SITE_CONTENT.features.scraper.title}: ${SITE_CONTENT.features.scraper.description}
2. ${SITE_CONTENT.features.analysis.title}: ${SITE_CONTENT.features.analysis.description}
3. ${SITE_CONTENT.features.search.title}: ${SITE_CONTENT.features.search.description}`);
  }

  return relevantInfo.join('\n\n');
};

// 新增快速問題按鈕介面
interface QuickQuestion {
  text: string;
  question: string;
  path?: string;
}

// 修改 QUICK_QUESTIONS，添加中英文支援
const QUICK_QUESTIONS: {
  [key: string]: QuickQuestion[];
} = {
  zh: [
    {
      text: "爬取評論教學",
      question: "請問如何開始爬取APP評論數據？",
      path: "/scraper"
    },
    {
      text: "分析功能介紹",
      question: "想了解數據分析功能有哪些？",
      path: "/analysis"
    },
    {
      text: "查詢方案價格",
      question: "請問有什麼價格方案？",
      path: "/pricing"
    }
  ],
  en: [
    {
      text: "Scraping Tutorial",
      question: "How do I start scraping APP review data?",
      path: "/scraper"
    },
    {
      text: "Analysis Features",
      question: "What analysis features are available?",
      path: "/analysis"
    },
    {
      text: "Pricing Plans",
      question: "What pricing plans are available?",
      path: "/pricing"
    }
  ]
};

const SCROLL_AMOUNT = 200; // 每次滾動的像素數

const Chatbot = () => {
  const { language, setLanguage, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [isQuickQuestionsOpen, setIsQuickQuestionsOpen] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const quickQuestionsRef = useRef<HTMLDivElement>(null);
  const [showScrollButtons, setShowScrollButtons] = useState({
    left: false,
    right: false,
  });

  const checkScrollButtons = () => {
    if (quickQuestionsRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = quickQuestionsRef.current;
      setShowScrollButtons({
        left: scrollLeft > 0,
        right: scrollLeft < scrollWidth - clientWidth - 10,
      });
    }
  };

  const handleScroll = (direction: 'left' | 'right') => {
    if (quickQuestionsRef.current) {
      const newScrollLeft = quickQuestionsRef.current.scrollLeft + 
        (direction === 'left' ? -SCROLL_AMOUNT : SCROLL_AMOUNT);
      quickQuestionsRef.current.scrollTo({
        left: newScrollLeft,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    const currentRef = quickQuestionsRef.current;
    if (currentRef) {
      checkScrollButtons();
      currentRef.addEventListener('scroll', checkScrollButtons);
      window.addEventListener('resize', checkScrollButtons);
    }
    
    return () => {
      if (currentRef) {
        currentRef.removeEventListener('scroll', checkScrollButtons);
      }
      window.removeEventListener('resize', checkScrollButtons);
    };
  }, []);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: inputMessage
    };

    setInputMessage('');
    setMessages(prev => [...prev, userMessage]);
    
    try {
      setIsLoading(true);
      
      if (!GEMINI_API_KEY || !model) {
        throw new Error(language === 'zh' 
          ? 'AI 服務尚未設定完成，請聯繫管理員。' 
          : 'AI service is not configured, please contact administrator.');
      }

      const relevantContent = getRelevantContent(inputMessage, language);

      const prompt = `
${SYSTEM_PROMPT[language]}

相關平台資訊：
${relevantContent}

用戶歷史對話：
${messages.map(msg => `${msg.role === 'user' ? '用戶' : 'AI助手'}: ${msg.content}`).join('\n')}

當前用戶問題：
${userMessage.content}

請根據以上資訊和角色定位進行回答，優先使用提供的平台資訊來回答：`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      const aiMessage: Message = {
        role: 'assistant',
        content: text
      };
      
      setMessages(prev => [...prev, aiMessage]);

    } catch (error) {
      console.error('Chatbot Error:', {
        error,
        hasApiKey: !!GEMINI_API_KEY,
        hasModel: !!model,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });

      let errorMessage = language === 'zh' 
        ? '抱歉，系統暫時無法處理您的請求。' 
        : 'Sorry, the system is temporarily unable to process your request.';
      
      if (!GEMINI_API_KEY || !model) {
        errorMessage = language === 'zh'
          ? 'AI 服務尚未設定完成，請聯繫管理員。'
          : 'AI service is not configured, please contact administrator.';
      } else if (error instanceof Error) {
        errorMessage += language === 'zh'
          ? '\n錯誤詳情：' + error.message
          : '\nError details: ' + error.message;
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: errorMessage
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleQuickQuestion = (item: QuickQuestion) => {
    setInputMessage(item.question);
  };

  const isMobile = useMediaQuery({ maxWidth: 768 });

  // 修改開關視窗的處理函數
  const handleToggleChat = () => {
    setIsOpen(!isOpen);
    // 只在開啟時重置快速問題區域的狀態
    if (!isOpen) {
      setIsQuickQuestionsOpen(true);
    }
  };

  // 修改清除對話紀錄的功能
  const handleClearChat = () => {
    setMessages([{
      role: 'assistant',
      content: language === 'zh' 
        ? '您好！我是您的 AI小助手。我可以：\n1. 協助您了解平台功能與操作方式\n2. 提供專業的數據分析建議\n\n請問有什麼我可以幫您的嗎？'
        : 'Hello! I am your AI assistant. I can:\n1. Help you understand platform features and operations\n2. Provide professional data analysis advice\n\nHow may I assist you?'
    }]);
  };

  // 新增一個 ref 來追蹤訊息容器
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 新增滾動到底部的函數
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 當訊息新時自動滾動到底部
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 新增背景滾動鎖定的 effect
  useEffect(() => {
    if (isOpen && isMobile) {
      // 鎖定背景滾動
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      // 解除背景滾動鎖定
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }
    
    // 組件卸載時解除鎖定
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [isOpen, isMobile]);

  // 添加語言切換函數
  const toggleLanguage = () => {
    setLanguage(language === 'zh' ? 'en' : 'zh');
  };

  // 初始化對話訊息
  useEffect(() => {
    setMessages([{
      role: 'assistant',
      content: language === 'zh' 
        ? '您好！我是您的 AI小助手。我可以：\n1. 協助您了解平台功能與操作方式\n2. 提供專業的數據分析建議\n\n請問有什麼我可以幫您的嗎？'
        : 'Hello! I am your AI assistant. I can:\n1. Help you understand platform features and operations\n2. Provide professional data analysis advice\n\nHow may I assist you?'
    }]);
  }, [language]);

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-[95vw]">
      <button
        onClick={handleToggleChat}
        className={`
          bg-blue-500 hover:bg-blue-600 text-white rounded-full p-3 
          shadow-lg transition-all duration-200
          ${isMobile && isOpen ? 'hidden' : ''}
        `}
      >
        {isOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        )}
      </button>

      {isOpen && (
        <div className={`
          ${isMobile 
            ? 'fixed inset-0 w-full h-full pb-[100px]'
            : 'absolute bottom-16 right-0 w-[320px] sm:w-[380px] max-h-[80vh]'
          }
          bg-white rounded-lg shadow-xl border border-gray-200
          ${isMobile ? 'rounded-none' : ''}
          animate-scaleIn transform-gpu
        `}>
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Bot className="h-5 w-5 text-blue-500" />
              {language === 'zh' ? 'AI小助手' : 'AI Assistant'}
            </h3>
            <div className="flex items-center gap-2">
              {/* 添加語言切換按鈕 */}
              <button
                onClick={toggleLanguage}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-500"
                title={language === 'zh' ? '切換至英文' : 'Switch to Chinese'}
              >
                <Globe className="h-5 w-5" />
              </button>
              {/* 清除對話按鈕 */}
              <button
                onClick={handleClearChat}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-500"
                title={language === 'zh' ? '清除對話' : 'Clear Chat'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              {isMobile && (
                <button
                  onClick={handleToggleChat}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          <div className={`
            overflow-y-auto p-4 transition-all duration-300
            ${isMobile 
              ? isQuickQuestionsOpen 
                ? 'h-[calc(100vh-400px)]'
                : 'h-[calc(100vh-280px)]'
              : isQuickQuestionsOpen 
                ? 'max-h-[calc(60vh-180px)]'
                : 'max-h-[calc(60vh-120px)]'
            }
          `}>
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div key={index} className={`flex items-start ${message.role === 'user' ? 'justify-end' : ''}`}>
                  <div className={`rounded-lg p-3 max-w-[85%] ${
                    message.role === 'user' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex items-start">
                  <div className="bg-gray-100 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  </div>
                </div>
              )}
              {/* 新增一個空的 div 作為滾動目標 */}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="border-t border-gray-200">
            <button
              onClick={() => setIsQuickQuestionsOpen(!isQuickQuestionsOpen)}
              className="w-full px-4 py-2 flex items-center justify-between text-sm text-gray-600 hover:bg-gray-50"
            >
              <span>{language === 'zh' ? '快速問題' : 'Quick Questions'}</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-4 w-4 transition-transform duration-300 ${
                  isQuickQuestionsOpen ? 'transform rotate-180' : ''
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            <div className={`
              overflow-hidden transition-all duration-300
              ${isQuickQuestionsOpen 
                ? 'h-[80px] opacity-100' 
                : 'h-0 opacity-0'
              }
            `}>
              <div 
                ref={quickQuestionsRef}
                className="overflow-x-auto scrollbar-hide h-full"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                <div className="flex gap-2 w-max px-2 py-2">
                  {QUICK_QUESTIONS[language].map((item, index) => (
                    <button
                      key={index}
                      onClick={() => handleQuickQuestion(item)}
                      disabled={isLoading}
                      className={`
                        whitespace-nowrap
                        bg-gray-50 hover:bg-gray-100 
                        text-gray-700 text-sm 
                        px-4 py-2
                        rounded-lg 
                        transition-colors duration-200 
                        flex items-center gap-2
                        border border-gray-200 hover:border-gray-300
                        ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                    >
                      <span>{item.text}</span>
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        className="h-4 w-4 text-gray-400" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M9 5l7 7-7 7" 
                        />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-gray-200">
            <div className="flex space-x-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={language === 'zh' ? "輸入訊息..." : "Type a message..."}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                disabled={isLoading}
              />
              <button 
                onClick={handleSendMessage}
                disabled={isLoading || !inputMessage.trim()}
                className={`shrink-0 text-white px-4 py-2 rounded-lg ${
                  isLoading || !inputMessage.trim()
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-blue-500 hover:bg-blue-600'
                }`}
              >
                {language === 'zh' ? '發送' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chatbot; 