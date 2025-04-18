import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
// 使用 require 方式導入
const { parse } = require('csv-parse/sync');
import type { AnalysisResult } from '@/types/feedback';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

// 請求佇列類別
class RequestQueue {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private concurrentLimit = 2; // 限制並發請求數
  private activeRequests = 0;

  async add<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await request();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing || this.activeRequests >= this.concurrentLimit) return;
    this.processing = true;

    while (this.queue.length > 0 && this.activeRequests < this.concurrentLimit) {
      const request = this.queue.shift();
      if (request) {
        this.activeRequests++;
        try {
          await request();
        } finally {
          this.activeRequests--;
        }
      }
    }

    this.processing = false;
    if (this.queue.length > 0) {
      this.processQueue();
    }
  }
}

// 創建請求佇列實例
const requestQueue = new RequestQueue();

// Hugging Face API 端點
const SENTIMENT_MODEL_API = "https://api-inference.huggingface.co/models/jackietung/bert-base-chinese-finetuned-sentiment";
const CATEGORY_MODEL_API = "https://api-inference.huggingface.co/models/jackietung/bert-base-chinese-finetuned-multi-classification";

// Hugging Face API 密鑰
const HF_API_KEY = process.env.NEXT_PUBLIC_HUGGING_FACE_API_KEY || "";

// 添加中文斷詞 API 配置
const CHINESE_API_URL = process.env.NEXT_PUBLIC_CHINESE_API_URL || "https://chinese-nlp-api.onrender.com/api/v1/keywords";
const CHINESE_API_KEY = process.env.NEXT_PUBLIC_CHINESE_API_KEY || "";

// 添加英文斷詞 API 配置
const ENGLISH_API_URL = process.env.NEXT_PUBLIC_ENGLISH_API_URL || "https://english-nlp-api.onrender.com/api/v1/keywords";
const ENGLISH_API_KEY = process.env.NEXT_PUBLIC_ENGLISH_API_KEY || "";

// 延遲函數
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 帶重試機制的 API 調用函數
async function callHuggingFaceAPI(url: string, text: string, maxRetries: number = 3): Promise<any> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      // 使用請求佇列來控制並發
      return await requestQueue.add(async () => {
        const response = await axios.post(
          url,
          { inputs: text },
          {
            headers: {
              "Authorization": `Bearer ${HF_API_KEY}`,
              "Content-Type": "application/json"
            }
          }
        );
        return response.data;
      });
    } catch (error: any) {
      if (error.response?.status === 503) {
        console.log(`模型服務暫時不可用，等待後重試... (第 ${i + 1} 次)`);
        // 使用指數退避策略，基礎等待時間為 2 秒，最多等待 30 秒
        const waitTime = Math.min(2000 * Math.pow(2, i), 30000);
        console.log(`等待 ${waitTime/1000} 秒後重試...`);
        await delay(waitTime);
        continue;
      }
      throw error;
    }
  }
  throw new Error('超過最大重試次數');
}

// 情感分析函數
async function analyzeSentiment(text: string): Promise<string> {
  try {
    const result = await callHuggingFaceAPI(SENTIMENT_MODEL_API, text);
    console.log("情感分析原始結果:", JSON.stringify(result, null, 2));
    
    if (Array.isArray(result) && result.length > 0) {
      console.log("情感分析第一層結果:", JSON.stringify(result[0], null, 2));
      
      // 找出最高分數的情感
      const highestScore = result[0].reduce((prev: any, current: any) => {
        console.log("比較情感分數:", { prev, current });
        return (prev.score > current.score) ? prev : current;
      });
      
      console.log("選中的最高分數情感:", highestScore);

      // 直接使用中文標籤
      const validLabels = ["正面", "中性", "負面"];
      if (validLabels.includes(highestScore.label)) {
        return highestScore.label;
      }
      
      console.log("未知的情感標籤:", highestScore.label);
      return "未標記";
    }
    console.log("情感分析結果格式不符合預期:", result);
    return "未標記"; // 默認情感
  } catch (error) {
    console.error("情感分析錯誤:", error);
    return "未標記"; // 出錯時返回未標記
  }
}

