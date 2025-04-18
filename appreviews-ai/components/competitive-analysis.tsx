'use client';

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  LineChart,
  Line,
} from "recharts"
import { ChevronDown, ChevronUp, Star, Download, Filter, ArrowLeft, Copy, Check, ThumbsUp, ThumbsDown, Minus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchResult } from './types'
import { utils as xlsxUtils, write as xlsxWrite } from 'xlsx';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableCell,
  TableBody
} from "./ui/table"
import { Star as StarIcon } from "lucide-react"
import { CalendarIcon } from "lucide-react"
import { ChevronDownIcon } from "lucide-react"

interface AppInfo {
  platform: string;
  app_name: string;
  category: string;
  developer: string;
  rating: string;
  rating_count: string;
  price: string;
  icon_url: string;
  version: string;
  update_date: string;
  ios_similar_app: string | null;
  similarity: string | null;
  reviews?: Review[];
}

interface AppData {
  id: string;
  name: string;
  logo: string;
  iosRating: number;
  androidRating: number;
  iosReviews: number;
  androidReviews: number;
  version: string;
  lastUpdate: string;
  appStoreUrl: string;
  playStoreUrl: string;
  appInfo?: {
    ios?: AppInfo;
    android?: AppInfo;
  };
  features?: {
    core: string[];
    advantages: string[];
    improvements: string[];
  };
  reviews: {
    positive: Review[];
    neutral: Review[];
    negative: Review[];
  };
  uxScores: {
    memberlogin: number;
    search: number;
    product: number;
    checkout: number;
    service: number;
    other: number;
  };
  reviewStats: {
    positive: number;
    neutral: number;
    negative: number;
  };
  keywordFrequency: { keyword: string; count: number }[];
  reviewAnalysis?: {
    advantages: string[];
    improvements: string[];
    summary: string;
  };
  processedReviews: Review[];
  uxAnalysis?: {
    strengths: string[];
    improvements: string[];
    summary: string;
  };
  comparisonData?: {
    core_feature: string;
    unique_selling_point: string;
    main_advantage: string;
    main_disadvantage: string;
    total_score: number;
    positioning_matrix?: {
      satisfaction_score: number; // 用戶滿意度得分 (0-100)
      completeness_score: number; // 功能完整性得分 (0-100)
      market_position: string; // 市場定位描述
    };
  };
  improvementSuggestions?: {
    urgent_improvements?: {
      title: string;
      description: string;
      suggestions: string[];
    }[];
    functional_areas?: {
      area: string;
      suggestions: {
        title: string;
        description: string;
      }[];
    }[];
    expected_results?: string[];
  };
}

interface Review {
  date: string;
  username: string;
  review: string;
  rating: number;
  platform: string;
  developerResponse?: string;
  language: string;
  app_id: string;
  sentiment: string[];
  category: string[];
  keywords: string[];
}

interface ReviewData {
  app_id: string;
  reviews: Review[];
}

interface CompetitiveAnalysisProps {
  selectedApps?: SearchResult[];
  onGoBack: () => void;
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8", "#82CA9D"]

// 修改格式化評論數的函數
const formatReviewCount = (count: number): string => {
  if (count >= 100000) {
    return `${Math.floor(count / 10000)}萬`;
  } else if (count >= 10000) {
    return `${(count / 10000).toFixed(1)}萬`;
  }
  return count.toLocaleString();
};

// 計算每個類別的評分 (0-100)
const calculateCategoryScore = (reviews: Review[], category: string): number => {
  const categoryReviews = reviews.filter(review => review.category.includes(category));
  if (categoryReviews.length === 0) return 0;

  const weightedScore = categoryReviews.reduce((acc: number, review: Review) => {
    const sentimentWeight = review.sentiment.includes('正面') ? 1 : 
                          review.sentiment.includes('負面') ? -1 : 0;
    const ratingWeight = (review.rating / 5) * 100;
    return acc + (sentimentWeight * ratingWeight);
  }, 0);

  const maxPossibleScore = categoryReviews.length * 100;
  const normalizedScore = ((weightedScore + maxPossibleScore) / (2 * maxPossibleScore)) * 100;
  return Math.round(normalizedScore);
};

// 計算情感分析統計
const calculateSentimentStats = (reviews: Review[]) => {
  const total = reviews.length;
  if (total === 0) {
    return {
      positive: 0,
      neutral: 0,
      negative: 0
    };
  }
  
  const positive = reviews.filter(r => r.sentiment && r.sentiment.includes('正面')).length;
  const negative = reviews.filter(r => r.sentiment && r.sentiment.includes('負面')).length;
  const neutral = total - positive - negative;

  return {
    positive: Math.round((positive / total) * 100),
    neutral: Math.round((neutral / total) * 100),
    negative: Math.round((negative / total) * 100)
  };
};

// 提取代表性評論
const extractRepresentativeReviews = (reviews: Review[], sentiment: string): Review[] => {
  return reviews
    .filter(r => r.sentiment && r.sentiment.includes(sentiment))
    .sort((a: Review, b: Review) => b.rating - a.rating)
    .slice(0, 3);
};

// 計算關鍵詞頻率
const calculateKeywordFrequency = (reviews: Review[]): { keyword: string; count: number }[] => {
  const keywordCount: { [key: string]: number } = {};
  reviews.forEach(review => {
    if (review.keywords) {
      review.keywords.forEach(keyword => {
        keywordCount[keyword] = (keywordCount[keyword] || 0) + 1;
      });
    }
  });
  return Object.entries(keywordCount)
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
};

// 計算評論平均分數
const calculateAverageRating = (reviews: Review[]): number => {
  if (reviews.length === 0) return 0;
  const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
  return Number((totalRating / reviews.length).toFixed(1));
};

const analyzeAppFeatures = async (app: AppData) => {
  try {
    // 檢查必要參數是否存在
    if (!app || !app.name) {
      console.warn('缺少必要參數，無法進行應用程式功能分析');
      return {
        core: ['應用資料不完整'],
        advantages: ['無法進行分析'],
        improvements: ['請確保應用資料完整']
      };
    }

    const prompt = `分析以下應用程式的功能特點：

應用名稱：${app.name || '未知'}
類別：${app.appInfo?.ios?.category || app.appInfo?.android?.category || '未知'}
開發者：${app.appInfo?.ios?.developer || app.appInfo?.android?.developer || '未知'}
評分：iOS ${app.iosRating || 0}，Android ${app.androidRating || 0}
評論數：iOS ${app.iosReviews || 0}，Android ${app.androidReviews || 0}
版本：${app.version || '未知'}
最後更新：${app.lastUpdate || '未知'}

請使用繁體中文回答。請直接以 JSON 格式回覆，不要加入任何其他格式或說明文字：
{
  "core": [
    "列出3-5點主要功能",
    "每點描述不超過50字",
    "..."
  ],
  "advantages": [
    "列出2-3點競爭優勢",
    "每點描述不超過50字",
    "..."
  ],
  "improvements": [
    "列出2-3點待改進項目",
    "每點描述不超過50字",
    "..."
  ]}`;

    console.log(`[analyzeAppFeatures] 開始分析應用 ${app.name} 的功能特點`);

    // 使用 .catch 處理可能的網絡錯誤
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        model: 'gemini-2.0-flash'
      }),
    }).catch(err => {
      console.error('[analyzeAppFeatures] API 請求失敗:', err);
      throw new Error('分析 API 請求失敗');
    });

    if (!response || !response.ok) {
      const errorText = response ? await response.text().catch(() => 'Unknown error') : 'No response';
      console.error(`[analyzeAppFeatures] 分析請求失敗: ${response?.status || 'unknown status'}`, errorText);
      throw new Error(`分析請求失敗: ${response?.status || 'unknown error'}`);
    }

    // 使用 .catch 處理 JSON 解析錯誤
    const data = await response.json().catch(err => {
      console.error('[analyzeAppFeatures] 解析 API 回應時出錯:', err);
      throw new Error('API 回應格式不正確');
    });

    if (!data || data.error) {
      console.error('[analyzeAppFeatures] API 回應包含錯誤:', data?.error || 'Unknown API error');
      throw new Error(data?.error || '分析處理出錯');
    }

    // 檢查 data.response 是否存在
    if (!data.response) {
      console.error('[analyzeAppFeatures] API 回應缺少 response 欄位');
      throw new Error('API 回應不完整');
    }

    try {
      // 清理回應內容，移除可能的 Markdown 格式
      const cleanResponse = data.response
        .replace(/\`\`\`json\n?/g, '')  // 移除 ```json
        .replace(/\`\`\`\n?/g, '')      // 移除 ```
        .trim();                         // 移除前後空白

      console.log(`[analyzeAppFeatures] ${app.name} 的功能分析結果:`, cleanResponse.substring(0, 100) + '...');

      // 嘗試解析清理後的 JSON
      const parsedResponse = JSON.parse(cleanResponse);
      
      // 提供默認值並確保結果格式正確
      return {
        core: Array.isArray(parsedResponse.core) && parsedResponse.core.length > 0 
          ? parsedResponse.core.slice(0, 5) 
          : ['功能資訊暫無'],
        advantages: Array.isArray(parsedResponse.advantages) && parsedResponse.advantages.length > 0 
          ? parsedResponse.advantages.slice(0, 3) 
          : ['優勢資訊暫無'],
        improvements: Array.isArray(parsedResponse.improvements) && parsedResponse.improvements.length > 0 
          ? parsedResponse.improvements.slice(0, 3) 
          : ['改進建議暫無']
      };
    } catch (parseError) {
      console.error('[analyzeAppFeatures] 解析 AI 回應時發生錯誤:', parseError, 'Raw response:', data.response);
      // 返回預設值而非拋出異常
      return {
        core: ['功能分析處理中...'],
        advantages: ['優勢分析處理中...'],
        improvements: ['改進建議處理中...']
      };
    }
  } catch (error) {
    console.error('[analyzeAppFeatures] 分析應用程式功能時發生錯誤:', error);
    // 返回預設值
    return {
      core: ['暫時無法取得功能資訊'],
      advantages: ['暫時無法取得優勢資訊'],
      improvements: ['暫時無法取得改進建議']
    };
  }
};