// 分類分析函數
async function analyzeCategory(text: string): Promise<string[]> {
  try {
    const result = await callHuggingFaceAPI(CATEGORY_MODEL_API, text);
    console.log("分類分析原始結果:", JSON.stringify(result, null, 2));
    
    if (Array.isArray(result) && result.length > 0) {
      console.log("分類分析第一層結果:", JSON.stringify(result[0], null, 2));
      
      // 找出最高分數的分類
      const highestScore = result[0].reduce((prev: any, current: any) => {
        console.log(`比較分類分數: ${prev.label}(${prev.score}) vs ${current.label}(${current.score})`);
        return (prev.score > current.score) ? prev : current;
      });
      
      console.log("選中的最高分數分類:", highestScore);
      return [highestScore.label];
    }
    console.log("分類分析結果格式不符合預期:", result);
    return ["未標記"]; // 默認分類
  } catch (error) {
    console.error("分類分析錯誤:", error);
    return ["未標記"]; // 出錯時返回未標記
  }
}

// 批次處理函數
async function processBatch<T>(
  items: string[],
  processor: (item: string) => Promise<T>,
  batchSize: number = 5
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    console.log(`處理批次 ${i/batchSize + 1}/${Math.ceil(items.length/batchSize)}, 大小: ${batch.length}`);
    
    const batchPromises = batch.map(item => processor(item));
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // 批次之間添加延遲，避免過度請求
    if (i + batchSize < items.length) {
      await delay(1000);
    }
  }
  return results;
}

// 修改斷詞函數以支援中英文
async function segmentText(text: string, language: string): Promise<string[]> {
  try {
    // 根據語言選擇對應的 API
    const apiUrl = language === 'zh' ? CHINESE_API_URL : ENGLISH_API_URL;
    const apiKey = language === 'zh' ? CHINESE_API_KEY : ENGLISH_API_KEY;

    const response = await axios.post(
      apiUrl,
      { text, top_n: 10 },
      {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        }
      }
    );
    
    // 從回應中提取關鍵詞數組
    if (response.data && response.data.keywords) {
      return response.data.keywords;
    }
    
    console.error("API 回應格式不符合預期:", response.data);
    return [];
  } catch (error) {
    console.error(`${language === 'zh' ? '中文' : '英文'}關鍵詞提取 API 錯誤:`, error);
    return [];
  }
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const sendMessage = async (message: any) => {
    await writer.write(
      encoder.encode(JSON.stringify(message) + '\n')
    );
  };

  const updateProgress = async (percentage: number, step: string) => {
    await sendMessage({
      type: 'progress',
      data: {
        percentage,
        step
      }
    });
  };

  const sendResult = async (result: any) => {
    await sendMessage({
      type: 'result',
      data: result
    });
  };

  const sendError = async (error: string) => {
    await sendMessage({
      type: 'error',
      data: error
    });
  };

  (async () => {
    try {
      const formData = await request.formData();
      const file = formData.get('file') as File;

      if (!file) {
        throw new Error('未找到文件');
      }

      await updateProgress(5, '準備分析文件');

      const buffer = await file.arrayBuffer();
      let data: any[] = [];

      // 文件解析
      try {
        await updateProgress(10, '解析文件格式');
        
        if (file.name.endsWith('.csv')) {
          // CSV 文件處理
          await updateProgress(15, '處理 CSV 文件');
          // 改進 CSV 編碼處理
          const encodings = ['utf-8', 'big5'];
          let content = '';
          let parseError = null;

          for (const encoding of encodings) {
            try {
              const decoder = new TextDecoder(encoding);
              content = decoder.decode(buffer);
              
              // 嘗試解析 CSV，添加更多的解析選項
              data = parse(content, {
                columns: true,
                skip_empty_lines: true,
                trim: true,
                delimiter: ',',
                relaxColumnCount: true,
                relaxQuotes: true,
                skipRecordsWithError: true,
                comment: '#', // 忽略註釋行
                quote: '"', // 指定引號字符
                escape: '\\' // 指定轉義字符
              });

              // 檢查是否成功解析到資料並打印調試信息
              if (data && data.length > 0) {
                const columns = Object.keys(data[0]);
                console.log('=== CSV 解析結果 ===');
                console.log('使用編碼:', encoding);
                console.log('解析到的欄位:', columns);
                console.log('第一筆資料:', data[0]);
                
                // 檢查欄位名稱是否包含特殊字符或 BOM
                const cleanColumns = columns.map(col => {
                  // 移除可能的 BOM 和特殊字符
                  return col.replace(/^\uFEFF/, '').trim();
                });
                
                // 更新資料的欄位名稱
                data = data.map(row => {
                  const newRow: any = {};
                  Object.entries(row).forEach(([key, value]) => {
                    const cleanKey = key.replace(/^\uFEFF/, '').trim();
                    newRow[cleanKey] = value;
                  });
                  return newRow;
                });

                // 再次確認清理後的欄位
                console.log('清理後的欄位:', Object.keys(data[0]));
                
                // 檢查是否有評論相關欄位
                const hasCommentField = Object.keys(data[0]).some(col => {
                  const colLower = col.toLowerCase();
                  return colLower.includes('評論') || 
                         colLower.includes('內容') || 
                         colLower.includes('content') || 
                         colLower.includes('comment') || 
                         colLower.includes('feedback') || 
                         colLower.includes('意見') || 
                         colLower.includes('建議');
                });

                if (hasCommentField) {
                  break; // 找到有效的資料，跳出循環
                } else {
                  console.log('未找到評論相關欄位，繼續嘗試其他編碼');
                }
              }
            } catch (e) {
              parseError = e;
              console.error(`使用 ${encoding} 解析失敗:`, e);
              continue;
            }
          }

          if (!data || data.length === 0) {
            console.error('CSV 解析失敗，所有嘗試都失敗了');
            throw new Error('無法解析 CSV 文件或檔案為空');
          }

        } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          // Excel 文件處理
          await updateProgress(15, '處理 Excel 文件');
          // 改進 Excel 日期處理
          const workbook = XLSX.read(buffer, {
            type: 'array',
            cellDates: true
          });
          
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          
          // 獲取原始數據
          data = XLSX.utils.sheet_to_json(firstSheet, { 
            raw: true,
            defval: ''
          });

          // 處理 Excel 日期格式
          data = data.map(row => {
            const newRow = { ...row };
            Object.entries(row).forEach(([key, value]) => {
              // 檢查是否為日期欄位
              if (key.toLowerCase().includes('日期') || 
                  key.toLowerCase().includes('date') || 
                  key.toLowerCase().includes('time')) {
                if (value) {
                  let dateStr = '';
                  if (value instanceof Date) {
                    // 如果是日期對象
                    dateStr = formatDate(value);
                  } else if (typeof value === 'number') {
                    // 如果是 Excel 序列號
                    const date = XLSX.SSF.parse_date_code(value);
                    dateStr = `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
                  } else if (typeof value === 'string') {
                    // 如果是字符串，嘗試解析
                    try {
                      const date = new Date(value);
                      if (!isNaN(date.getTime())) {
                        dateStr = formatDate(date);
                      } else {
                        dateStr = value; // 保持原始值
                      }
                    } catch {
                      dateStr = value; // 保持原始值
                    }
                  }
                  newRow[key] = dateStr;
                }
              }
            });
            return newRow;
          });
        } else {
          throw new Error('不支援的文件格式');
        }

        await updateProgress(30, '文件解析完成');

        // 檢查數據是否為空
        if (!data || data.length === 0) {
          throw new Error('文件中沒有數據');
        }

        // 在 normalizedData 映射之前，添加欄位檢查
        if (data && data.length > 0) {
          console.log('=== 欄位匹配檢查 ===');
          const firstRow = data[0];
          const columns = Object.keys(firstRow);
          
          // 檢查並打印所有可能的評論欄位
          const possibleCommentFields = columns.filter(col => {
            const colLower = col.toLowerCase();
            return colLower.includes('評論') || 
                   colLower.includes('內容') || 
                   colLower.includes('content') || 
                   colLower.includes('comment') || 
                   colLower.includes('feedback') || 
                   colLower.includes('意見') || 
                   colLower.includes('建議');
          });
          
          console.log('可能的評論欄位:', possibleCommentFields);
          console.log('所有可用欄位:', columns);
        }

        // 標準化欄位名稱
        // 使用 Promise.all 處理所有行的異步操作
        const normalizedDataPromises = [];
        const batchSize = 5; // 每批處理 5 條評論
        
        for (let i = 0; i < data.length; i += batchSize) {
          const batch = data.slice(i, i + batchSize);
          const batchPromises = batch.map(async (row, index) => {
            // 如果是第一行，打印欄位名稱以便調試
            if (index === 0) {
              console.log('檔案欄位:', Object.keys(row));
            }

            // 建立一個函數來尋找符合關鍵字的欄位值
            const findColumn = (terms: string[]) => {
              const foundKey = Object.keys(row).find(key => 
                terms.some(term => key.toLowerCase().includes(term.toLowerCase()))
              );
              return foundKey ? row[foundKey] : null;
            };

            // 公司處理
            const companyTerms = ['公司', 'company', 'brand', '品牌', 'app', '應用程式'];
            const company = findColumn(companyTerms) || '未知';

            // 內容處理（必要欄位）
            const contentTerms = [
              '評論內容', '內容', 'content', 'comment', 
              'feedback', '評論', '意見', '建議'
            ];
            const content = findColumn(contentTerms);
            if (!content && index === 0) {
              console.log('找不到評論內容欄位，可用欄位:', Object.keys(row));
              console.log('嘗試匹配的關鍵字:', contentTerms);
              throw new Error(`找不到評論內容欄位，請確保檔案包含以下其中一個欄位: ${contentTerms.join(', ')}`);
            }

            // 評分處理（必要欄位）
            const ratingTerms = [
              '用戶評分', '評分', 'rating', 'score', 
              '分數', '星級', 'stars', 'star'
            ];
            const ratingValue = findColumn(ratingTerms);
            if (!ratingValue && index === 0) {
              console.log('找不到評分欄位，可用欄位:', Object.keys(row));
              console.log('嘗試匹配的關鍵字:', ratingTerms);
              throw new Error(`找不到評分欄位，請確保檔案包含以下其中一個欄位: ${ratingTerms.join(', ')}`);
            }

            // 日期處理
            const dateTerms = ['日期', 'date', 'time', '時間', '建立日期', '評論日期'];
            const dateValue = findColumn(dateTerms);
            let formattedDate = dateValue;

            if (dateValue) {
              try {
                const date = new Date(dateValue);
                if (!isNaN(date.getTime())) {
                  formattedDate = formatDate(date);
                }
              } catch (e) {
                console.warn('無法解析日期:', dateValue);
                formattedDate = dateValue; // 保持原始值
              }
            } else {
              formattedDate = formatDate(new Date()); // 使用當前日期
            }

            // 裝置處理
            const deviceTerms = ['裝置', 'device', 'platform', '平台', '系統'];
            const device = findColumn(deviceTerms) || '未知';

            // 語言處理
            const languageTerms = ['語言', 'language', '語系'];
            const language = findColumn(languageTerms) || 'zh'; // 默認使用中文

            // 使用 Hugging Face 模型進行情感分析
            let sentiment = '中性';
            // 使用 Hugging Face 模型進行分類分析
            let categories = ['一般'];

            // 只有當內容存在且不為空時才進行分析
            if (content && content.trim()) {
              try {
                if (HF_API_KEY && HF_API_KEY.length > 10) {
                  try {
                    // 使用批次處理進行分析
                    const [sentimentResult, categoryResult] = await Promise.all([
                      analyzeSentiment(content),
                      analyzeCategory(content)
                    ]);
                    
                    sentiment = sentimentResult;
                    categories = categoryResult;
                    console.log("AI 模型分析成功:", { sentiment, categories });
                  } catch (aiError) {
                    console.error("AI 模型分析失敗，使用默認值:", aiError);
                    sentiment = '中性';
                    categories = ['一般'];
                  }
                } else {
                  console.log("未提供有效的 API 密鑰，使用默認值");
                  sentiment = '中性';
                  categories = ['一般'];
                }
              } catch (error) {
                console.error("分析過程出錯:", error);
                sentiment = '中性';
                categories = ['一般'];
              }
            } else {
              // 如果沒有內容，使用傳統方法
              const sentimentTerms = ['情感', 'sentiment', '情緒'];
              sentiment = findColumn(sentimentTerms) || '中性';

              const categoryTerms = ['分類', 'category', 'type', '類型'];
              const categoryValue = findColumn(categoryTerms);
              categories = categoryValue 
                ? categoryValue.split(/[,，]/).map((c: string) => c.trim()).filter(Boolean)
                : ['一般'];
              
              console.log("無內容，使用傳統方法的標籤:", { sentiment, categories });
            }

            // 關鍵詞處理
            const keywordTerms = ['關鍵詞', 'keywords', 'tags', '標籤', '關鍵字'];
            const keywordsValue = findColumn(keywordTerms);
            let keywords = keywordsValue 
              ? keywordsValue.split(/[,，]/).map((k: string) => k.trim()).filter(Boolean)
              : [];

            // 如果有內容，根據語言使用對應的斷詞 API
            if (content && content.trim()) {
              try {
                const segmentedWords = await segmentText(content, language);
                // 合併現有關鍵詞和斷詞結果，去重
                keywords = Array.from(new Set([...keywords, ...segmentedWords]));
              } catch (error) {
                console.error("斷詞處理錯誤:", error);
              }
            }

            // 更新進度
            const progressPercentage = 40 + Math.floor((i / data.length) * 30);
            await updateProgress(
              progressPercentage,
              `正在處理第 ${i + 1} 至 ${Math.min(i + batchSize, data.length)} 筆資料`
            );

            return {
              id: `review-${index}`,
              company: company,
              date: formattedDate,
              content: content,
              rating: parseFloat(ratingValue) || 0,
              device: device,
              category: categories.join(', '),
              sentiment: sentiment,
              keywords: keywords
            };
          });
          
          const batchResults = await Promise.all(batchPromises);
          normalizedDataPromises.push(...batchResults);
          
          if (i + batchSize < data.length) {
            await delay(1000);
          }
        }

        await updateProgress(70, '數據分析中');

        // 計算關鍵詞出現頻率
        const keywordCounts = normalizedDataPromises.reduce((acc, row) => {
          row.keywords.forEach((keyword: string) => {
            acc[keyword] = (acc[keyword] || 0) + 1;
          });
          return acc;
        }, {} as Record<string, number>);

        await updateProgress(80, '生成分析報告');

        // 轉換為所需的關鍵詞格式
        const keywordsList = Object.entries(keywordCounts)
          .map(([word, count]) => ({ word, count }))
          .sort((a, b) => b.count - a.count);

        // 生成分析結果
        const analysisResult: AnalysisResult = {
          feedbacks: normalizedDataPromises,
          keywords: keywordsList,
          summary: {
            totalCount: normalizedDataPromises.length,
            averageRating: calculateAverageRating(normalizedDataPromises),
            positiveRatio: calculateSentimentRatio(normalizedDataPromises, '正面'),
            neutralRatio: calculateSentimentRatio(normalizedDataPromises, '中性'),
            negativeRatio: calculateSentimentRatio(normalizedDataPromises, '負面')
          }
        };

        await updateProgress(90, '完成分析');
        await sendResult(analysisResult);
        await updateProgress(100, '分析完成');

      } catch (parseError: any) {
        throw new Error(`解析文件失敗: ${parseError.message}`);
      }

    } catch (error: any) {
      await sendError(error.message || '處理文件時發生錯誤');
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// 統一的日期格式化函數
function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// 計算平均評分
function calculateAverageRating(feedbacks: any[]): number {
  return feedbacks.reduce((acc, row) => acc + row.rating, 0) / feedbacks.length;
}

// 計算情感比例
function calculateSentimentRatio(feedbacks: any[], sentiment: string): number {
  return feedbacks.filter(row => row.sentiment.includes(sentiment)).length / feedbacks.length;
}