const analyzeReviews = async (app: AppData) => {
  try {
    // 準備所有評論數據
    const allReviews = app.processedReviews || [];
    
    if (allReviews.length === 0) {
      return {
        advantages: ['尚無評論資料可供分析'],
        improvements: ['尚無評論資料可供分析'],
        summary: '目前尚無足夠的評論資料進行分析。'
      };
    }

    // 確保所有評論都有sentiment屬性
    const validReviews = allReviews.filter(r => r && r.sentiment && r.review);
    
    if (validReviews.length === 0) {
      return {
        advantages: ['尚無有效評論資料可供分析'],
        improvements: ['尚無有效評論資料可供分析'],
        summary: '目前尚無足夠的有效評論資料進行分析。'
      };
    }

    const positiveReviews = validReviews.filter(r => r.sentiment.includes('正面'));
    const negativeReviews = validReviews.filter(r => r.sentiment.includes('負面'));

    // 限制評論數量，防止提示文本過長
    const maxReviewsToInclude = 100; // 最多包含100條評論
    const limitedReviews = validReviews.slice(0, maxReviewsToInclude);

    console.log(`[analyzeReviews] 開始分析應用 ${app.name} 的評論，評論總數: ${validReviews.length}，使用評論數: ${limitedReviews.length}`);

    const prompt = `分析以下應用程式 ${app.name} 的用戶評論：

評分統計：
- 總評分：${app.iosRating || app.androidRating}
- 總評論數：${validReviews.length}${validReviews.length > maxReviewsToInclude ? ` (僅使用前${maxReviewsToInclude}條進行分析)` : ''}
- 正面評論數：${positiveReviews.length}
- 負面評論數：${negativeReviews.length}

所有評論內容：
${limitedReviews.map(review => `- 評分：${review.rating}，評論：${review.review?.substring(0, 500) || '無內容'}`).join('\n')}

請使用繁體中文回答。請根據以上評論進行深入分析，並以 JSON 格式回覆以下內容：
{
  "advantages": [
    "列出3-5點主要優勢，每點不超過50字",
    "每點根據用戶實際評論內容歸納",
    "重點突出用戶最認可的功能或特點"
  ],
  "improvements": [
    "列出3-5點具體待改進項目，每點不超過50字",
    "每點必須基於用戶實際反饋",
    "優先列出影響用戶體驗的關鍵問題"
  ],
  "summary": "整體分析摘要，總結用戶反饋的核心觀點，並提供具體的改進方向建議。長度200字。"
}

【重要提示】：
1. 請確保回覆是有效的 JSON 格式，不要添加額外的標記或說明
2. 請在 JSON 中正確轉義所有特殊字符，尤其是雙引號 (") 應轉義為 (\\\")
3. 文本內容中如包含引號，請使用轉義符號 \\\" 處理
4. 不要在回覆中使用 markdown 語法或代碼塊
5. 僅提供乾淨的 JSON 響應，沒有其他內容`;

    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        model: 'gemini-2.0-flash'
      }),
    });

    if (!response.ok) {
      console.error(`[analyzeReviews] 請求失敗: ${response.status} ${response.statusText}`);
      throw new Error('分析請求失敗');
    }

    const data = await response.json();
    if (data.error) {
      console.error(`[analyzeReviews] API 回應錯誤:`, data.error);
      throw new Error(data.error);
    }

    let parsedResponse;
    try {
      const cleanResponse = data.response
        .replace(/\`\`\`json\n?/g, '')
        .replace(/\`\`\`\n?/g, '')
        .trim();

      console.log(`[analyzeReviews] ${app.name} 的評論分析結果:`, cleanResponse.substring(0, 100) + '...');

      try {
        // 嘗試直接解析
        parsedResponse = JSON.parse(cleanResponse);
      } catch (initialParseError) {
        console.warn('[analyzeReviews] 初次解析失敗，嘗試修復未轉義的引號');
        
        // 修復未轉義的引號
        const fixedJson = cleanResponse
          // 處理引號問題，先將明顯的文本引號轉義
          .replace(/:\s*"([^"]*)"/g, function(match: string, p1: string) {
            // 將字段值內的雙引號轉義，但保留字段名稱和值邊界的雙引號
            return ': "' + p1.replace(/"/g, '\\"') + '"';
          });
        
        parsedResponse = JSON.parse(fixedJson);
      }
      
      if (!parsedResponse.advantages || !parsedResponse.improvements || !parsedResponse.summary) {
        console.error(`[analyzeReviews] 分析結果格式不完整:`, parsedResponse);
        throw new Error('分析結果格式不完整');
      }

      return {
        advantages: parsedResponse.advantages,
        improvements: parsedResponse.improvements,
        summary: parsedResponse.summary
      };
    } catch (parseError) {
      console.error('[analyzeReviews] 解析 AI 回應時發生錯誤:', parseError, 'Raw response:', data.response);
      // 返回預設值而不是拋出錯誤，避免整個流程中斷
      return {
        advantages: ['暫時無法解析評論分析結果'],
        improvements: ['暫時無法解析評論分析結果'],
        summary: '由於 AI 回應格式問題，暫時無法提供詳細分析。請稍後再試。'
      };
    }
  } catch (error) {
    console.error('[analyzeReviews] 分析評論時發生錯誤:', error);
    return {
      advantages: ['暫時無法取得分析結果'],
      improvements: ['暫時無法取得分析結果'],
      summary: '暫時無法取得分析結果，請稍後再試。'
    };
  }
};

// 新增用戶體驗分析函數
const analyzeUserExperience = async (app: AppData) => {
  try {
    console.log(`[analyzeUserExperience] 開始分析應用 ${app.name} 的用戶體驗`);
    
    const prompt = `分析以下應用程式的用戶體驗數據：

應用名稱：${app.name}
用戶體驗評分：
- 會員登入: ${app.uxScores.memberlogin}%
- 搜尋功能: ${app.uxScores.search}%
- 商品相關: ${app.uxScores.product}%
- 結帳付款: ${app.uxScores.checkout}%
- 客戶服務: ${app.uxScores.service}%
- 其他功能: ${app.uxScores.other}%

請使用繁體中文回答。根據以上數據，分析該應用程式的用戶體驗優勢與待改進項目。直接以 JSON 格式回覆，不要加入任何其他格式或說明文字：
{
  "strengths": [
    "列出2-3點主要優勢",
    "每點不超過30字",
    "根據評分較高的項目分析"
  ],
  "improvements": [
    "列出2-3點待改進項目",
    "每點不超過30字",
    "根據評分較低的項目分析"
  ],
  "summary": "整體用戶體驗摘要，不超過100字"
}

【重要提示】：
1. 請確保回覆是有效的 JSON 格式，不要添加額外的標記或說明
2. 請在 JSON 中正確轉義所有特殊字符，尤其是雙引號 (") 應轉義為 (\\\")
3. 文本內容中如包含引號，請使用轉義符號 \\\" 處理
4. 不要在回覆中使用 markdown 語法或代碼塊
5. 僅提供乾淨的 JSON 響應，沒有其他內容`;

    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        model: 'gemini-2.0-flash'
      }),
    });

    if (!response.ok) {
      console.error(`[analyzeUserExperience] 請求失敗: ${response.status} ${response.statusText}`);
      throw new Error('分析請求失敗');
    }

    const data = await response.json();
    if (data.error) {
      console.error(`[analyzeUserExperience] API 回應錯誤:`, data.error);
      throw new Error(data.error);
    }

    let parsedResponse;
    try {
      const cleanResponse = data.response
        .replace(/\`\`\`json\n?/g, '')
        .replace(/\`\`\`\n?/g, '')
        .trim();

      console.log(`[analyzeUserExperience] ${app.name} 的用戶體驗分析結果:`, cleanResponse.substring(0, 100) + '...');
      
      try {
        // 嘗試直接解析
        parsedResponse = JSON.parse(cleanResponse);
      } catch (initialParseError) {
        console.warn('[analyzeUserExperience] 初次解析失敗，嘗試修復未轉義的引號');
        
        // 修復未轉義的引號
        const fixedJson = cleanResponse
          // 處理引號問題，先將明顯的文本引號轉義
          .replace(/:\s*"([^"]*)"/g, function(match: string, p1: string) {
            // 將字段值內的雙引號轉義，但保留字段名稱和值邊界的雙引號
            return ': "' + p1.replace(/"/g, '\\"') + '"';
          });
        
        parsedResponse = JSON.parse(fixedJson);
      }
      
      return {
        strengths: parsedResponse.strengths || [],
        improvements: parsedResponse.improvements || [],
        summary: parsedResponse.summary || '暫無分析摘要'
      };
    } catch (parseError) {
      console.error('[analyzeUserExperience] 解析 AI 回應時發生錯誤:', parseError, 'Raw response:', data.response);
      return {
        strengths: ['暫無優勢分析'],
        improvements: ['暫無改進建議'],
        summary: '暫無分析摘要'
      };
    }
  } catch (error) {
    console.error('[analyzeUserExperience] 分析用戶體驗時發生錯誤:', error);
    return {
      strengths: ['暫無優勢分析'],
      improvements: ['暫無改進建議'],
      summary: '暫無分析摘要'
    };
  }
};

const generateComparisonData = async (app: AppData) => {
  try {
    console.log(`[generateComparisonData] 開始為應用 ${app.name} 生成比較數據`);
    
    // 計算用戶滿意度得分 (0-100)
    // 1. 如果篩選後的評論為空，則滿意度和完整性分數為0
    if (!app.processedReviews || app.processedReviews.length === 0) {
      return {
        core_feature: '沒有符合條件的評論',
        unique_selling_point: '沒有符合條件的評論',
        main_advantage: '沒有符合條件的評論',
        main_disadvantage: '沒有符合條件的評論',
        total_score: 0,
        positioning_matrix: {
          satisfaction_score: 0,
          completeness_score: 0,
          market_position: '數據不足'
        }
      };
    }
    
    // 根據篩選後的評論計算平均評分
    let avgRating = 0;
    if (app.processedReviews.length > 0) {
      const sum = app.processedReviews.reduce((sum, review) => sum + review.rating, 0);
      avgRating = sum / app.processedReviews.length;
    } else {
      // 如果沒有評論，則使用商店評分作為備選
      avgRating = ((app.iosRating || 0) + (app.androidRating || 0)) / 2;
    }
    
    const ratingScore = (avgRating / 5) * 100;
    
    // 2. 使用篩選後的正面評價比例
    const positivePercentage = app.reviewStats?.positive || 0;
    
    // 3. 按權重計算總分 (正面評價 60%, 評分 40%)
    const satisfactionScore = Math.min(100, Math.max(0, Math.round(
      positivePercentage * 0.6 + ratingScore * 0.4
    )));

    // 計算功能完整性得分 (0-100)，確保每個屬性都有默認值
    const uxScores = app.uxScores || { 
      memberlogin: 0, 
      search: 0, 
      product: 0, 
      checkout: 0, 
      service: 0, 
      other: 0 
    };
    
    const completenessScore = Math.round(
      (uxScores.memberlogin * 0.35) +
      (uxScores.search * 0.15) +
      (uxScores.product * 0.10) +
      (uxScores.checkout * 0.10) +
      (uxScores.service * 0.10) +
      (uxScores.other * 0.20)
    );

    // 計算總分供排名使用
    const totalScore = Math.round((satisfactionScore + completenessScore) / 2);

    const prompt = `分析以下應用程式的特點：

應用名稱：${app.name || '未知應用'}
類別：${app.appInfo?.ios?.category || app.appInfo?.android?.category || '未知類別'}
評分：iOS ${app.iosRating || 0}，Android ${app.androidRating || 0}
功能特點：${JSON.stringify(app.features || {})}
用戶評論：${JSON.stringify(app.reviewAnalysis || {})}
用戶滿意度：${satisfactionScore}%
功能完整性：${completenessScore}%

請使用繁體中文回答。生成以下內容：
1. 核心功能：最重要的功能特點（限15字內）
2. 獨特賣點：與競品最大的差異化特點（限15字內）
3. 主要優勢：最突出的優勢（限15字內）
4. 主要劣勢：最需要改進的方面（限15字內）
5. 市場定位：根據用戶滿意度(${satisfactionScore}%)和功能完整性(${completenessScore}%)，描述產品的市場定位（限20字內）

請以 JSON 格式回覆，格式如下：
{
  "core_feature": "核心功能描述",
  "unique_selling_point": "獨特賣點描述",
  "main_advantage": "主要優勢描述",
  "main_disadvantage": "主要劣勢描述",
  "market_position": "市場定位描述"
}

【重要提示】：
1. 請確保回覆是有效的 JSON 格式，不要添加額外的標記或說明
2. 請在 JSON 中正確轉義所有特殊字符，尤其是雙引號 (") 應轉義為 (\\\")
3. 文本內容中如包含引號，請使用轉義符號 \\\" 處理
4. 不要在回覆中使用 markdown 語法或代碼塊
5. 僅提供乾淨的 JSON 響應，沒有其他內容`;

    try {
      console.log(`[generateComparisonData] 發送應用 ${app.name} 的比較分析請求，滿意度: ${satisfactionScore}%, 完整性: ${completenessScore}%`);
      
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          model: 'gemini-2.0-flash'
        }),
      });

      if (!response.ok) {
        console.error(`[generateComparisonData] API請求失敗 - 狀態碼: ${response.status}`);
        const errorText = await response.text();
        console.error('[generateComparisonData] API返回錯誤:', errorText);
        throw new Error(`分析請求失敗 (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      console.log('[generateComparisonData] 分析API返回數據:', data);
      
      if (data.error) {
        throw new Error(data.error);
      }

      if (!data.response) {
        console.error('[generateComparisonData] API返回空數據:', data);
        throw new Error('API返回空數據');
      }

      try {
        const cleanResponse = data.response
          .replace(/\`\`\`json\n?/g, '')
          .replace(/\`\`\`\n?/g, '')
          .trim();
          
        console.log('[generateComparisonData] 清理後的響應:', cleanResponse.substring(0, 200) + '...');

        let parsedData;
        try {
          // 嘗試直接解析
          parsedData = JSON.parse(cleanResponse);
        } catch (initialParseError) {
          console.warn('[generateComparisonData] 初次解析失敗，嘗試修復未轉義的引號');
          
          // 修復未轉義的引號
          const fixedJson = cleanResponse
            // 處理引號問題，先將明顯的文本引號轉義
            .replace(/:\s*"([^"]*)"/g, function(match: string, p1: string) {
              // 將字段值內的雙引號轉義，但保留字段名稱和值邊界的雙引號
              return ': "' + p1.replace(/"/g, '\\"') + '"';
            });
          
          try {
            parsedData = JSON.parse(fixedJson);
            console.log('[generateComparisonData] 修復後成功解析JSON');
          } catch (secondParseError) {
            console.warn('[generateComparisonData] 修復後解析仍失敗，嘗試更全面的修復方案');
            
            // 更徹底的修復嘗試
            const moreFixedJson = cleanResponse
              .replace(/```json\n?|```\n?/g, '')
              .replace(/,(\s*[}\]])/g, '$1') // 移除尾隨逗號
              .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":') // 確保屬性名稱有引號
              .replace(/:\s*'([^']*)'/g, ': "$1"') // 將單引號替換為雙引號
              .trim();
            
            parsedData = JSON.parse(moreFixedJson);
            console.log('[generateComparisonData] 更全面修復後成功解析JSON');
          }
        }
        
        console.log('[generateComparisonData] 成功解析JSON數據');

        return {
          ...parsedData,
          total_score: totalScore,
          positioning_matrix: {
            satisfaction_score: satisfactionScore,
            completeness_score: completenessScore,
            market_position: parsedData.market_position || '待分析'
          }
        };
      } catch (parseError) {
        console.error('[generateComparisonData] 解析 Gemini 回應時發生錯誤:', parseError);
        console.error('[generateComparisonData] 原始響應:', data.response);
        
        // 返回預設數據
        return {
          core_feature: '資料解析中...',
          unique_selling_point: '資料解析中...',
          main_advantage: '資料解析中...',
          main_disadvantage: '資料解析中...',
          total_score: totalScore,
          positioning_matrix: {
            satisfaction_score: satisfactionScore,
            completeness_score: completenessScore,
            market_position: '資料解析中...'
          }
        };
      }
    } catch (apiError) {
      console.error('API調用時發生錯誤:', apiError);
      // 返回預設數據
      return {
        core_feature: '資料分析中...',
        unique_selling_point: '資料分析中...',
        main_advantage: '資料分析中...',
        main_disadvantage: '資料分析中...',
        total_score: totalScore,
        positioning_matrix: {
          satisfaction_score: satisfactionScore,
          completeness_score: completenessScore,
          market_position: '資料分析中...'
        }
      };
    }
  } catch (error) {
    console.error('生成比較數據時發生錯誤:', error);
    // 返回預設數據，確保所有必需的欄位都存在
    return {
      core_feature: '資料分析中...',
      unique_selling_point: '資料分析中...',
      main_advantage: '資料分析中...',
      main_disadvantage: '資料分析中...',
      total_score: 0,
      positioning_matrix: {
        satisfaction_score: 0,
        completeness_score: 0,
        market_position: '資料分析中...'
      }
    };
  }
};

const generatePPTContent = async (appData: AppData[]) => {
  try {
    console.log(`[generatePPTContent] 開始為 ${appData.length} 個應用生成簡報內容`);
    
    // Format the date in zh-TW locale
    const currentDate = new Date().toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Prepare the data for Gemini API
    const formattedData = appData.map(app => ({
      name: app.name,
      logo: app.logo,
      ratings: {
        ios: app.iosRating.toFixed(1),
        android: app.androidRating.toFixed(1)
      },
      reviews: {
        count: app.processedReviews.length,
        stats: {
          positive: app.reviewStats.positive,
          negative: app.reviewStats.negative
        },
        analysis: {
          advantages: app.reviewAnalysis?.advantages || [],
          improvements: app.reviewAnalysis?.improvements || [],
          summary: app.reviewAnalysis?.summary || ''
        }
      },
      features: app.features || {
        core: [],
        advantages: [],
        improvements: []
      },
      uxScores: {
        memberlogin: app.uxScores.memberlogin,
        search: app.uxScores.search,
        product: app.uxScores.product,
        checkout: app.uxScores.checkout,
        service: app.uxScores.service,
        other: app.uxScores.other
      },
      uxAnalysis: app.uxAnalysis || {
        strengths: [],
        improvements: [],
        summary: ''
      }
    }));

    const prompt = `分析以下應用程式的競品分析數據，並生成一份完整的簡報內容：

應用程式資料：
${JSON.stringify(formattedData, null, 2)}

請使用繁體中文回答。生成一份結構完整的簡報內容，包含以下章節：
1. 概述
2. 功能比較
3. 用戶體驗分析
4. 評論分析
5. 總結

每個章節需包含：
- 關鍵發現
- 關鍵數據
- 具體建議

請以 JSON 格式回覆，格式如下：
{
  "title": "競品分析報告",
  "date": "${currentDate}",
  "summary": {
    "dataSupport": [
      "請列出3-4個最關鍵的數據指標及其影響"
    ],
    "keyFindings": [
      "各應用在功能與技術方面的差異化優勢",
      "用戶體驗評分的主要差距",
      "用戶反饋的核心痛點"
    ],
    "recommendations": [
      "最優先需要改進的功能領域",
      "提升用戶體驗的關鍵行動項目",
      "長期競爭力提升建議"
    ]
  },
  "apps": [
    {
      "name": "應用名稱",
      "logo": "應用程式圖標URL",
      "ratings": {
        "ios": "iOS 評分",
        "android": "Android 評分"
      },
      "reviews": {
        "count": "評論總數",
        "stats": {
          "positive": "正面評價百分比",
          "negative": "負面評價百分比"
        },
        "analysis": {
          "advantages": ["優勢1", "優勢2", "優勢3"],
          "improvements": ["改進1", "改進2", "改進3"],
          "summary": "整體評論分析摘要"
        }
      },
      "features": {
        "core": ["核心功能1", "核心功能2", "核心功能3"],
        "advantages": ["競爭優勢1", "競爭優勢2"],
        "improvements": ["待改進1", "待改進2"]
      },
      "uxScores": {
        "memberlogin": "會員登入評分",
        "search": "搜尋功能評分",
        "product": "商品相關評分",
        "checkout": "結帳付款評分",
        "service": "客戶服務評分"
      },
      "uxAnalysis": {
        "strengths": ["優勢1", "優勢2", "優勢3"],
        "improvements": ["改進1", "改進2", "改進3"],
        "summary": "用戶體驗分析摘要"
      }
    }
  ]
}`;

    console.log('[generatePPTContent] 發送簡報生成請求');
    
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        model: 'gemini-2.0-flash'
      }),
    });

    if (!response.ok) {
      console.error(`[generatePPTContent] 生成簡報內容失敗: ${response.status} ${response.statusText}`);
      throw new Error(`生成簡報內容失敗: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.error) {
      console.error(`[generatePPTContent] Gemini API 錯誤:`, data.error);
      throw new Error(`Gemini API 錯誤: ${data.error}`);
    }

    try {
      const cleanResponse = data.response
        .replace(/\`\`\`json\n?/g, '')
        .replace(/\`\`\`\n?/g, '')
        .trim();

      console.log(`[generatePPTContent] 成功獲取簡報內容，長度: ${cleanResponse.length}字元`);

      const parsedData = JSON.parse(cleanResponse);
      
      // Validate the parsed data structure
      if (!parsedData.title || !parsedData.date || !Array.isArray(parsedData.apps)) {
        console.error(`[generatePPTContent] 無效的簡報數據格式:`, parsedData);
        throw new Error('無效的簡報數據格式');
      }

      return parsedData;
    } catch (parseError) {
      console.error('[generatePPTContent] 解析 Gemini 回應時發生錯誤:', parseError);
      throw new Error('無法解析 AI 生成的內容');
    }
  } catch (error) {
    console.error('[generatePPTContent] 生成簡報內容時發生錯誤:', error);
    throw error;
  }
};

// Add these helper functions near the top of the file, before the export default function
const calculateCategoryAverage = (apps: AppData[], category: keyof AppData['uxScores']): number => {
  if (!apps || apps.length === 0) return 0;
  const sum = apps.reduce((total, app) => total + (app.uxScores?.[category] || 0), 0);
  return Math.round(sum / apps.length);
};

const getScoreIndicatorColor = (score: number, average: number): { text: string; bg: string } => {
  if (score > average) return { text: 'text-green-600', bg: 'bg-green-600' };
  if (score === average) return { text: 'text-yellow-500', bg: 'bg-yellow-500' };
  return { text: 'text-red-500', bg: 'bg-red-500' };
};

// 修改熱力圖顏色計算函數，改為基於滿意度的說明
const getHeatmapStyle = (score: number, categoryAvg: number): { backgroundColor: string; color: string } => {
  // 計算與平均的差異百分比
  const diff = score - categoryAvg;
  const percentDiff = categoryAvg > 0 ? (diff / categoryAvg) * 100 : 0;
  
  // 顏色分級標準說明：
  // 1. 高滿意度（綠色）：分數高於市場平均值10%以上，表示此功能表現優於市場，提供良好使用體驗
  // 2. 中滿意度（黃色）：分數在市場平均值正負10%範圍內，表示此功能表現接近市場水平
  // 3. 低滿意度（紅色）：分數低於市場平均值10%以上，表示此功能表現不佳，需要改進
  
  // 使用百分比差異判斷 (預設方法)
  if (percentDiff >= 10) { // 高於平均 (>= +10%)
    return { backgroundColor: 'rgba(34, 197, 94, 0.8)', color: 'white' };  // 綠色 - 高滿意度
  } else if (percentDiff >= -10) { // 接近平均 (-10% 到 +10%)
    return { backgroundColor: 'rgba(234, 179, 8, 0.8)', color: 'black' }; // 黃色 - 中滿意度
  } else { // 低於平均 (< -10%)
    return { backgroundColor: 'rgba(239, 68, 68, 0.8)', color: 'white' }; // 紅色 - 低滿意度
  }
  
  // 如需使用固定分數差異判斷，可取消以下註解並註釋上方的百分比判斷
  /*
  if (diff >= 5) { // 高於平均 (>= +5分)
    return { backgroundColor: 'rgba(34, 197, 94, 0.8)', color: 'white' };  // 綠色 - 高滿意度
  } else if (diff >= -5) { // 接近平均 (-5分 到 +5分)
    return { backgroundColor: 'rgba(234, 179, 8, 0.8)', color: 'black' }; // 黃色 - 中滿意度
  } else { // 低於平均 (< -5分)
    return { backgroundColor: 'rgba(239, 68, 68, 0.8)', color: 'white' }; // 紅色 - 低滿意度
  }
  */
};

// Simplify the getScoreTextColor function for better contrast on heatmap
const getScoreTextColor = (score: number): string => {
  return score > 25 ? 'text-black' : 'text-white';
};

export default function CompetitiveAnalysis({ selectedApps = [], onGoBack }: CompetitiveAnalysisProps) {
  const [appData, setAppData] = useState<AppData[]>([])
  const [expandedApps, setExpandedApps] = useState<Record<string, boolean>>({})
  const [expandedReviews, setExpandedReviews] = useState<{ [key: string]: boolean }>({})
  const [selectedTimeframe, setSelectedTimeframe] = useState("1year") // 修改為一年
  const [pendingTimeframe, setPendingTimeframe] = useState("1year") // 待確認的時間範圍
  const [selectedDownloadType, setSelectedDownloadType] = useState("raw_data")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPPTGenerating, setIsPPTGenerating] = useState(false)
  const [pptProgress, setPPTProgress] = useState<{ phase: string; progress: number }>({ phase: '', progress: 0 })
  const [showAnalysisSummary, setShowAnalysisSummary] = useState<string | null>(null)
  const [customStartDate, setCustomStartDate] = useState<string>(new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]) // 修改為一年
  const [customEndDate, setCustomEndDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [pendingStartDate, setPendingStartDate] = useState<string>(new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]) // 待確認的起始日期
  const [pendingEndDate, setPendingEndDate] = useState<string>(new Date().toISOString().split('T')[0]) // 待確認的結束日期
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false)
  const [showDateRangePanel, setShowDateRangePanel] = useState(false) // 控制日期範圍面板的顯示
  const [timeframeView, setTimeframeView] = useState<'daily' | 'monthly' | 'yearly'>('daily')
  // 添加一個強制更新的計數器
  const [forceUpdateCounter, setForceUpdateCounter] = useState(0)
  
  const [reviewFilters, setReviewFilters] = useState({
    timeframe: '1year',  // 修改為一年
    sentiment: 'all',
    sortBy: 'date',
    sortOrder: 'desc'
  })

  const toggleAppDetails = (appId: string) => {
    setExpandedApps(prev => ({
      ...prev,
      [appId]: !prev[appId]
    }));
  }

  const toggleReviewExpand = (reviewId: string) => {
    setExpandedReviews(prev => ({
      ...prev,
      [reviewId]: !prev[reviewId]
    }));
  };

  // 獲取台北時間的函數
  const getTaipeiDate = (date = new Date()): Date => {
    // 創建一個表示台北時區(GMT+8)的日期對象
    // 先獲取UTC時間，然後加上8小時得到台北時間
    const utcDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
    const taipeiDate = new Date(utcDate.getTime() + 8 * 60 * 60 * 1000);
    return taipeiDate;
  };

  // 將日期格式化為YYYY-MM-DD格式的函數
  const formatDateToYYYYMMDD = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 新增函數來計算預設時間範圍的起始和結束日期
  const calculateDateRange = (timeframe: string): [string, string] => {
    // 獲取台北時間的今天
    const today = getTaipeiDate();
    // 獲取台北時間的昨天
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    // 起始日期
    let startDate: Date;
    
    switch(timeframe) {
      case '7days':
        // 過去7天：昨天為止的7天
        startDate = new Date(yesterday);
        startDate.setDate(yesterday.getDate() - 6);
        break;
      case '30days':
        // 過去30天：昨天為止的30天
        startDate = new Date(yesterday);
        startDate.setDate(yesterday.getDate() - 29);
        break;
      case '90days':
        // 過去90天：昨天為止的90天
        startDate = new Date(yesterday);
        startDate.setDate(yesterday.getDate() - 89);
        break;
      case '1year':
        // 過去1年：從去年的今天到昨天
        startDate = new Date(yesterday);
        startDate.setFullYear(yesterday.getFullYear() - 1);
        startDate.setDate(startDate.getDate() + 1); // 調整為完整的一年
        break;
      case 'custom':
        return [pendingStartDate, pendingEndDate];
      default:
        // 預設使用過去1年
        startDate = new Date(yesterday);
        startDate.setFullYear(yesterday.getFullYear() - 1);
        startDate.setDate(startDate.getDate() + 1); // 調整為完整的一年
    }
    
    return [formatDateToYYYYMMDD(startDate), formatDateToYYYYMMDD(yesterday)];
  };

  // 格式化日期顯示
  const formatDateDisplay = (dateString: string): string => {
    const date = new Date(dateString);
    // 轉換為 YYYY/MM/DD 格式
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}/${month}/${day}`;
  };

  // 計算兩個日期之間的天數
  const calculateDaysBetween = (startDate: string, endDate: string): number => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays + 1; // 包含起始日和結束日
  };

  // 當時間範圍改變時更新日期
  useEffect(() => {
    if (pendingTimeframe !== 'custom') {
      const [start, end] = calculateDateRange(pendingTimeframe);
      setPendingStartDate(start);
      setPendingEndDate(end);
    }
  }, [pendingTimeframe]);
  
  // 修改應用時間範圍篩選函數
  const applyDateRangeFilter = () => {
    console.log('應用日期範圍:', pendingTimeframe, pendingStartDate, pendingEndDate);
    
    // 保存當前值以便重新計算
    const newTimeframe = pendingTimeframe;
    const newStartDate = pendingStartDate;
    const newEndDate = pendingEndDate;
    
    // 應用新的日期範圍
    setCustomStartDate(newStartDate);
    setCustomEndDate(newEndDate);
    
    // 調整篩選條件
    setReviewFilters(prev => ({
      ...prev,
      timeframe: newTimeframe
    }));
    
    // 使用暫時值重置然後設置，確保觸發狀態更新
    setSelectedTimeframe('__temp_reset__');
    
    // 使用 setTimeout 確保狀態更新後再繼續
    setTimeout(() => {
      setSelectedTimeframe(newTimeframe);
      
      // 強制更新計數器
      setForceUpdateCounter(prev => prev + 1);
      
      // 關閉面板
      setShowDateRangePanel(false);
      
      // 可以考慮添加一個提示訊息，讓用戶知道篩選已經應用
      console.log('已應用新的日期範圍篩選');
      
      // 如果appData已存在，可以嘗試強制更新它
      if (appData.length > 0) {
        console.log('更新應用數據...');
        // 淺複製以觸發重新渲染
        setAppData([...appData]);
      }
    }, 50);
  };

  // 立即應用所選時間範圍（除自訂日期外）
  const applyTimeframeImmediately = (timeframe: string) => {
    if (timeframe !== 'custom') {
      setPendingTimeframe(timeframe);
      const [start, end] = calculateDateRange(timeframe);
      setPendingStartDate(start);
      setPendingEndDate(end);
      setSelectedTimeframe(timeframe);
      setCustomStartDate(start);
      setCustomEndDate(end);
      setShowDateRangePanel(false);
    } else {
      setPendingTimeframe(timeframe);
      setShowCustomDatePicker(true);
    }
  };

  // 修改 filterReviewsByDate 函數
  const filterReviewsByDate = (reviews: Review[], timeframe: string, appName: string = '') => {
    // 獲取今天和昨天的台北時間
    const today = getTaipeiDate();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    // 起始日期
    let startDate: Date;
    
    switch(timeframe) {
      case '7days':
        // 過去7天：昨天為止的7天
        startDate = new Date(yesterday);
        startDate.setDate(yesterday.getDate() - 6);
        break;
      case '30days':
        // 過去30天：昨天為止的30天
        startDate = new Date(yesterday);
        startDate.setDate(yesterday.getDate() - 29);
        break;
      case '90days':
        // 過去90天：昨天為止的90天
        startDate = new Date(yesterday);
        startDate.setDate(yesterday.getDate() - 89);
        break;
      case '1year':
        // 過去1年：從去年的今天到昨天
        startDate = new Date(yesterday);
        startDate.setFullYear(yesterday.getFullYear() - 1);
        startDate.setDate(startDate.getDate() + 1); // 調整為完整的一年
        break;
      case 'custom':
        // 自訂日期範圍
        const custStartDate = new Date(customStartDate);
        const custEndDate = new Date(customEndDate);
        // 加1天以包含整個結束日
        custEndDate.setDate(custEndDate.getDate() + 1);
        const customFiltered = reviews.filter(review => {
          const reviewDate = new Date(review.date);
          return reviewDate >= custStartDate && reviewDate < custEndDate;
        });
        console.log(`日期篩選 [${appName}]: 自訂日期範圍 - 原始評論數 ${reviews.length}, 篩選後評論數 ${customFiltered.length}`);
        return customFiltered;
      default:
        console.log(`日期篩選 [${appName}]: 使用默認時間範圍 - 原始評論數 ${reviews.length}`);
        return reviews;
    }
    
    // 篩選日期範圍從 startDate 到 yesterday
    const filteredResults = reviews.filter(review => {
      const reviewDate = new Date(review.date);
      return reviewDate >= startDate && reviewDate <= yesterday;
    });
    
    // 修改：使用單一的console.log並移除重複的日誌輸出
    console.log(`日期篩選 [${appName}]: ${timeframe} - 原始評論數 ${reviews.length}, 篩選後評論數 ${filteredResults.length}`);
    
    return filteredResults;
  };

  // 更新 getFilteredReviews 函數，將應用名稱傳遞給 filterReviewsByDate
  const getFilteredReviews = (reviews: Review[], filters: typeof reviewFilters, appName: string = '') => {
    const dateFiltered = filterReviewsByDate(reviews, filters.timeframe, appName);
    const sentimentFiltered = dateFiltered
      .filter(review => {
        if (filters.sentiment === 'all') return true;
        if (filters.sentiment === 'positive') return review.sentiment.includes('正面');
        if (filters.sentiment === 'negative') return review.sentiment.includes('負面');
        return true;
      });
    
    const sorted = sentimentFiltered.sort((a, b) => {
      if (filters.sortBy === 'date') {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return filters.sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      }
      if (filters.sortBy === 'rating') {
        return filters.sortOrder === 'desc' ? b.rating - a.rating : a.rating - b.rating;
      }
      return 0;
    });
    
    return sorted;
  };

  // Update download function
  const handleDownload = async () => {
    if (selectedDownloadType === 'raw_data') {
      try {
        setError(null);
        // Prepare data for Excel
        const excelData = appData.map(app => {
          const filteredReviews = filterReviewsByDate(app.processedReviews, selectedTimeframe);
          return filteredReviews.map(review => ({
            '應用程式': app.name,
            '日期': review.date,
            '評分': review.rating,
            '平台': review.platform,
            '評論內容': review.review,
            '情感分析': review.sentiment.join(', '),
            '分類': review.category.join(', ')
          }));
        }).flat();

        // Create workbook and worksheet
        const worksheet = xlsxUtils.json_to_sheet(excelData);
        const workbook = xlsxUtils.book_new();
        xlsxUtils.book_append_sheet(workbook, worksheet, '評論數據');

        // Auto-size columns
        type RowType = typeof excelData[0];
        const maxWidths: { [key in keyof RowType]: number } = {} as { [key in keyof RowType]: number };
        
        excelData.forEach(row => {
          (Object.keys(row) as Array<keyof RowType>).forEach(key => {
            const cellValue = row[key] ? String(row[key]) : '';
            maxWidths[key] = Math.max(maxWidths[key] || 0, cellValue.length);
          });
        });

        worksheet['!cols'] = (Object.keys(excelData[0]) as Array<keyof RowType>).map(key => ({
          wch: Math.min(Math.max(maxWidths[key], key.length), 50)
        }));

        // Generate Excel file
        const excelBuffer = xlsxWrite(workbook, { 
          bookType: 'xlsx', 
          type: 'array',
          cellStyles: true
        });

        // Create and trigger download
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `app_reviews_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (error) {
        console.error('匯出 Excel 時發生錯誤:', error);
        setError('匯出 Excel 檔案時發生錯誤，請稍後再試。');
      }
    } else if (selectedDownloadType === 'full_report') {
      try {
        setError(null);
        setIsPPTGenerating(true);
        setPPTProgress({ phase: '分析競品數據', progress: 10 });

        if (!appData || appData.length === 0) {
          throw new Error('沒有可用的應用程式數據');
        }

        // Generate enriched content using Gemini
        const pptData = await generatePPTContent(appData);
        
        setPPTProgress({ phase: '生成簡報大綱', progress: 30 });
        
        // Get and validate PPT generator API URL
        let apiUrl = process.env.NEXT_PUBLIC_PPT_GENERATOR_API_URL;
        if (!apiUrl) {
          throw new Error('PPT Generator API URL 未設定，請檢查環境配置');
        }

        // Ensure HTTPS is used and log the URLs
        console.log('Original API URL:', apiUrl);
        let secureApiUrl = apiUrl;
        if (!secureApiUrl.startsWith('https://')) {
          secureApiUrl = secureApiUrl.replace(/^http:\/\//, 'https://');
        }
        secureApiUrl = secureApiUrl.replace(/\/$/, '');
        console.log('Secure API URL:', secureApiUrl);

        const generateUrl = `${secureApiUrl}/generate-ppt`;
        console.log('Generate URL:', generateUrl);

        // Create FormData and append the JSON file
        const formData = new FormData();
        const jsonBlob = new Blob([JSON.stringify(pptData)], { type: 'application/json' });
        formData.append('input_file', jsonBlob, 'data.json');

        // Add API key and CORS headers
        const headers: HeadersInit = {
          'Accept': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        };
        
        const apiKey = process.env.NEXT_PUBLIC_PPT_GENERATOR_API_KEY;
        if (apiKey) {
          headers['Authorization'] = `Bearer ${apiKey}`;
        }

        console.log('Sending request to:', generateUrl);
        
        try {
          const response = await fetch(generateUrl, {
            method: 'POST',
            body: formData,
            mode: 'cors',
            headers,
            credentials: 'omit'
          }).catch(error => {
            console.error('Fetch error:', error);
            throw new Error(`API 請求失敗: ${error.message}`);
          });

          setPPTProgress({ phase: '設計簡報版面', progress: 60 });

          if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error Response:', errorText);
            throw new Error(`PPT 生成失敗: ${response.statusText || '伺服器錯誤'}`);
          }

          const responseData = await response.json();
          console.log('API Response:', responseData);

          if (!responseData.file_path) {
            throw new Error('未收到 PPT 文件的路徑');
          }

          setPPTProgress({ phase: '下載簡報檔案', progress: 90 });

          // Download the PPT file using HTTPS
          const downloadUrl = `${secureApiUrl}/download/${responseData.file_path}`;
          console.log('Download URL:', downloadUrl);
          
          const pptResponse = await fetch(downloadUrl, {
            method: 'GET',
            mode: 'cors',
            credentials: 'omit',
            headers: {
              'Accept': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, OPTIONS',
              'Access-Control-Allow-Headers': '*',
              ...(apiKey && { 'Authorization': `Bearer ${apiKey}` }),
            },
          }).catch(error => {
            console.error('Download error:', error);
            throw new Error(`下載檔案失敗: ${error.message}`);
          });

          if (!pptResponse.ok) {
            const errorText = await pptResponse.text();
            console.error('Download Error Response:', errorText);
            throw new Error('下載 PPT 檔案失敗');
          }

          const blob = await pptResponse.blob();
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `競品分析報告_${new Date().toISOString().split('T')[0]}.pptx`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          
          setPPTProgress({ phase: '下載完成', progress: 100 });
        } catch (apiError) {
          console.error('API 請求或下載過程中發生錯誤:', apiError);
          throw new Error(apiError instanceof Error ? apiError.message : '與伺服器通訊時發生錯誤，請稍後再試');
        }
      } catch (error) {
        console.error('生成 PPT 時發生錯誤:', error);
        setError(error instanceof Error ? error.message : '生成 PPT 時發生錯誤，請稍後再試。');
      } finally {
        setTimeout(() => {
          setIsPPTGenerating(false);
          setPPTProgress({ phase: '', progress: 0 });
        }, 1000);
      }
    }
  };

  // Update useEffect to sync timeframe
  useEffect(() => {
    setReviewFilters(prev => ({
      ...prev,
      timeframe: selectedTimeframe
    }));
  }, [selectedTimeframe]);

  // 添加根據日期篩選重新計算數據的函數
  const recalculateDataWithTimeframe = async (apps: AppData[], skipAIAnalysis: boolean = false): Promise<AppData[]> => {
    if (!apps || apps.length === 0) return [];
    
    console.log(`準備重新計算 ${apps.length} 個應用的時間範圍數據${skipAIAnalysis ? ' (跳過AI分析)' : ''}`);
    
    return Promise.all(apps.map(async app => {
      // 根據選定的時間範圍過濾評論
      const filteredReviews = filterReviewsByDate(app.processedReviews, selectedTimeframe, app.name);
      console.log(`${app.name} - 過濾後評論數: ${filteredReviews.length}`);
      
      // 重新計算各種分析數據
      // 計算各類別評分
      const uxScores = {
        memberlogin: calculateCategoryScore(filteredReviews, '會員登入'),
        search: calculateCategoryScore(filteredReviews, '搜尋功能'),
        product: calculateCategoryScore(filteredReviews, '商品相關'),
        checkout: calculateCategoryScore(filteredReviews, '結帳付款'),
        service: calculateCategoryScore(filteredReviews, '客戶服務'),
        other: calculateCategoryScore(filteredReviews, '其他')
      };

      // 計算情感分析統計
      const reviewStats = calculateSentimentStats(filteredReviews);

      // 提取代表性評論
      const reviews = {
        positive: extractRepresentativeReviews(filteredReviews, '正面'),
        neutral: extractRepresentativeReviews(filteredReviews, '中性'),
        negative: extractRepresentativeReviews(filteredReviews, '負面')
      };

      // 計算關鍵詞頻率
      const keywordFrequency = calculateKeywordFrequency(filteredReviews);
      
      // 如果在初始化過程中（要跳過AI分析），則保留現有的AI分析結果或使用預設空值
      if (skipAIAnalysis) {
        // 重新計算綜合評分
        const totalScore = Object.values(uxScores).reduce((sum, score) => sum + score, 0);
        
        // 返回只有基本數據的app
        return {
          ...app,
          reviews,
          uxScores,
          reviewStats,
          keywordFrequency,
          processedReviews: filteredReviews,
          // 保留已有的AI分析結果（如果有）
          features: app.features,
          reviewAnalysis: app.reviewAnalysis, 
          uxAnalysis: app.uxAnalysis,
          comparisonData: app.comparisonData ? {
            ...app.comparisonData,
            total_score: totalScore
          } : undefined
        };
      }
      
      // 以下是在需要AI分析時執行的代碼（時間範圍變更後）
      
      // 使用 Gemini 分析功能特點
      let features = app.features;
      if (!features) {
        features = await analyzeAppFeatures({
          ...app,
          reviews,
          uxScores,
          reviewStats,
          keywordFrequency,
          processedReviews: filteredReviews
        });
      }

      // 使用 Gemini 分析評論
      let reviewAnalysis = app.reviewAnalysis;
      if (!reviewAnalysis) {
        reviewAnalysis = await analyzeReviews({
          ...app,
          reviews,
          uxScores,
          reviewStats,
          keywordFrequency,
          processedReviews: filteredReviews
        });
      }

      // 使用 Gemini 分析用戶體驗
      let uxAnalysis = app.uxAnalysis;
      if (!uxAnalysis) {
        uxAnalysis = await analyzeUserExperience({
          ...app,
          reviews,
          uxScores,
          reviewStats,
          keywordFrequency,
          processedReviews: filteredReviews
        });
      }
      
      // 重新生成比較數據
      const comparisonData = await generateComparisonData({
        ...app,
        reviews,
        uxScores,
        reviewStats,
        keywordFrequency,
        processedReviews: filteredReviews
      });
      
      // 重新計算綜合評分
      const totalScore = Object.values(uxScores).reduce((sum, score) => sum + score, 0);
      
      // 返回更新後的app數據
      return {
        ...app,
        reviews,
        uxScores,
        reviewStats,
        keywordFrequency,
        processedReviews: filteredReviews,
        features,
        reviewAnalysis,
        uxAnalysis,
        comparisonData: {
          ...comparisonData,
          total_score: totalScore
        }
      };
    }));
  };

  // 修改選擇時間範圍的處理函數，以異步方式處理
  useEffect(() => {
    const updateDataWithTimeframe = async () => {
      if (appData.length > 0) {
        // 檢查是否是由時間範圍變更觸發的（而不是初始加載）
        // 檢查是否已經完成過 AI 分析（而不僅僅是檢查是否有定義）
        const isTimeframeChange = appData.some(app => {
          // 檢查 features 是否已完成（包含核心功能列表）
          const hasFeatures = app.features?.core && Array.isArray(app.features.core) && app.features.core.length > 0;
          
          // 檢查評論分析是否已完成（包含優點列表）  
          const hasReviewAnalysis = app.reviewAnalysis?.advantages && 
                                  Array.isArray(app.reviewAnalysis.advantages) && 
                                  app.reviewAnalysis.advantages.length > 0;
          
          // 檢查用戶體驗分析是否已完成（包含優勢列表）
          const hasUxAnalysis = app.uxAnalysis?.strengths && 
                              Array.isArray(app.uxAnalysis.strengths) && 
                              app.uxAnalysis.strengths.length > 0;
          
          return hasFeatures && hasReviewAnalysis && hasUxAnalysis;
        });
        
        if (isTimeframeChange) {
          // 如果是時間範圍變更（已經完成過初始化），則顯示加載狀態
          setIsAnalyzing(true);
          console.log('時間範圍變更，重新計算數據，顯示加載彈窗...', new Date().toISOString());
        } else {
          // 如果是初始加載，則由 initializeData 函數負責管理加載狀態
          console.log('初始數據加載中，由 initializeData 管理加載狀態', new Date().toISOString());
          return; // 退出，讓 initializeData 處理初始加載
        }
        
        try {
          // 檢查每個應用的評論數據
          appData.forEach((app, index) => {
            console.log(`應用 #${index + 1} ${app.name} - 評論數: ${app.processedReviews?.length || 0}`);
          });

          // 重新從原始資料計算，而不是使用現有的 appData
          if (selectedApps.length > 0) {
            console.log('重新從原始資料計算所有應用評論');
            
            const initializedData: AppData[] = await Promise.all(
              selectedApps.map(async (app) => {
                // 計算評論相關的數據
                const iosReviews = app.appInfo?.ios?.reviews || [];
                const androidReviews = app.appInfo?.android?.reviews || [];
                const allReviews = [...iosReviews, ...androidReviews];
                
                console.log(`${app.name} - 原始評論數: iOS=${iosReviews.length}, Android=${androidReviews.length}, 總共=${allReviews.length}`);

                // 返回帶有完整評論的初始化資料
                return {
                  id: app.id,
                  name: app.name,
                  logo: app.appInfo?.ios?.icon_url || app.appInfo?.android?.icon_url || '',
                  iosRating: parseFloat(app.appInfo?.ios?.rating || '0'),
                  androidRating: parseFloat(app.appInfo?.android?.rating || '0'),
                  iosReviews: parseInt(app.appInfo?.ios?.rating_count.replace(/,/g, '') || '0'),
                  androidReviews: parseInt(app.appInfo?.android?.rating_count.replace(/,/g, '') || '0'),
                  version: app.appInfo?.ios?.version || app.appInfo?.android?.version || 'N/A',
                  lastUpdate: app.appInfo?.ios?.update_date || app.appInfo?.android?.update_date || 'N/A',
                  appStoreUrl: app.appStoreUrl || '',
                  playStoreUrl: app.playStoreUrl || '',
                  appInfo: app.appInfo,
                  reviews: { positive: [], neutral: [], negative: [] },
                  uxScores: { memberlogin: 0, search: 0, product: 0, checkout: 0, service: 0, other: 0 },
                  reviewStats: { positive: 0, neutral: 0, negative: 0 },
                  keywordFrequency: [],
                  processedReviews: allReviews,
                  features: undefined,
                  reviewAnalysis: undefined,
                  uxAnalysis: undefined,
                  comparisonData: undefined
                } as AppData;
              })
            );
            
            // 將初始化的資料應用日期篩選
            const updatedAppData = await recalculateDataWithTimeframe(initializedData, false); // 執行AI分析
            console.log('時間篩選後:', updatedAppData.map(app => `${app.name}: ${app.processedReviews.length}筆評論`));
            
            // 更新狀態
            setAppData(updatedAppData);
          } else {
            // 如果沒有選擇的應用，則使用現有的 appData
            const updatedAppData = await recalculateDataWithTimeframe(appData, false); // 執行AI分析
            
            // 確保更新所有應用的 processedReviews
            setAppData(prevData => {
              return prevData.map((app: AppData, index) => {
                if (index < updatedAppData.length) {
                  return updatedAppData[index];
                }
                return app;
              });
            });
          }
  
          setReviewFilters(prev => ({
            ...prev,
            timeframe: selectedTimeframe
          }));
        } catch (error) {
          console.error('重新計算數據時發生錯誤:', error);
          setError('根據時間範圍更新數據時發生錯誤，請稍後再試。');
        } finally {
          // 只有在時間範圍變更時才關閉加載彈窗
          if (isTimeframeChange) {
            console.log('時間範圍變更數據計算完成，關閉加載彈窗', new Date().toISOString());
            setIsAnalyzing(false);
          } else {
            console.log('基本資料時間篩選完成，由 initializeData 繼續處理 AI 分析', new Date().toISOString());
          }
        }
      }
    };
    
    updateDataWithTimeframe();
  }, [selectedTimeframe, appData.length, selectedApps]);

  // 修改初始化數據函數，以支持日期篩選
  useEffect(() => {
    const initializeData = async () => {
      if (selectedApps.length === 0) return;
      
      setIsAnalyzing(true);
      try {
        console.log(`開始初始化 ${selectedApps.length} 個應用的數據 [${new Date().toISOString()}]`);
        
        const initializedData: AppData[] = await Promise.all(
          selectedApps.map(async (app) => {
            // 計算評論相關的數據
            const iosReviews = app.appInfo?.ios?.reviews || [];
            const androidReviews = app.appInfo?.android?.reviews || [];
            const allReviews = [...iosReviews, ...androidReviews];
            
            console.log(`初始化 ${app.name} - 原始評論數: iOS=${iosReviews.length}, Android=${androidReviews.length}, 總共=${allReviews.length}`);

            // 計算各類別評分
            const uxScores = {
              memberlogin: calculateCategoryScore(allReviews, '會員登入'),
              search: calculateCategoryScore(allReviews, '搜尋功能'),
              product: calculateCategoryScore(allReviews, '商品相關'),
              checkout: calculateCategoryScore(allReviews, '結帳付款'),
              service: calculateCategoryScore(allReviews, '客戶服務'),
              other: calculateCategoryScore(allReviews, '其他')
            };

            // 計算情感分析統計
            const reviewStats = calculateSentimentStats(allReviews);

            // 提取代表性評論
            const reviews = {
              positive: extractRepresentativeReviews(allReviews, '正面'),
              neutral: extractRepresentativeReviews(allReviews, '中性'),
              negative: extractRepresentativeReviews(allReviews, '負面')
            };

            // 計算關鍵詞頻率
            const keywordFrequency = calculateKeywordFrequency(allReviews);

            return {
              id: app.id,
              name: app.name,
              logo: app.appInfo?.ios?.icon_url || app.appInfo?.android?.icon_url || '',
              iosRating: parseFloat(app.appInfo?.ios?.rating || '0'),
              androidRating: parseFloat(app.appInfo?.android?.rating || '0'),
              iosReviews: parseInt(app.appInfo?.ios?.rating_count.replace(/,/g, '') || '0'),
              androidReviews: parseInt(app.appInfo?.android?.rating_count.replace(/,/g, '') || '0'),
              version: app.appInfo?.ios?.version || app.appInfo?.android?.version || 'N/A',
              lastUpdate: app.appInfo?.ios?.update_date || app.appInfo?.android?.update_date || 'N/A',
              appStoreUrl: app.appStoreUrl || '',
              playStoreUrl: app.playStoreUrl || '',
              appInfo: app.appInfo,
              reviews,
              uxScores,
              reviewStats,
              keywordFrequency,
              processedReviews: allReviews
            } as AppData;
          })
        );

        // 應用日期篩選並計算所有分析數據
        console.log(`初始化後，開始應用日期篩選 (${selectedTimeframe})`);
        const filteredData = await recalculateDataWithTimeframe(initializedData, true); // 跳過AI分析
        
        console.log('初始化: 篩選前應用數', initializedData.length);
        console.log('初始化: 篩選後應用數', filteredData.length);
        console.log('初始化: 各應用篩選後的評論數', filteredData.map(app => `${app.name}: ${app.processedReviews.length}筆評論`));
        
        // 設置所有應用的初始數據
        setAppData(filteredData);
        
        // Initialize all apps as expanded by default
        const expandedState: Record<string, boolean> = {};
        initializedData.forEach(app => {
          expandedState[app.id] = true;
        });
        setExpandedApps(expandedState);
        
        // 只先設置基本數據，並開始進行進階分析
        // 不立即關閉加載視窗，等待所有進階分析完成
        
        // 執行所有分析 - 這裡將異步操作分開執行，以便單獨處理每個應用
        const analysisPromises = filteredData.map(async (app: AppData) => {
          try {
            console.log(`開始分析應用 ${app.name} 的進階數據...`);
            
            // 分析APP特性
            console.log(`分析應用 ${app.name} 的特性...`);
            const features = await analyzeAppFeatures(app);
            
            // 分析評論
            console.log(`分析應用 ${app.name} 的評論...`);
            const reviewAnalysis = await analyzeReviews(app);
            
            // 分析用戶體驗
            console.log(`分析應用 ${app.name} 的用戶體驗...`);
            const uxAnalysis = await analyzeUserExperience(app);
            
            // 生成競爭對比數據
            console.log(`生成應用 ${app.name} 的競爭對比數據...`);
            const comparisonData = await generateComparisonData(app);
            
            // 生成改進建議
            console.log(`生成應用 ${app.name} 的改進建議...`);
            let improvementSuggestions;
            try {
              improvementSuggestions = await generateImprovementSuggestions(app);
              console.log(`成功生成應用 ${app.name} 的改進建議`);
            } catch (error) {
              console.error(`生成應用 ${app.name} 的改進建議時發生錯誤:`, error);
              improvementSuggestions = { 
                urgent_improvements: [], 
                functional_areas: [], 
                expected_results: [] 
              };
            }
            
            // 更新單個應用的數據
            return {
              ...app,
              features,
              reviewAnalysis,
              uxAnalysis,
              comparisonData,
              improvementSuggestions
            };
          } catch (err) {
            console.error(`分析應用 ${app.name} 時發生錯誤:`, err);
            return app;
          }
        });
        
        // 等待所有分析完成
        const enhancedApps = await Promise.all(analysisPromises);
        console.log('所有應用的進階數據分析已完成', new Date().toISOString());
        
        // 更新最終數據
        setAppData(enhancedApps);
        
      } catch (error) {
        console.error('初始化資料時發生錯誤:', error);
        setError('初始化資料時發生錯誤，請稍後再試。');
      } finally {
        // 所有處理完成後關閉加載視窗
        console.log('初始化完成，關閉加載視窗', new Date().toISOString());
        setIsAnalyzing(false);
      }
    };

    initializeData();
  }, [selectedApps, selectedTimeframe]);

  // 添加一個useEffect來響應強制更新
  useEffect(() => {
    if (forceUpdateCounter > 0) {
      console.log('檢測到強制更新請求，重新計算數據...');
      // 此處可以添加任何需要在日期變更時執行的邏輯
    }
  }, [forceUpdateCounter]);

  if (!selectedApps || selectedApps.length === 0) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">競爭對手分析</h1>
          <button
            onClick={onGoBack}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            返回爬取資料
          </button>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-center text-gray-500">尚未選擇任何應用程式進行分析</p>
          <button
            onClick={onGoBack}
            className="mt-4 mx-auto block px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            返回選擇應用程式
          </button>
        </div>
      </div>
    );
  }

  // 計算情感分析數據
  const sentimentData = appData.map(app => ({
    name: app.name,
    positive: app.reviewStats.positive,
    neutral: app.reviewStats.neutral,
    negative: app.reviewStats.negative
  }));

  // 計算用戶體驗比較數據
  const uxComparisonData = [
    { name: "會員登入", key: "memberlogin" },
    { name: "搜尋功能", key: "search" },
    { name: "商品相關", key: "product" },
    { name: "結帳付款", key: "checkout" },
    { name: "客戶服務", key: "service" },
    { name: "其他", key: "other" }
  ].map(item => {
    const result: any = { name: item.name };
    appData.forEach(app => {
      result[app.name] = app.uxScores[item.key as keyof typeof app.uxScores];
    });
    return result;
  });

  // 生成圖表顏色映射
  const appColorMap = Object.fromEntries(
    appData.map((app, index) => [app.name, COLORS[index % COLORS.length]])
  );

  // 新增時序數據處理函數
  const getTimeSeriesData = (dataType: 'count' | 'rating') => {
    if (!appData.length) return [];
    
    // 獲取所有應用的所有評論
    const allReviews = appData.flatMap(app => 
      app.processedReviews.map(review => ({
        appName: app.name,
        date: new Date(review.date),
        rating: review.rating
      }))
    );
    
    // 按日期排序
    allReviews.sort((a, b) => a.date.getTime() - b.date.getTime());
    
    // 根據選定的時間範圍進行分組
    const groupedData: Record<string, Record<string, any>> = {};
    
    allReviews.forEach(review => {
      let dateKey: string;
      
      if (timeframeView === 'daily') {
        dateKey = review.date.toISOString().split('T')[0]; // YYYY-MM-DD
      } else if (timeframeView === 'monthly') {
        dateKey = `${review.date.getFullYear()}-${String(review.date.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
      } else {
        dateKey = `${review.date.getFullYear()}`; // YYYY
      }
      
      if (!groupedData[dateKey]) {
        groupedData[dateKey] = {
          date: dateKey,
        };
        
        // 初始化每個應用的數據
        appData.forEach(app => {
          if (dataType === 'count') {
            groupedData[dateKey][app.name] = 0;
          } else {
            groupedData[dateKey][`${app.name}_sum`] = 0;
            groupedData[dateKey][`${app.name}_count`] = 0;
            groupedData[dateKey][app.name] = 0;
          }
        });
      }
      
      // 更新數據
      if (dataType === 'count') {
        groupedData[dateKey][review.appName]++;
      } else {
        groupedData[dateKey][`${review.appName}_sum`] += review.rating;
        groupedData[dateKey][`${review.appName}_count`]++;
        // 計算當前平均值
        groupedData[dateKey][review.appName] = 
          parseFloat((groupedData[dateKey][`${review.appName}_sum`] / 
                     groupedData[dateKey][`${review.appName}_count`]).toFixed(1));
      }
    });
    
    // 轉換為數組並排序
    return Object.values(groupedData).sort((a, b) => a.date.localeCompare(b.date));
  };

  // 新增函數用於生成改進建議
  const generateImprovementSuggestions = async (app: AppData) => {
    // 如果已經有建議，直接返回
    if (app.improvementSuggestions) {
      console.log('[generateImprovementSuggestions] 使用已存在的改進建議數據');
      return app.improvementSuggestions;
    }

    // 判斷某個功能模塊是否急需改進 (評分低於40為急需改進)
    const URGENT_THRESHOLD = 40;
    
    // 識別急需改進的功能
    const urgentAreas = [];
    if (app.uxScores.memberlogin < URGENT_THRESHOLD) urgentAreas.push({ name: "會員登入體驗", score: app.uxScores.memberlogin });
    if (app.uxScores.checkout < URGENT_THRESHOLD) urgentAreas.push({ name: "結帳流程", score: app.uxScores.checkout });
    if (app.uxScores.search < URGENT_THRESHOLD) urgentAreas.push({ name: "搜尋功能", score: app.uxScores.search });
    if (app.uxScores.product < URGENT_THRESHOLD) urgentAreas.push({ name: "商品體驗", score: app.uxScores.product });
    if (app.uxScores.service < URGENT_THRESHOLD) urgentAreas.push({ name: "客戶服務", score: app.uxScores.service });
    
    try {
      // 根據評論分析和UX評分，使用AI生成改進建議
      const prompt = `根據以下應用數據，提供具體的改進建議：

應用名稱：${app.name}
用戶體驗評分詳情：
- 會員登入: ${app.uxScores.memberlogin}%
- 搜尋功能: ${app.uxScores.search}%
- 商品相關: ${app.uxScores.product}%
- 結帳付款: ${app.uxScores.checkout}%
- 客戶服務: ${app.uxScores.service}%
- 其他功能: ${app.uxScores.other}%

用戶滿意度評分：${app.comparisonData?.positioning_matrix?.satisfaction_score || '無數據'}%
功能完整性評分：${app.comparisonData?.positioning_matrix?.completeness_score || '無數據'}%
市場定位: ${app.comparisonData?.positioning_matrix?.market_position || '無數據'}

評論分析摘要：${app.reviewAnalysis?.summary || '無可用分析'}

主要優點：
${app.reviewAnalysis?.advantages?.map(adv => `- ${adv}`).join('\n') || '無數據'}

主要缺點：
${app.reviewAnalysis?.improvements?.map(imp => `- ${imp}`).join('\n') || '無數據'}

關鍵字詞頻率：
${app.keywordFrequency?.slice(0, 5).map(kw => `- ${kw.keyword}: ${kw.count}次`).join('\n') || '無數據'}

${urgentAreas.length > 0 ? `急需改進的領域：\n${urgentAreas.map(area => `- ${area.name}: ${area.score}%`).join('\n')}` : ''}

請使用繁體中文回答。給出全面且實用的改進建議，包含以下部分：
1. 先列出2-3個優先改進項目，每個包含簡短的問題描述和具體的改進建議
2. 然後按不同功能領域（會員體驗、商品瀏覽、搜尋功能、結帳流程、客戶服務等）提供具體建議，每個領域2-3點
3. 最後提供3-4點預期改進效果

請具體、實用且有針對性。建議應基於評論分析和用戶體驗評分，解決實際問題。

回覆格式為JSON：
{
  "urgent_improvements": [
    {
      "title": "優先改進項目標題",
      "description": "問題描述",
      "suggestions": ["具體建議1", "具體建議2"]
    }
  ],
  "functional_areas": [
    {
      "area": "功能領域名稱",
      "suggestions": [
        {
          "title": "建議標題",
          "description": "建議內容"
        }
      ]
    }
  ],
  "expected_results": ["預期效果1", "預期效果2", "預期效果3"]
}`;

      console.log(`[generateImprovementSuggestions] 開始為應用 ${app.name} 生成改進建議...`);
      console.log('[generateImprovementSuggestions] 使用的提示詞:', prompt.substring(0, 100) + '...');
      
      // 使用API端點提供AI生成的內容
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          model: 'gemini-2.0-flash'
        }),
      });

      if (!response.ok) {
        console.error(`[generateImprovementSuggestions] API請求失敗 - 狀態碼: ${response.status}`);
        const errorText = await response.text();
        console.error('[generateImprovementSuggestions] API返回錯誤:', errorText);
        throw new Error(`無法生成改進建議，API請求失敗 (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      console.log('[generateImprovementSuggestions] API返回數據:', data);
      
      if (!data.response) {
        console.error('[generateImprovementSuggestions] API返回空數據:', data);
        throw new Error('API返回空數據');
      }
      
      // 使用API返回的已清理響應
      const cleanResponse = data.response;
      
      // 如果API有提供原始響應(用於調試)，也記錄下來
      if (data.originalResponse) {
        console.log('[generateImprovementSuggestions] API原始響應:', data.originalResponse.substring(0, 200) + '...');
      }
      
      console.log('[generateImprovementSuggestions] 清理後的響應:', cleanResponse.substring(0, 200) + '...');

      // 定義返回值的類型
      let suggestions: {
        urgent_improvements: {
          title: string;
          description: string;
          suggestions: string[];
        }[];
        functional_areas: {
          area: string;
          suggestions: {
            title: string;
            description: string;
          }[];
        }[];
        expected_results: string[];
      };

      try {
        // 嘗試直接解析JSON
        suggestions = JSON.parse(cleanResponse);
        console.log('[generateImprovementSuggestions] 成功解析JSON數據');
      } catch (parseError) {
        console.error('[generateImprovementSuggestions] 解析JSON時發生錯誤:', parseError);
        
        try {
          // 處理可能的各種格式問題
          let fixedJson = cleanResponse
            .replace(/,(\s*[}\]])/g, '$1') // 移除尾隨逗號
            .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":') // 確保屬性名稱有引號
            .replace(/:\s*'([^']*)'/g, ': "$1"') // 將單引號替換為雙引號
            .replace(/\\n/g, ' ') // 移除換行符
            .replace(/"/g, '"') // 修復可能的異常引號
            .replace(/'/g, '"') // 統一將所有單引號轉換為雙引號
            .replace(/「/g, '"').replace(/」/g, '"') // 處理中文引號
            .replace(/:\s*"([^"]*)"/g, function(match: string, p1: string) {
              // 將字段值內的雙引號轉義，但保留字段名稱和值邊界的雙引號
              return ': "' + p1.replace(/"/g, '\\"') + '"';
            });
          
          // 嘗試提取JSON結構
          const jsonMatch = fixedJson.match(/\{[^]*\}/);
          if (jsonMatch) {
            fixedJson = jsonMatch[0];
          }
          
          console.log('[generateImprovementSuggestions] 嘗試修復JSON:', fixedJson.substring(0, 100) + '...');
          
          try {
            // 嘗試解析修復後的JSON
            suggestions = JSON.parse(fixedJson);
            console.log('[generateImprovementSuggestions] 修復後成功解析JSON');
          } catch (secondError) {
            console.error('[generateImprovementSuggestions] 修復JSON後仍然解析失敗:', secondError);
            
            // 嘗試更徹底的修復
            try {
              // 使用更嚴格的修復方法
              const moreFixedJson = fixedJson
                .replace(/([{,])\s*([a-zA-Z0-9_]+)\s*:/g, '$1"$2":') // 確保所有鍵都有引號
                .replace(/:\s*"([^"]*)"([,}])/g, function(match: string, p1: string, p2: string) {
                  // 處理值中的特殊字符
                  return ': "' + p1.replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"' + p2;
                })
                .replace(/,(\s*[}\]])/g, '$1') // 再次移除尾隨逗號
                .replace(/\s+/g, ' '); // 移除多餘空白
              
              suggestions = JSON.parse(moreFixedJson);
              console.log('[generateImprovementSuggestions] 使用更嚴格修復後成功解析JSON');
            } catch (finalError) {
              console.error('[generateImprovementSuggestions] 最終修復嘗試也失敗:', finalError);
              
              // 設置默認值
              suggestions = {
                urgent_improvements: [{
                  title: "無法自動生成建議",
                  description: "AI生成內容時發生錯誤，無法解析返回的數據",
                  suggestions: ["請稍後再試", "聯繫技術支援以解決問題"]
                }],
                functional_areas: [{
                  area: "系統錯誤",
                  suggestions: [{
                    title: "技術問題",
                    description: "無法處理建議生成請求，API返回的數據格式異常"
                  }]
                }],
                expected_results: ["修復系統問題後可正常生成建議"]
              };
            }
          }
        } catch (error) {
          console.error('[generateImprovementSuggestions] 修復過程中發生錯誤:', error);
          
          // 完全失敗時的默認數據
          suggestions = {
            urgent_improvements: [{
              title: "無法自動生成建議",
              description: "AI生成內容時發生錯誤",
              suggestions: ["請稍後再試", "聯繫技術支援以解決問題"]
            }],
            functional_areas: [{
              area: "系統錯誤",
              suggestions: [{
                title: "技術問題",
                description: "無法處理建議生成請求"
              }]
            }],
            expected_results: ["修復系統問題後可正常生成建議"]
          };
        }
      }

      // 檢查必要字段是否存在，如果不存在則設置默認值
      if (!suggestions.urgent_improvements || !Array.isArray(suggestions.urgent_improvements) || suggestions.urgent_improvements.length === 0) {
        console.warn('[generateImprovementSuggestions] 缺少urgent_improvements字段，添加默認數據');
        suggestions.urgent_improvements = [{
          title: "系統無法識別優先改進項目",
          description: "基於現有數據無法自動識別優先改進項目",
          suggestions: ["請檢視功能區域的具體建議", "考慮手動分析用戶評論以識別優先項目"]
        }];
      }
      
      if (!suggestions.functional_areas || !Array.isArray(suggestions.functional_areas) || suggestions.functional_areas.length === 0) {
        console.warn('[generateImprovementSuggestions] 缺少functional_areas字段，添加默認數據');
        suggestions.functional_areas = [{
          area: "一般功能改進",
          suggestions: [{
            title: "系統無法生成具體功能建議",
            description: "無法從API獲取有效的功能改進建議數據"
          }]
        }];
      }
      
      if (!suggestions.expected_results || !Array.isArray(suggestions.expected_results) || suggestions.expected_results.length === 0) {
        console.warn('[generateImprovementSuggestions] 缺少expected_results字段，添加默認數據');
        suggestions.expected_results = ["提升整體用戶滿意度", "改善用戶體驗", "增加用戶留存率"];
      }
      
      return suggestions;
      
    } catch (error) {
      console.error('[generateImprovementSuggestions] 生成改進建議時發生錯誤:', error);
      
      // 當發生錯誤時，返回一個基本的錯誤信息結構
      return {
        urgent_improvements: [
          {
            title: "無法生成改進建議",
            description: "生成過程中發生技術錯誤",
            suggestions: ["請稍後再試", "如果問題持續存在，請聯繫技術支援"]
          }
        ],
        functional_areas: [
          {
            area: "系統錯誤",
            suggestions: [
              {
                title: "處理問題",
                description: error instanceof Error ? error.message : "未知錯誤"
              }
            ]
          }
        ],
        expected_results: ["修復技術問題後可正常使用建議功能"]
      };
    }
  };

  // AppImprovementSuggestions 組件
  const AppImprovementSuggestions = ({ app }: { app: AppData }) => {
    const suggestions = app.improvementSuggestions;
    
    // 顏色映射函數
    const getAreaColors = (areaName: string) => {
      const colorMap: Record<string, { color: string, bgColor: string, borderColor: string }> = {
        '會員登入': { color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
        '會員': { color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
        '搜尋': { color: 'text-purple-600', bgColor: 'bg-purple-50', borderColor: 'border-purple-200' },
        '商品': { color: 'text-orange-600', bgColor: 'bg-orange-50', borderColor: 'border-orange-200' },
        '結帳': { color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
        '客戶': { color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
        '服務': { color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200' }
      };
      
      // 查找匹配的顏色設定
      const key = Object.keys(colorMap).find(k => areaName.includes(k));
      return key 
        ? colorMap[key] 
        : { color: 'text-gray-600', bgColor: 'bg-gray-50', borderColor: 'border-gray-200' };
    };

    // 如果沒有建議數據，顯示提示訊息
    if (!suggestions) {
      return (
        <div className="p-6 bg-gray-50 rounded-lg border">
          <div className="flex items-center gap-4 mb-6">
            <img src={app.logo} alt={app.name} className="w-12 h-12 rounded-lg shadow-sm" />
            <div>
              <h4 className="text-xl font-semibold text-gray-900">{app.name}</h4>
              <p className="text-sm text-gray-500">改進建議與優化方向</p>
            </div>
          </div>
          
          <div className="text-center py-6 text-gray-500 flex flex-col items-center">
            <svg className="w-8 h-8 text-amber-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium text-gray-600">正在生成改進建議</p>
            <p className="text-xs text-gray-500 mt-1">請稍候或稍後重新載入</p>
          </div>
        </div>
      );
    }

    // 確保各字段都有有效值
    const safeUrgentImprovements = Array.isArray(suggestions.urgent_improvements) 
      ? suggestions.urgent_improvements 
      : [];
    
    const safeFunctionalAreas = Array.isArray(suggestions.functional_areas) 
      ? suggestions.functional_areas 
      : [];
    
    const safeExpectedResults = Array.isArray(suggestions.expected_results) 
      ? suggestions.expected_results 
      : [];

    // 檢查各類型內容是否存在
    const hasUrgentImprovements = safeUrgentImprovements.length > 0;
    const hasFunctionalAreas = safeFunctionalAreas.length > 0;
    const hasExpectedResults = safeExpectedResults.length > 0;

    // 如果所有內容都為空，顯示錯誤訊息
    if (!hasUrgentImprovements && !hasFunctionalAreas && !hasExpectedResults) {
      return (
        <div className="p-6 bg-gray-50 rounded-lg border">
          <div className="flex items-center gap-4 mb-6">
            <img src={app.logo} alt={app.name} className="w-12 h-12 rounded-lg shadow-sm" />
            <div>
              <h4 className="text-xl font-semibold text-gray-900">{app.name}</h4>
              <p className="text-sm text-gray-500">改進建議與優化方向</p>
            </div>
          </div>
          
          <div className="text-center py-6 text-gray-500 flex flex-col items-center">
            <svg className="w-8 h-8 text-red-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium text-gray-600">無法生成改進建議</p>
            <p className="text-xs text-gray-500 mt-1">請稍後再試或聯繫技術支援</p>
            <button 
              className="mt-4 px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-md transition-colors"
              onClick={() => window.location.reload()}
            >
              重新整理頁面
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="p-6 bg-gray-50 rounded-lg border">
        <div className="flex items-center gap-4 mb-6">
          <img src={app.logo} alt={app.name} className="w-12 h-12 rounded-lg shadow-sm" />
          <div>
            <h4 className="text-xl font-semibold text-gray-900">{app.name}</h4>
            <p className="text-sm text-gray-500">改進建議與優化方向</p>
          </div>
        </div>
        
        {/* 急需改進項目區塊 */}
        {hasUrgentImprovements && (
          <div className="mb-8">
            <div className="mb-4 pb-2 border-b border-red-100">
              <div className="flex items-center gap-2 text-red-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h5 className="font-medium text-lg">急需改進項目</h5>
              </div>
            </div>
            
            <div className="space-y-6">
              {safeUrgentImprovements.map((item, index) => (
                <div key={index} className="p-4 bg-red-50 rounded-lg border border-red-100">
                  <h6 className="font-medium text-red-700 mb-2">{item.title || '無標題'}</h6>
                  <p className="text-sm text-gray-600 mb-3">{item.description || '無描述'}</p>
                  <div className="space-y-2">
                    {Array.isArray(item.suggestions) ? item.suggestions.map((suggestion, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-red-100 text-red-600 text-xs mt-0.5">
                          {idx + 1}
                        </span>
                        <p className="text-sm text-gray-700">{suggestion}</p>
                      </div>
                    )) : (
                      <p className="text-sm text-gray-500 italic">無具體建議</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 功能區域建議區塊 */}
        {hasFunctionalAreas && (
          <div className="mb-8">
            <div className="mb-4 pb-2 border-b border-gray-200">
              <h5 className="font-medium text-lg text-gray-800">功能改進建議</h5>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {safeFunctionalAreas.map((area, index) => {
                const colors = getAreaColors(area.area || '其他功能');
                return (
                  <div key={index} className={`p-4 ${colors.bgColor} rounded-lg border ${colors.borderColor}`}>
                    <h6 className={`font-medium ${colors.color} mb-3`}>{area.area || '其他功能'}</h6>
                    <div className="space-y-4">
                      {Array.isArray(area.suggestions) ? area.suggestions.map((suggestion, idx) => (
                        <div key={idx} className="border-l-2 pl-3 ml-1 border-gray-300">
                          <h6 className="text-sm font-medium text-gray-700 mb-1">{suggestion.title || '無標題'}</h6>
                          <p className="text-sm text-gray-600">{suggestion.description || '無描述'}</p>
                        </div>
                      )) : (
                        <div className="border-l-2 pl-3 ml-1 border-gray-300">
                          <p className="text-sm text-gray-500 italic">無具體建議</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 預期效果區塊 */}
        {hasExpectedResults && (
          <div className="mt-6 p-4 bg-gray-100 rounded-lg">
            <h6 className="font-medium text-gray-900 mb-3">預期改善效果</h6>
            <ul className="space-y-2">
              {safeExpectedResults.map((effect, index) => (
                <li key={index} className="flex items-center gap-2 text-sm text-gray-700">
                  <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{effect}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 mb-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        </div>
      )}

      {isAnalyzing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">正在進行競品分析</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>分析進度</span>
                  <span>請稍候...</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 transition-all duration-300 animate-pulse" style={{ width: '100%' }} />
                </div>
              </div>
              <p className="text-sm text-gray-500">
                正在處理評論數據並生成分析報告，這可能需要一些時間...
              </p>
            </div>
          </div>
        </div>
      )}

      {isPPTGenerating && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">正在生成簡報</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{pptProgress.phase}</span>
                  <span>{pptProgress.progress}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-300" 
                    style={{ width: `${pptProgress.progress}%` }} 
                  />
                </div>
              </div>
              <p className="text-sm text-gray-500">
                正在生成專業的競品分析簡報，請稍候...
              </p>
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>競爭對手分析</CardTitle>
              <CardDescription>比較各競爭對手的產品功能、用戶體驗和評論分析。</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={onGoBack} className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              返回爬取資料
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col space-y-4 mb-6">
            {/* 上方日期範圍摘要顯示 */}
            <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-900 px-4 py-3 rounded-xl shadow-sm">
              <div className="flex items-center">
                <CalendarIcon className="w-5 h-5 text-gray-500 dark:text-gray-400 mr-2" />
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {formatDateDisplay(customStartDate)} – {formatDateDisplay(customEndDate)}
                  <span className="ml-2 text-gray-400">({calculateDaysBetween(customStartDate, customEndDate)}天)</span>
                </span>
              </div>
              
              <button 
                onClick={() => setShowDateRangePanel(!showDateRangePanel)}
                className="text-blue-500 hover:text-blue-600 text-sm font-medium flex items-center"
              >
                變更
                <ChevronDownIcon className={`w-4 h-4 ml-1 transition-transform ${showDateRangePanel ? 'rotate-180' : ''}`} />
              </button>
            </div>
            
            {/* Apple風格分段控制器與日期選擇面板 */}
            {showDateRangePanel && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 border border-gray-100 dark:border-gray-700 animate-in slide-in-from-top-2 duration-200">
                <div className="space-y-4">
                  {/* 分段控制器 */}
                  <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl overflow-hidden">
                    {[
                      { id: '7days', label: '過去7天' },
                      { id: '30days', label: '過去30天' },
                      { id: '90days', label: '過去90天' },
                      { id: '1year', label: '過去1年' },
                      { id: 'custom', label: '自訂' }
                    ].map((option) => (
                      <button
                        key={option.id}
                        onClick={() => applyTimeframeImmediately(option.id)}
                        className={`flex-1 py-2 text-sm font-medium transition-all duration-200 rounded-lg ${
                          pendingTimeframe === option.id
                            ? 'bg-white dark:bg-gray-800 text-blue-500 shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  
                  {/* 時間軸視覺化 */}
                  <div className="relative h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full mb-2">
                    <div 
                      className="absolute h-1.5 bg-blue-500 rounded-full"
                      style={{ 
                        width: pendingTimeframe === 'custom' 
                          ? `${Math.min(100, calculateDaysBetween(pendingStartDate, pendingEndDate) / 3.65)}%` 
                          : pendingTimeframe === 'today' ? '0.5%' 
                          : pendingTimeframe === '7days' ? '2%' 
                          : pendingTimeframe === '30days' ? '8%' 
                          : pendingTimeframe === '90days' ? '25%' 
                          : '100%'
                      }}
                    />
                  </div>
                  
                  {/* 日期範圍信息 */}
                  <div className="flex justify-between items-center text-sm">
                    <div className="text-gray-500 dark:text-gray-400">
                      {formatDateDisplay(pendingStartDate)}
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-full text-blue-600 dark:text-blue-400 text-xs font-medium">
                      {calculateDaysBetween(pendingStartDate, pendingEndDate)}天
                    </div>
                    <div className="text-gray-500 dark:text-gray-400">
                      {formatDateDisplay(pendingEndDate)}
                    </div>
                  </div>
                  
                  {/* 自訂日期選擇器 */}
                  {pendingTimeframe === 'custom' && (
                    <div className="mt-4 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg animate-in fade-in duration-200">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">起始日期</label>
                          <div className="relative">
                            <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input 
                        type="date" 
                              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg pl-10 pr-3 py-2 text-sm w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                              value={pendingStartDate}
                              onChange={(e) => {
                                const newDate = e.target.value;
                                console.log('起始日期變更為：', newDate);
                                setPendingStartDate(newDate);
                              }}
                              max={pendingEndDate}
                      />
                    </div>
                  </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">結束日期</label>
                          <div className="relative">
                            <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input 
                        type="date" 
                              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg pl-10 pr-3 py-2 text-sm w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                              value={pendingEndDate}
                              onChange={(e) => {
                                const newDate = e.target.value;
                                console.log('結束日期變更為：', newDate);
                                setPendingEndDate(newDate);
                              }}
                              min={pendingStartDate}
                              max={formatDateToYYYYMMDD(getTaipeiDate())}
                      />
                    </div>
                        </div>
                      </div>
                      
                      {/* 快速選擇按鈕 */}
                      <div className="flex flex-wrap gap-2 mt-4">
                        <button 
                          onClick={() => {
                            // 獲取台北時間
                            const today = getTaipeiDate();
                            
                            // 本月：從當月1號到昨天
                            const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                            const yesterday = new Date(today);
                            yesterday.setDate(today.getDate() - 1);
                            
                            const startStr = formatDateToYYYYMMDD(firstDayOfMonth);
                            const endStr = formatDateToYYYYMMDD(yesterday);
                            console.log('選擇本月日期:', startStr, '至', endStr);
                            
                            setPendingStartDate(startStr);
                            setPendingEndDate(endStr);
                          }}
                          className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-3 py-1 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          本月
                        </button>
                        <button 
                          onClick={() => {
                            // 獲取台北時間
                            const today = getTaipeiDate();
                            
                            // 上個月：上個月的完整月份
                            const firstDayOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                            const lastDayOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
                            
                            setPendingStartDate(formatDateToYYYYMMDD(firstDayOfLastMonth));
                            setPendingEndDate(formatDateToYYYYMMDD(lastDayOfLastMonth));
                          }}
                          className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-3 py-1 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          上個月
                        </button>
                        <button 
                          onClick={() => {
                            // 獲取台北時間
                            const today = getTaipeiDate();
                            const yesterday = new Date(today);
                            yesterday.setDate(today.getDate() - 1);
                            
                            // 本季度：從本季度第一天到昨天
                            const currentQuarter = Math.floor(today.getMonth() / 3);
                            const firstDayOfQuarter = new Date(today.getFullYear(), currentQuarter * 3, 1);
                            
                            setPendingStartDate(formatDateToYYYYMMDD(firstDayOfQuarter));
                            setPendingEndDate(formatDateToYYYYMMDD(yesterday));
                          }}
                          className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-3 py-1 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          本季度
                        </button>
                        <button 
                          onClick={() => {
                            // 獲取台北時間
                            const today = getTaipeiDate();
                            
                            // 上季度：上季度的完整區間
                            const currentQuarter = Math.floor(today.getMonth() / 3);
                            const previousQuarter = currentQuarter - 1 < 0 ? 3 : currentQuarter - 1;
                            const previousQuarterYear = currentQuarter - 1 < 0 ? today.getFullYear() - 1 : today.getFullYear();
                            
                            const firstDayOfPreviousQuarter = new Date(previousQuarterYear, previousQuarter * 3, 1);
                            const lastDayOfPreviousQuarter = new Date(
                              previousQuarter === 3 ? previousQuarterYear + 1 : previousQuarterYear, 
                              previousQuarter === 3 ? 0 : (previousQuarter + 1) * 3, 
                              0
                            );
                            
                            setPendingStartDate(formatDateToYYYYMMDD(firstDayOfPreviousQuarter));
                            setPendingEndDate(formatDateToYYYYMMDD(lastDayOfPreviousQuarter));
                          }}
                          className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-3 py-1 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          上季度
                        </button>
                  </div>
                </div>
              )}
                  
                  {/* 確認按鈕 */}
                  {pendingTimeframe === 'custom' && (
                    <div className="flex justify-end mt-4">
                      <button 
                        onClick={() => {
                          console.log('點擊套用按鈕 - 自訂日期範圍:', pendingStartDate, '至', pendingEndDate);
                          // 添加一個額外的日誌來追蹤套用過程
                          const dateCount = calculateDaysBetween(pendingStartDate, pendingEndDate);
                          console.log(`自訂日期範圍包含 ${dateCount} 天`);
                          
                          // 觸發套用函數
                          applyDateRangeFilter();
                          
                          // 可以考慮添加視覺反饋，例如一個短暫的提示訊息
                        }}
                        className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      >
                        套用
                      </button>
            </div>
                  )}
                </div>
              </div>
            )}
            
            {/* 下載選項區域 */}
            <div className="flex flex-col sm:flex-row gap-4 justify-end pt-2">
              <Select value={selectedDownloadType} onValueChange={setSelectedDownloadType}>
                <SelectTrigger className="w-full sm:w-[180px] bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <SelectValue placeholder="選擇下載內容" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800">
                  <SelectItem value="full_report">完整分析報告</SelectItem>
                  <SelectItem value="raw_data">原始數據</SelectItem>
                </SelectContent>
              </Select>
              
              <Button 
                onClick={handleDownload}
                className={`
                  w-full sm:w-auto
                  bg-gradient-to-r from-blue-500 to-blue-600 
                  hover:from-blue-600 hover:to-blue-700 
                  text-white px-6 py-2 rounded-lg 
                  shadow-md hover:shadow-lg 
                  transition-all duration-200 
                  flex items-center justify-center gap-2 
                  group relative
                  ${isPPTGenerating || isAnalyzing ? 'animate-pulse' : ''}
                `}
                disabled={isPPTGenerating || isAnalyzing}
              >
                {(isPPTGenerating || isAnalyzing) ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span>正在生成中...</span>
                  </>
                ) : (
                  <>
                    {selectedDownloadType === 'full_report' ? (
                      <svg
                        className="w-5 h-5 text-blue-100"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                    ) : (
                      <svg
                        className="w-5 h-5 text-blue-100"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                        <line x1="10" y1="9" x2="8" y2="9"/>
                      </svg>
                    )}
                    <span className="relative">
                      {selectedDownloadType === 'full_report' ? 'AI 一鍵生成' : '下載原始數據'}
                      <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-blue-200 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-200"/>
                    </span>
                  </>
                )}
              </Button>
            </div>
          </div>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-5 bg-gray-100">
              <TabsTrigger value="overview" className="data-[state=active]:bg-white">總覽</TabsTrigger>
              <TabsTrigger value="features" className="data-[state=active]:bg-white">功能比較</TabsTrigger>
              <TabsTrigger value="ux" className="data-[state=active]:bg-white">用戶體驗</TabsTrigger>
              <TabsTrigger value="reviews" className="data-[state=active]:bg-white">評論分析</TabsTrigger>
              <TabsTrigger value="comparison" className="data-[state=active]:bg-white">解決方案</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                {appData.map((app) => (
                  <Card key={app.id} className="overflow-hidden">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-4">
                        <img
                          src={app.logo}
                          alt={`${app.name} Logo`}
                          className="w-12 h-12 rounded-lg"
                        />
                        <div>
                          <CardTitle className="text-lg">{app.name}</CardTitle>
                          <CardDescription>版本 {app.version}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 mr-1" />
                            <span className="font-medium">iOS: {app.iosRating}</span>
                          </div>
                          <div className="flex items-center">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 mr-1" />
                            <span className="font-medium">Android: {app.androidRating}</span>
                          </div>
                        </div>

                        <div className="text-sm text-muted-foreground">
                          <div className="flex justify-between">
                            <span>評分則數</span>
                            <span>
                              iOS: {formatReviewCount(app.iosReviews)}, Android: {formatReviewCount(app.androidReviews)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>最後更新</span>
                            <span>{app.lastUpdate}</span>
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          className="w-full flex items-center justify-center"
                          onClick={() => toggleAppDetails(app.id)}
                        >
                          {expandedApps[app.id] ? (
                            <>
                              收起詳情 <ChevronUp className="ml-1 h-4 w-4" />
                            </>
                          ) : (
                            <>
                              查看詳情 <ChevronDown className="ml-1 h-4 w-4" />
                            </>
                          )}
                        </Button>

                        {expandedApps[app.id] && (
                          <div className="pt-2 border-t">
                            <h4 className="font-medium mb-2">用戶體驗滿意度</h4>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm">會員登入</span>
                                <span className="text-sm font-medium">{app.uxScores.memberlogin}</span>
                              </div>
                              <div className="h-2 bg-gray-100">
                                <div className="h-full bg-black" style={{ width: `${app.uxScores.memberlogin}%` }} />
                              </div>

                              <div className="flex items-center justify-between">
                                <span className="text-sm">搜尋功能</span>
                                <span className="text-sm font-medium">{app.uxScores.search}</span>
                              </div>
                              <div className="h-2 bg-gray-100">
                                <div className="h-full bg-black" style={{ width: `${app.uxScores.search}%` }} />
                              </div>

                              <div className="flex items-center justify-between">
                                <span className="text-sm">商品相關</span>
                                <span className="text-sm font-medium">{app.uxScores.product}</span>
                              </div>
                              <div className="h-2 bg-gray-100">
                                <div className="h-full bg-black" style={{ width: `${app.uxScores.product}%` }} />
                              </div>

                              <div className="flex items-center justify-between">
                                <span className="text-sm">結帳付款</span>
                                <span className="text-sm font-medium">{app.uxScores.checkout}</span>
                              </div>
                              <div className="h-2 bg-gray-100">
                                <div className="h-full bg-black" style={{ width: `${app.uxScores.checkout}%` }} />
                              </div>

                              <div className="flex items-center justify-between">
                                <span className="text-sm">客戶服務</span>
                                <span className="text-sm font-medium">{app.uxScores.service}</span>
                              </div>
                              <div className="h-2 bg-gray-100">
                                <div className="h-full bg-black" style={{ width: `${app.uxScores.service}%` }} />
                              </div>

                              <div className="flex items-center justify-between">
                                <span className="text-sm">其他功能</span>
                                <span className="text-sm font-medium">{app.uxScores.other}</span>
                              </div>
                              <div className="h-2 bg-gray-100">
                                <div className="h-full bg-black" style={{ width: `${app.uxScores.other}%` }} />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>評論情緒分析</CardTitle>
                  <CardDescription>各App正面、中性與負面評論比例</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sentimentData} layout="vertical" margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" domain={[0, 100]} />
                        <YAxis dataKey="name" type="category" />
                        <Tooltip 
                          formatter={(value, name, props) => {
                            // 獲取app數據以計算絕對數量
                            const appName = props.payload.name;
                            const app = appData.find(a => a.name === appName);
                            
                            if (!app) return [`${value}%`, name];
                            
                            // 使用實際處理的評論數量而非評分數量
                            const totalReviews = app.processedReviews.length;
                            let count = 0;
                            
                            // 根據情感類型獲取絕對數量
                            if (name === "正面評論") {
                              count = Math.round(totalReviews * app.reviewStats.positive / 100);
                              return [`${count} 評論 (${value}%)`, name];
                            } else if (name === "中性評論") {
                              count = Math.round(totalReviews * app.reviewStats.neutral / 100);
                              return [`${count} 評論 (${value}%)`, name];
                            } else if (name === "負面評論") {
                              count = Math.round(totalReviews * app.reviewStats.negative / 100);
                              return [`${count} 評論 (${value}%)`, name];
                            }
                            
                            return [`${value}%`, name];
                          }}
                        />
                        <Legend />
                        <Bar dataKey="positive" stackId="a" fill="#4ade80" name="正面評論" />
                        <Bar dataKey="neutral" stackId="a" fill="#94a3b8" name="中性評論" />
                        <Bar dataKey="negative" stackId="a" fill="#f87171" name="負面評論" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>評論時序分析</CardTitle>
                  <CardDescription>比較各App隨時間變化的評論數量和平均評分</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <div className="flex justify-end items-center mb-6">
                      <div className="inline-flex rounded-md shadow-sm border border-gray-200 bg-white p-1">
                        <button
                          onClick={() => setTimeframeView('daily')}
                          className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                            timeframeView === 'daily'
                              ? 'bg-blue-500 text-white shadow-md transform scale-105'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          每日
                        </button>
                        <button
                          onClick={() => setTimeframeView('monthly')}
                          className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                            timeframeView === 'monthly'
                              ? 'bg-blue-500 text-white shadow-md transform scale-105'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          每月
                        </button>
                        <button
                          onClick={() => setTimeframeView('yearly')}
                          className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                            timeframeView === 'yearly'
                              ? 'bg-blue-500 text-white shadow-md transform scale-105'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          每年
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-6">
                      <div className="h-80">
                        <h4 className="text-base font-medium mb-2">評論數量趨勢</h4>
                        <ResponsiveContainer width="100%" height="90%">
                          <LineChart
                            data={getTimeSeriesData('count')}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip 
                              formatter={(value, name) => [value + ' 則評論', name]}
                              labelFormatter={(label) => `日期: ${label}`}
                            />
                            <Legend />
                            {appData.map((app, index) => (
                              <Line 
                                key={app.id}
                                type="monotone" 
                                dataKey={app.name} 
                                stroke={COLORS[index % COLORS.length]} 
                                activeDot={{ r: 8 }} 
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      
                      <div className="h-80">
                        <h4 className="text-base font-medium mb-2">平均評分趨勢</h4>
                        <ResponsiveContainer width="100%" height="90%">
                          <LineChart
                            data={getTimeSeriesData('rating')}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis domain={[0, 5]} />
                            <Tooltip 
                              formatter={(value, name) => [value + ' 分', name]}
                              labelFormatter={(label) => `日期: ${label}`}
                            />
                            <Legend />
                            {appData.map((app, index) => (
                              <Line 
                                key={app.id}
                                type="monotone" 
                                dataKey={app.name} 
                                stroke={COLORS[index % COLORS.length]} 
                                activeDot={{ r: 8 }} 
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">市場定位矩陣</h3>
                  <div className="relative aspect-square bg-gray-50 rounded-lg p-4 border">
                    <div className="absolute inset-0 p-4">
                      {/* Y軸標籤 */}
                      <div className="absolute -left-12 top-1/2 -translate-y-1/2 -rotate-90 text-sm font-medium text-gray-500">
                        用戶滿意度
                      </div>
                      {/* X軸標籤 */}
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-sm font-medium text-gray-500">
                        功能完整性
                      </div>
                      {/* 象限分隔線 */}
                      <div className="absolute left-1/2 top-0 bottom-0 border-l border-dashed border-gray-300" />
                      <div className="absolute top-1/2 left-0 right-0 border-t border-dashed border-gray-300" />
                      {/* 象限標籤 */}
                      <div className="absolute top-4 left-4 text-xs text-gray-500">潛力型</div>
                      <div className="absolute top-4 right-4 text-xs text-gray-500">領導型</div>
                      <div className="absolute bottom-4 left-4 text-xs text-gray-500">待改進</div>
                      <div className="absolute bottom-4 right-4 text-xs text-gray-500">成熟型</div>
                      {/* 應用程式位置點 */}
                      {appData.map((app) => {
                        const matrix = app.comparisonData?.positioning_matrix;
                        if (!matrix) return null;
                        
                        const x = (matrix.completeness_score / 100) * 100;
                        const y = (matrix.satisfaction_score / 100) * 100;
                        const color = appColorMap[app.name];
                        
                        return (
                          <div
                            key={`${app.id}-position`}
                            className="absolute w-24 transition-all duration-300"
                            style={{
                              left: `${x}%`,
                              bottom: `${y}%`,
                              transform: 'translate(-50%, 50%)'
                            }}
                          >
                            <div
                              className="w-3 h-3 rounded-full mx-auto mb-1"
                              style={{ backgroundColor: color }}
                            />
                            <div className="text-xs text-center font-medium" style={{ color }}>
                              {app.name}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-4">市場定位分析</h3>
                  <div className="space-y-4">
                    {appData.map((app) => (
                      <div key={`${app.id}-position-analysis`} className="p-4 bg-gray-50 rounded-lg border">
                        <div className="flex items-center gap-3 mb-3">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: appColorMap[app.name] }}
                          />
                          <h4 className="font-medium">{app.name}</h4>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">用戶滿意度分數</span>
                            <span className="font-medium">
                              {app.comparisonData?.positioning_matrix?.satisfaction_score || 0}
                            </span>
                          </div>
                          <Progress
                            value={app.comparisonData?.positioning_matrix?.satisfaction_score || 0}
                            className="bg-gray-100"
                          />
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">功能完整性分數</span>
                            <span className="font-medium">
                              {app.comparisonData?.positioning_matrix?.completeness_score || 0}
                            </span>
                          </div>
                          <Progress
                            value={app.comparisonData?.positioning_matrix?.completeness_score || 0}
                            className="bg-gray-100"
                          />
                          <p className="text-sm mt-2 text-gray-600">
                            {app.comparisonData?.positioning_matrix?.market_position || '市場定位分析'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>應用程式比較表</CardTitle>
                  <CardDescription>各應用程式的核心功能、評分與特點比較</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto mb-6">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[100px]">應用程式</TableHead>
                          <TableHead>平均評分</TableHead>
                          <TableHead>核心功能</TableHead>
                          <TableHead>獨特賣點</TableHead>
                          <TableHead className="text-green-600">優點</TableHead>
                          <TableHead className="text-red-600">缺點</TableHead>
                          <TableHead>綜合得分</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {appData.map((app) => (
                          <TableRow key={app.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <img src={app.logo} alt={app.name} className="w-8 h-8 rounded" />
                                {app.name}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <StarIcon className="w-4 h-4 text-yellow-400" />
                                {((app.iosRating + app.androidRating) / 2).toFixed(1)}
                              </div>
                            </TableCell>
                            <TableCell>{app.comparisonData?.core_feature || '核心功能分析'}</TableCell>
                            <TableCell>{app.comparisonData?.unique_selling_point || '獨特優勢分析'}</TableCell>
                            <TableCell className="text-green-600">{app.comparisonData?.main_advantage || '主要優點分析'}</TableCell>
                            <TableCell className="text-red-600">{app.comparisonData?.main_disadvantage || '待改進項目'}</TableCell>
                            <TableCell>
                              {(() => {
                                // 使用用戶滿意度和功能完整性分數計算綜合得分
                                const satisfactionScore = app.comparisonData?.positioning_matrix?.satisfaction_score || 0;
                                const completenessScore = app.comparisonData?.positioning_matrix?.completeness_score || 0;
                                
                                // 計算綜合得分 (各0.5權重)
                                const compositeScore = Math.round(
                                  (satisfactionScore * 0.5) + (completenessScore * 0.5)
                                );
                                
                                // 根據分數決定評級文字和顏色
                                let scoreColor, ratingText;
                                if (compositeScore >= 80) {
                                  scoreColor = 'text-green-600';
                                  ratingText = '優秀';
                                } else if (compositeScore >= 60) {
                                  scoreColor = 'text-blue-600';
                                  ratingText = '良好';
                                } else if (compositeScore >= 40) {
                                  scoreColor = 'text-orange-500';
                                  ratingText = '一般';
                                } else {
                                  scoreColor = 'text-red-500';
                                  ratingText = '較差';
                                }
                                
                                return (
                                  <div className="flex flex-col items-center justify-center">
                                    <span className={`text-lg font-semibold ${scoreColor}`}>
                                      {compositeScore}
                                    </span>
                                    <span className={`text-xs ${scoreColor}`}>
                                      ({ratingText})
                                    </span>
                                  </div>
                                );
                              })()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="features" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>功能比較分析</CardTitle>
                  <CardDescription>AI 分析各應用程式的主要功能特點與優劣勢</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {appData.map((app) => (
                      <Card key={`${app.id}-features`} className="overflow-hidden">
                        <CardHeader className="border-b bg-gray-50">
                          <div className="flex items-start gap-4">
                            <img 
                              src={app.appInfo?.ios?.icon_url || app.appInfo?.android?.icon_url} 
                              alt={app.name} 
                              className="w-12 h-12 rounded-lg"
                            />
                            <div>
                              <CardTitle className="text-lg">{app.name}</CardTitle>
                              <CardDescription>{app.appInfo?.ios?.category || app.appInfo?.android?.category}</CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="p-6">
                          <div className="space-y-6">
                            <div>
                              <h4 className="font-medium text-base mb-3 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
                                  <path d="M5 3v4"/>
                                  <path d="M19 17v4"/>
                                  <path d="M3 5h4"/>
                                  <path d="M17 19h4"/>
                                </svg>
                                核心功能
                              </h4>
                              <div className="space-y-2">
                                {app.features?.core?.map((feature, index) => (
                                  <div key={index} className="flex items-start gap-2">
                                    <svg className="w-5 h-5 text-green-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span className="text-sm">{feature}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div>
                              <h4 className="font-medium text-base mb-3 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>
                                  <path d="M8 11h8"/>
                                  <path d="M12 15V7"/>
                                </svg>
                                優點
                              </h4>
                              <div className="space-y-2">
                                {app.features?.advantages?.map((advantage, index) => (
                                  <div key={index} className="flex items-start gap-2">
                                    <svg className="w-5 h-5 text-blue-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                                    </svg>
                                    <span className="text-sm">{advantage}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div>
                              <h4 className="font-medium text-base mb-3 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
                                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                                </svg>
                                缺點
                              </h4>
                              <div className="space-y-2">
                                {app.features?.improvements?.map((improvement, index) => (
                                  <div key={index} className="flex items-start gap-2">
                                    <svg className="w-5 h-5 text-red-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                                    </svg>
                                    <span className="text-sm">{improvement}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ux" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>用戶體驗雷達圖</CardTitle>
                  <CardDescription>各App六大用戶體驗類別評分比較</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {appData.map((app) => (
                      <div key={`${app.id}-radar`} className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart
                            cx="50%"
                            cy="50%"
                            outerRadius="80%"
                            data={[
                              { subject: "會員登入", A: app.uxScores.memberlogin, fullMark: 100 },
                              { subject: "搜尋功能", A: app.uxScores.search, fullMark: 100 },
                              { subject: "商品相關", A: app.uxScores.product, fullMark: 100 },
                              { subject: "結帳付款", A: app.uxScores.checkout, fullMark: 100 },
                              { subject: "客戶服務", A: app.uxScores.service, fullMark: 100 },
                              { subject: "其他", A: app.uxScores.other, fullMark: 100 },
                            ]}
                          >
                            <PolarGrid />
                            <PolarAngleAxis dataKey="subject" />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} />
                            <Radar
                              name={app.name}
                              dataKey="A"
                              stroke={appColorMap[app.name]}
                              fill={appColorMap[app.name]}
                              fillOpacity={0.6}
                            />
                            <Legend />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>用戶體驗滿意度比較</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-2">
                    <div className="text-sm text-gray-500 italic mb-1">
                      *評分說明：以用戶評論提及各功能區塊的情感分析為基礎，轉換為0-100的表現分數，並非使用者比例
                    </div>
                    <div className="bg-gray-50 p-3 rounded-md mb-4">
                      <p className="text-sm font-medium mb-2">顏色分級標準 (相較於市場平均)：</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="flex flex-col items-center">
                          <div className="px-4 py-2 text-sm text-white w-full text-center rounded-sm" style={{ backgroundColor: 'rgba(239, 68, 68, 0.8)' }}>低滿意度</div>
                        </div>
                        <div className="flex flex-col items-center">
                          <div className="px-4 py-2 text-sm text-black w-full text-center rounded-sm" style={{ backgroundColor: 'rgba(234, 179, 8, 0.8)' }}>中滿意度</div>
                        </div>
                        <div className="flex flex-col items-center">
                          <div className="px-4 py-2 text-sm text-white w-full text-center rounded-sm" style={{ backgroundColor: 'rgba(34, 197, 94, 0.8)' }}>高滿意度</div>
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-gray-600 space-y-1">
                        <p>• <span className="font-medium text-red-600">低滿意度(紅色)</span>：分數低於市場平均值10%以上</p>
                        <p>• <span className="font-medium text-yellow-500">中滿意度(黃色)</span>：分數在市場平均值正負10%範圍內</p>
                        <p>• <span className="font-medium text-green-600">高滿意度(綠色)</span>：分數高於市場平均值10%以上</p>
                        <p className="mt-2 italic">* 百分比差異計算方式：(分數-市場平均)/市場平均×100%</p>
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b-2 border-gray-300">
                          <th className="text-left p-3 bg-gray-50 rounded-tl-md" style={{ width: '180px' }}>功能類別</th>
                          {appData.map((app, index) => (
                            <th key={`${app.id}-header`} className="text-center p-3 font-medium bg-gray-50" style={{ width: '200px' }}>
                              <div className="flex flex-col items-center">
                                <img src={app.logo} alt={app.name} className="w-8 h-8 rounded-full mb-1" />
                              {app.name}
                              </div>
                            </th>
                          ))}
                          <th className="text-center p-3 font-medium bg-gray-50 rounded-tr-md" style={{ width: '160px' }}>
                            <div className="flex flex-col items-center">
                              <svg className="w-6 h-6 text-gray-500 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                              </svg>
                              市場平均
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="p-3 font-medium flex items-center">
                            <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                            </svg>
                            會員登入
                          </td>
                          {appData.map((app, index) => {
                            const score = app.uxScores.memberlogin;
                            const categoryAvg = calculateCategoryAverage(appData, 'memberlogin');
                            const style = getHeatmapStyle(score, categoryAvg);
                            return (
                              <td key={`${app.id}-login`} className="p-3" style={{ width: '200px' }}>
                                <div style={style} className="py-2 px-2 rounded-md flex items-center justify-center">
                                  <div className="font-medium" style={{ color: style.color }}>{score}</div>
                              </div>
                            </td>
                            );
                          })}
                          {(() => {
                            const avgScore = calculateCategoryAverage(appData, 'memberlogin');
                            return (
                              <td className="text-center p-3 font-medium bg-gray-50" style={{ width: '160px' }}>
                                <div className="flex items-center justify-center space-x-2">
                                  <div className="text-gray-700 font-medium">{avgScore}</div>
                                  <div className="text-xs text-gray-500">/ 100</div>
                                </div>
                              </td>
                            );
                          })()}
                        </tr>
                        <tr className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="p-3 font-medium flex items-center">
                            <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                            </svg>
                            搜尋功能
                          </td>
                          {appData.map((app, index) => {
                            const score = app.uxScores.search;
                            const categoryAvg = calculateCategoryAverage(appData, 'search');
                            const style = getHeatmapStyle(score, categoryAvg);
                            return (
                              <td key={`${app.id}-search`} className="p-3" style={{ width: `calc((100% - 340px) / ${appData.length})` }}>
                                <div style={style} className="py-2 px-2 rounded-md flex items-center justify-center">
                                  <div className="font-medium" style={{ color: style.color }}>{score}</div>
                              </div>
                            </td>
                            );
                          })}
                          {(() => {
                            const avgScore = calculateCategoryAverage(appData, 'search');
                            return (
                              <td className="text-center p-3 font-medium bg-gray-50" style={{ width: '160px' }}>
                                <div className="flex items-center justify-center space-x-2">
                                  <div className="text-gray-700 font-medium">{avgScore}</div>
                                  <div className="text-xs text-gray-500">/ 100</div>
                                </div>
                              </td>
                            );
                          })()}
                        </tr>
                        <tr className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="p-3 font-medium flex items-center">
                            <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path>
                            </svg>
                            商品相關
                          </td>
                          {appData.map((app, index) => {
                            const score = app.uxScores.product;
                            const categoryAvg = calculateCategoryAverage(appData, 'product');
                            const style = getHeatmapStyle(score, categoryAvg);
                            return (
                              <td key={`${app.id}-product`} className="p-3" style={{ width: `calc((100% - 340px) / ${appData.length})` }}>
                                <div style={style} className="py-2 px-2 rounded-md flex items-center justify-center">
                                  <div className="font-medium" style={{ color: style.color }}>{score}</div>
                              </div>
                            </td>
                            );
                          })}
                          {(() => {
                            const avgScore = calculateCategoryAverage(appData, 'product');
                            return (
                              <td className="text-center p-3 font-medium bg-gray-50" style={{ width: '160px' }}>
                                <div className="flex items-center justify-center space-x-2">
                                  <div className="text-gray-700 font-medium">{avgScore}</div>
                                  <div className="text-xs text-gray-500">/ 100</div>
                                </div>
                              </td>
                            );
                          })()}
                        </tr>
                        <tr className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="p-3 font-medium flex items-center">
                            <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path>
                            </svg>
                            結帳付款
                          </td>
                          {appData.map((app, index) => {
                            const score = app.uxScores.checkout;
                            const categoryAvg = calculateCategoryAverage(appData, 'checkout');
                            const style = getHeatmapStyle(score, categoryAvg);
                            return (
                              <td key={`${app.id}-checkout`} className="p-3" style={{ width: `calc((100% - 340px) / ${appData.length})` }}>
                                <div style={style} className="py-2 px-2 rounded-md flex items-center justify-center">
                                  <div className="font-medium" style={{ color: style.color }}>{score}</div>
                              </div>
                            </td>
                            );
                          })}
                          {(() => {
                            const avgScore = calculateCategoryAverage(appData, 'checkout');
                            return (
                              <td className="text-center p-3 font-medium bg-gray-50" style={{ width: '160px' }}>
                                <div className="flex items-center justify-center space-x-2">
                                  <div className="text-gray-700 font-medium">{avgScore}</div>
                                  <div className="text-xs text-gray-500">/ 100</div>
                                </div>
                              </td>
                            );
                          })()}
                        </tr>
                        <tr className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="p-3 font-medium flex items-center">
                            <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"></path>
                            </svg>
                            客戶服務
                          </td>
                          {appData.map((app, index) => {
                            const score = app.uxScores.service;
                            const categoryAvg = calculateCategoryAverage(appData, 'service');
                            const style = getHeatmapStyle(score, categoryAvg);
                            return (
                              <td key={`${app.id}-service`} className="p-3" style={{ width: `calc((100% - 340px) / ${appData.length})` }}>
                                <div style={style} className="py-2 px-2 rounded-md flex items-center justify-center">
                                  <div className="font-medium" style={{ color: style.color }}>{score}</div>
                              </div>
                            </td>
                            );
                          })}
                          {(() => {
                            const avgScore = calculateCategoryAverage(appData, 'service');
                            return (
                              <td className="text-center p-3 font-medium bg-gray-50" style={{ width: '160px' }}>
                                <div className="flex items-center justify-center space-x-2">
                                  <div className="text-gray-700 font-medium">{avgScore}</div>
                                  <div className="text-xs text-gray-500">/ 100</div>
                                </div>
                              </td>
                            );
                          })()}
                        </tr>
                        <tr className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="p-3 font-medium flex items-center">
                            <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                            </svg>
                            其他功能
                          </td>
                          {appData.map((app, index) => {
                            const score = app.uxScores.other;
                            const categoryAvg = calculateCategoryAverage(appData, 'other');
                            const style = getHeatmapStyle(score, categoryAvg);
                            return (
                              <td key={`${app.id}-others`} className="p-3" style={{ width: `calc((100% - 340px) / ${appData.length})` }}>
                                <div style={style} className="py-2 px-2 rounded-md flex items-center justify-center">
                                  <div className="font-medium" style={{ color: style.color }}>{score}</div>
                              </div>
                            </td>
                            );
                          })}
                          {(() => {
                            const avgScore = calculateCategoryAverage(appData, 'other');
                            return (
                              <td className="text-center p-3 font-medium bg-gray-50" style={{ width: '160px' }}>
                                <div className="flex items-center justify-center space-x-2">
                                  <div className="text-gray-700 font-medium">{avgScore}</div>
                                  <div className="text-xs text-gray-500">/ 100</div>
                                </div>
                              </td>
                            );
                          })()}
                        </tr>
                        <tr className="border-t-2 border-gray-300 bg-gray-50 font-medium">
                          <td className="p-3 font-medium flex items-center rounded-bl-md">
                            <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"></path>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"></path>
                            </svg>
                            整體平均
                          </td>
                          {appData.map((app, index) => {
                            const scores = [
                              app.uxScores.memberlogin || 0,
                              app.uxScores.search || 0,
                              app.uxScores.product || 0,
                              app.uxScores.checkout || 0,
                              app.uxScores.service || 0,
                              app.uxScores.other || 0
                            ];
                            const avgScore = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
                            
                            // 計算所有應用的總平均
                            const allScores = appData.flatMap(a => [
                              a.uxScores.memberlogin || 0,
                              a.uxScores.search || 0,
                              a.uxScores.product || 0,
                              a.uxScores.checkout || 0,
                              a.uxScores.service || 0,
                              a.uxScores.other || 0
                            ]);
                            const overallAvg = Math.round(allScores.reduce((sum, score) => sum + score, 0) / allScores.length);
                            
                            const style = getHeatmapStyle(avgScore, overallAvg);
                            return (
                              <td key={`${app.id}-average`} className="p-3" style={{ width: `calc((100% - 340px) / ${appData.length})` }}>
                                <div style={style} className="py-2 px-2 rounded-md flex items-center justify-center">
                                  <div className="font-medium" style={{ color: style.color }}>{avgScore}</div>
                                </div>
                              </td>
                            );
                          })}
                          {(() => {
                            // Calculate overall average across all apps and categories
                            const allScores = appData.flatMap(app => [
                              app.uxScores.memberlogin || 0,
                              app.uxScores.search || 0,
                              app.uxScores.product || 0,
                              app.uxScores.checkout || 0,
                              app.uxScores.service || 0,
                              app.uxScores.other || 0
                            ]);
                            const overallAvg = Math.round(allScores.reduce((sum, score) => sum + score, 0) / allScores.length);
                            return (
                              <td className="text-center p-3 font-medium bg-gray-50 rounded-br-md" style={{ width: '160px' }}>
                                <div className="flex items-center justify-center space-x-2">
                                  <div className="text-gray-700 font-medium text-lg">{overallAvg}</div>
                                  <div className="text-xs text-gray-500">/ 100</div>
                                </div>
                              </td>
                            );
                          })()}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {appData.map((app) => (
                  <Card key={`${app.id}-ux-details`}>
                    <CardHeader>
                      <CardTitle>{app.name} 用戶體驗分析</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        <div>
                          <h4 className="font-medium mb-3 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>
                              <path d="M8 11h8"/>
                              <path d="M12 15V7"/>
                            </svg>
                            優點
                          </h4>
                          <ul className="space-y-2">
                            {app.uxAnalysis?.strengths.map((strength, index) => (
                              <li key={index} className="flex items-start gap-2">
                                <svg className="w-5 h-5 text-emerald-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                <span className="text-sm">{strength}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <h4 className="font-medium mb-3 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
                              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                              <line x1="12" y1="17" x2="12.01" y2="17"/>
                            </svg>
                            缺點
                          </h4>
                          <ul className="space-y-2">
                            {app.uxAnalysis?.improvements.map((improvement, index) => (
                              <li key={index} className="flex items-start gap-2">
                                <svg className="w-5 h-5 text-rose-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                                </svg>
                                <span className="text-sm">{improvement}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                          <h4 className="text-base font-medium text-slate-800 mb-3 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                            </svg>
                            整體分析摘要
                          </h4>
                          <div className="text-sm text-slate-700 space-y-2">
                            <p>{app.uxAnalysis?.summary}</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="reviews" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {appData.map((currentApp) => (
                  <Card key={`${currentApp.id}-reviews`} className="overflow-hidden">
                    <CardHeader className="border-b bg-gray-50">
                      <div className="flex items-center gap-4">
                        <img 
                          src={currentApp.logo} 
                          alt={currentApp.name} 
                          className="w-12 h-12 rounded-lg shadow-sm"
                        />
                        <div className="flex-1">
                          <CardTitle className="text-lg mb-1">{currentApp.name}</CardTitle>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                              {calculateAverageRating(getFilteredReviews(currentApp.processedReviews, reviewFilters, currentApp.name))}
                            </div>
                            <span className="text-gray-300">|</span>
                            <span>評論 {getFilteredReviews(currentApp.processedReviews, reviewFilters, currentApp.name).length}</span>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="space-y-8">
                        <div className="flex flex-wrap gap-4 items-center justify-between">
                          <div className="flex flex-wrap gap-2">
                            <Select
                              value={reviewFilters.sentiment}
                              onValueChange={(value) => setReviewFilters(prev => ({ ...prev, sentiment: value }))}
                            >
                              <SelectTrigger className="w-[140px] bg-white">
                                <SelectValue placeholder="情感篩選" />
                              </SelectTrigger>
                              <SelectContent className="bg-white">
                                <SelectItem value="all">全部評論</SelectItem>
                                <SelectItem value="positive">正面評論</SelectItem>
                                <SelectItem value="negative">負面評論</SelectItem>
                              </SelectContent>
                            </Select>
                            
                            <Select
                              value={reviewFilters.sortBy}
                              onValueChange={(value) => setReviewFilters(prev => ({ ...prev, sortBy: value }))}
                            >
                              <SelectTrigger className="w-[140px] bg-white">
                                <SelectValue placeholder="排序方式" />
                              </SelectTrigger>
                              <SelectContent className="bg-white">
                                <SelectItem value="date">依日期</SelectItem>
                                <SelectItem value="rating">依評分</SelectItem>
                              </SelectContent>
                            </Select>

                            <Button
                              variant="outline"
                              size="icon"
                              className="bg-white"
                              onClick={() => setReviewFilters(prev => ({
                                ...prev,
                                sortOrder: prev.sortOrder === 'desc' ? 'asc' : 'desc'
                              }))}
                            >
                              {reviewFilters.sortOrder === 'desc' ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronUp className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-6">
                          {/* 評論列表 */}
                          <div className="space-y-4">
                            <div className="p-4 bg-gray-50 rounded-lg border">
                              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                                {getFilteredReviews(currentApp.processedReviews, reviewFilters, currentApp.name).map((review: Review, index: number) => (
                                  <div 
                                    key={index} 
                                    className={`bg-white rounded-lg p-3 shadow-sm transition-all duration-200 ${
                                      review.sentiment.includes('正面') ? 'hover:border-emerald-200' : 
                                      review.sentiment.includes('負面') ? 'hover:border-rose-200' : 
                                      'hover:border-gray-200'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <div className="flex items-center">
                                          {[...Array(5)].map((_, i) => (
                                            <Star
                                              key={i}
                                              className={`h-3 w-3 ${
                                                i < review.rating
                                                  ? "fill-yellow-400 text-yellow-400"
                                                  : "fill-gray-200 text-gray-200"
                                              }`}
                                            />
                                          ))}
                                        </div>
                                        <span className="text-xs text-gray-500 md:text-sm">
                                          {new Date(review.date).toLocaleDateString('zh-TW')}
                                        </span>
                                      </div>
                                      <Badge 
                                        variant="outline" 
                                        className={`
                                          ${review.sentiment.includes('正面') 
                                            ? 'text-emerald-600 border-emerald-200 bg-emerald-50' 
                                            : review.sentiment.includes('負面')
                                            ? 'text-rose-600 border-rose-200 bg-rose-50'
                                            : 'text-gray-600 border-gray-200 bg-gray-50'
                                          }
                                        `}
                                      >
                                        {review.platform}
                                      </Badge>
                                    </div>
                                    <div className="relative">
                                      <p className={`text-sm md:text-base text-gray-700 ${
                                        expandedReviews[`${currentApp.id}-${index}`] ? '' : 'line-clamp-3'
                                      } transition-all duration-200`}>
                                        {review.review}
                                      </p>
                                      <button 
                                        className="text-xs text-blue-600 hover:text-blue-800 mt-1 focus:outline-none"
                                        onClick={() => toggleReviewExpand(`${currentApp.id}-${index}`)}
                                      >
                                        {expandedReviews[`${currentApp.id}-${index}`] ? '收起' : '展開全文'}
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* 評論統計和分析 */}
                          <div className="space-y-4">
                            <div className="p-4 bg-white rounded-lg border">
                              <h5 className="text-base font-medium mb-4">評論統計</h5>
                              <div className="space-y-4">
                                <div>
                                  <div className="flex justify-between text-sm mb-1">
                                    <span>正面評價</span>
                                    <span>{currentApp.reviewStats.positive}%</span>
                                  </div>
                                  <Progress value={currentApp.reviewStats.positive} className="bg-gray-100" />
                                </div>
                                <div>
                                  <div className="flex justify-between text-sm mb-1">
                                    <span>負面評價</span>
                                    <span>{currentApp.reviewStats.negative}%</span>
                                  </div>
                                  <Progress value={currentApp.reviewStats.negative} className="bg-gray-100" />
                                </div>
                              </div>
                            </div>

                            <div className="p-4 bg-white rounded-lg border">
                              <h5 className="text-base font-medium mb-4">熱門關鍵詞</h5>
                              <div className="flex flex-wrap gap-2">
                                {currentApp.keywordFrequency.map((item: { keyword: string; count: number }, index: number) => (
                                  <Badge 
                                    key={index}
                                    variant="secondary"
                                    className={`
                                      ${index === 0 ? 'bg-sky-100 text-sky-800 hover:bg-sky-200' : 
                                        index === 1 ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' :
                                        index === 2 ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' :
                                        'bg-gray-100 text-gray-800 hover:bg-gray-200'}
                                    `}
                                  >
                                    {item.keyword} ({item.count})
                                  </Badge>
                                ))}
                              </div>
                            </div>

                            <Button 
                              className="w-full" 
                              variant="outline"
                              onClick={() => setShowAnalysisSummary(currentApp.id)}
                            >
                              查看完整評論分析
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="comparison" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>具體改進建議</CardTitle>
                  <CardDescription>基於競品分析的具體改進方向與解決方案</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-6">
                    {appData.map((app) => (
                      <AppImprovementSuggestions key={`${app.id}-solutions`} app={app} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {showAnalysisSummary && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto">
          <div className="my-8 w-full max-w-3xl mx-4">
            <div className="bg-white rounded-xl shadow-xl flex flex-col">
              {appData.map((app) => {
                if (app.id === showAnalysisSummary) {
                  return (
                    <div key={app.id} className="flex flex-col">
                      <div className="sticky top-0 z-10 bg-white rounded-t-xl border-b">
                        <div className="p-6">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                              <img src={app.logo} alt={app.name} className="w-10 h-10 rounded-lg" />
                              <div>
                                <h3 className="text-xl font-semibold">{app.name}</h3>
                                <p className="text-sm text-gray-500">評論分析摘要</p>
                              </div>
                            </div>
                            <button
                              onClick={() => setShowAnalysisSummary(null)}
                              className="rounded-full p-2 hover:bg-gray-100 transition-colors"
                            >
                              <X className="h-5 w-5 text-gray-500" />
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex-1">
                        <div className="px-6 py-4 bg-gradient-to-b from-gray-50 to-white">
                          <div className="flex items-center gap-2 mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500">
                              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>
                              <path d="M8 11h8"/>
                              <path d="M12 15V7"/>
                            </svg>
                            <h4 className="font-medium text-lg">優點</h4>
                          </div>
                          <div className="space-y-3 ml-6">
                            {app.reviewAnalysis?.advantages.map((advantage: string, index: number) => (
                              <div key={index} className="flex items-start gap-3 group">
                                <div className="mt-1.5">
                                  <div className="w-2 h-2 rounded-full bg-emerald-500 group-hover:scale-125 transition-transform" />
                                </div>
                                <p className="text-gray-600 leading-relaxed group-hover:text-gray-900 transition-colors">{advantage}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="px-6 py-4">
                          <div className="flex items-center gap-2 mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
                              <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
                              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                              <line x1="12" y1="17" x2="12.01" y2="17"/>
                            </svg>
                            <h4 className="font-medium text-lg">缺點</h4>
                          </div>
                          <div className="space-y-3 ml-6">
                            {app.reviewAnalysis?.improvements.map((improvement: string, index: number) => (
                              <div key={index} className="flex items-start gap-3 group">
                                <div className="mt-1.5">
                                  <div className="w-2 h-2 rounded-full bg-amber-500 group-hover:scale-125 transition-transform" />
                                </div>
                                <p className="text-gray-600 leading-relaxed group-hover:text-gray-900 transition-colors">{improvement}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="px-6 py-4 bg-gradient-to-b from-gray-50 to-white">
                          <div className="flex items-center gap-2 mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
                              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                            </svg>
                            <h4 className="font-medium text-lg">整體評論摘要</h4>
                          </div>
                          <div className="bg-white rounded-lg border border-gray-100 p-4 shadow-sm">
                            <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{app.reviewAnalysis?.summary}</p>
                          </div>
                        </div>
                      </div>

                      <div className="sticky bottom-0 z-10 bg-gray-50 rounded-b-xl border-t">
                        <div className="p-6 flex justify-end">
                          <Button variant="outline" onClick={() => setShowAnalysisSummary(null)}>
                            關閉
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 