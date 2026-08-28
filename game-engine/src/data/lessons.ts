import { Lesson } from '../types/lesson'

// Mapping from lesson_id to lesson number
const lessonMapping = {
  "4ffe89bd-cef6-4468-85dd-c8a3358e563f": 0,
  "a1b2c3d4-e5f6-47a8-9b0c-1d2e3f4a5b6c": 1, 
  "b2c3d4e5-f6a7-58b9-ac0d-2e3f4a5b6c7d": 2, 
  "d4e5f6a7-b8c9-7adb-ce2f-4a5b6c7d8e9f": 3, 
  "c3d4e5f6-a7b8-69ca-bd1e-3f4a5b6c7d8e": 4, 
  "e5f6a7b8-c9da-8bec-df3a-5b6c7d8e9f0a": 5
}

// Function to get lesson_id from lesson number
const getLessonId = (lessonNumber: number): string => {
  for (const [id, number] of Object.entries(lessonMapping)) {
    if (number === lessonNumber) {
      return id;
    }
  }
  throw new Error(`No lesson ID found for lesson number ${lessonNumber}`);
}

export const lessons: Lesson[] = [
  {
    lesson_id: getLessonId(0),
    number: 0,
    title: "前導課程：Excel 基本觀念",
    description: "認識 Excel 的介面、儲存格概念與常見操作，建立學習基礎",
    content: `
      <div class="p-4">
        <h2 class="text-2xl font-bold mb-4 text-blue-600 border-b pb-2">開始之前：打好 Excel 基礎</h2>
        <p class="mb-4">在進入挑戰關卡前，先用幾分鐘快速建立 Excel 的基本觀念，之後學習函數與分析時會更順利。</p>

        <div class="mb-6">
          <h3 class="text-xl font-bold mb-2 text-blue-700">介面與核心概念</h3>
          <ul class="list-disc ml-5 space-y-1 bg-gray-50 p-3 rounded">
            <li>工作簿（Workbook）與工作表（Sheet）</li>
            <li>儲存格（Cell）與儲存格參照（如 A1、B2）</li>
            <li>相對參照與絕對參照：A1 vs $A$1</li>
            <li>常見資料型態：數值、文字、日期</li>
          </ul>
        </div>

        <div class="mb-6">
          <h3 class="text-xl font-bold mb-2 text-blue-700">常見操作</h3>
          <ul class="list-disc ml-5 space-y-1 bg-gray-50 p-3 rounded">
            <li>快速輸入與自動填滿（拖曳填滿控制柄）</li>
            <li>格式化數值（千分位、小數位）</li>
            <li>排序與篩選（資料 > 篩選）</li>
            <li>建立簡易圖表（插入 > 圖表）</li>
          </ul>
        </div>

        <div class="mb-6">
          <h3 class="text-xl font-bold mb-2 text-blue-700">公式入門</h3>
          <div class="bg-gray-50 p-3 rounded mb-3 font-mono border-l-4 border-blue-500">=A1 + B1</div>
          <p class="mb-2">所有公式都以等號（=）開頭，並可結合儲存格與函數。接下來的關卡會帶你從 SUM、AVERAGE 到 IF、VLOOKUP 等常用函數。</p>
        </div>

        <div class="mb-4 bg-gray-50 p-4">
          <p class="mb-2">💡 <span class="font-bold">學習建議：</span></p>
          <ul class="list-disc ml-5 space-y-1">
            <li>遇到複雜問題時先拆解成小步驟</li>
            <li>多利用範例練習，熟悉輸入與參照規則</li>
            <li>善用快捷鍵：Ctrl+C/V 複製貼上、Ctrl+Z 復原</li>
          </ul>
        </div>
      </div>
    `,
  },
  {
    lesson_id: getLessonId(1),
    number: 1, 
    title: "基礎函數入門",
    description: "學習 Excel 中最基本的 SUM、AVERAGE、COUNT 等函數",
    content: `
      <div class="p-4">
        <h2 class="text-2xl font-bold mb-4 text-blue-600 border-b pb-2">Excel 基礎函數入門</h2>
        <p class="mb-4">歡迎來到 Excel 函數的世界！函數是 Excel 中的小幫手，能夠幫我們快速處理數據。讓我們從最常用的三個基礎函數開始學習：</p>
        
        <div class="mb-6">
          <h3 class="text-xl font-bold mb-2 text-blue-700">SUM 函數：加總數字</h3>
          <p class="mb-2">SUM 函數就像一個計算機，能夠將多個數字加總起來。無論是兩個數字還是一百個數字，它都能輕鬆完成。</p>
          
          <div class="bg-gray-50 p-3 rounded mb-3 font-mono border-l-4 border-blue-500">
            =SUM(數字1, 數字2, ...)
          </div>
          
          <div class="mb-3">
            <p class="font-bold mb-1">舉例說明：</p>
            <div class="bg-gray-50 p-3 rounded">
              <p>如果儲存格 A1 到 A5 中有數字：10, 20, 30, 40, 50</p>
              <p class="mt-1">那麼 <span class="font-mono text-blue-600">=SUM(A1:A5)</span> 會計算出 150</p>
            </div>
          </div>
        </div>
        
        <div class="mb-6">
          <h3 class="text-xl font-bold mb-2 text-blue-700">AVERAGE 函數：計算平均值</h3>
          <p class="mb-2">AVERAGE 函數幫我們找出一組數字的「中間值」，也就是平均數。它會把所有數字加起來，然後除以數字的數量。</p>
          
          <div class="bg-gray-50 p-3 rounded mb-3 font-mono border-l-4 border-blue-500">
            =AVERAGE(數字1, 數字2, ...)
          </div>
          
          <div class="mb-3">
            <p class="font-bold mb-1">舉例說明：</p>
            <div class="bg-gray-50 p-3 rounded">
              <p>如果儲存格 B1 到 B4 中有成績：85, 90, 78, 95</p>
              <p class="mt-1">那麼 <span class="font-mono text-blue-600">=AVERAGE(B1:B4)</span> 會計算出 87（平均分）</p>
            </div>
          </div>
        </div>

        <div class="mb-6">
          <h3 class="text-xl font-bold mb-2 text-blue-700">COUNT 函數：計算數字個數</h3>
          <p class="mb-2">COUNT 函數像是一位計數員，能夠告訴我們一個範圍中有多少個數字。它只會計算數字，而忽略文字或空白儲存格。</p>
          
          <div class="bg-gray-50 p-3 rounded mb-3 font-mono border-l-4 border-blue-500">
            =COUNT(數值1, 數值2, ...)
          </div>
          
          <div class="mb-3">
            <p class="font-bold mb-1">舉例說明：</p>
            <div class="bg-gray-50 p-3 rounded">
              <p>如果儲存格 C1 到 C6 中有：10, 20, "文字", 30, 空白, 40</p>
              <p class="mt-1">那麼 <span class="font-mono text-blue-600">=COUNT(C1:C6)</span> 會得出 4（只計算四個數字）</p>
            </div>
          </div>
        </div>
        
         <div class="mb-4 bg-gray-50 p-4">
          <p class="mb-2">💡 <span class="font-bold">實用小提示：</span></p>
            <p>如果想要計算範圍中的所有非空儲存格（包括文字），可以使用 COUNTA 函數。例如 <span class="font-mono">=COUNTA(C1:C6)</span> 會得出 5。</p>
          </div>
        </div>
      </div>
    `,
  },
  {
    lesson_id: getLessonId(2),
    number: 2,
    title: "IF 條件函數",
    description: "學習使用 IF 函數進行條件判斷",
    content: `
      <div class="p-4">
        <h2 class="text-2xl font-bold mb-4 text-blue-600 border-b pb-2">IF 條件函數：做決策的好幫手</h2>
        <p class="mb-4">IF 函數就像是我們日常生活中的「如果...那麼...否則...」的思考方式。它可以根據條件的真假，給出不同的結果，是 Excel 中非常實用的函數。</p>
        
        <div class="mb-6">
          <h3 class="text-xl font-bold mb-2 text-blue-700">IF 函數的基本概念</h3>
          <p class="mb-2">想像你是老師，需要判斷學生是否及格（60分以上）。IF 函數可以幫你自動判斷，並給出「及格」或「不及格」的結果。</p>
          
          <div class="bg-gray-50 p-3 rounded mb-3 font-mono border-l-4 border-blue-500">
            =IF(條件判斷, 條件為真時的值, 條件為假時的值)
          </div>
          
          <div class="mb-3">
            <p class="font-bold mb-1">參數解釋：</p>
            <div class="bg-gray-50 p-3 rounded">
              <ul class="space-y-1 list-disc ml-4">
                <li><span class="font-bold text-blue-700">條件判斷：</span> 你想測試的條件（例如成績>=60）</li>
                <li><span class="font-bold text-blue-700">條件為真時的值：</span> 當條件成立時顯示的結果（例如「及格」）</li>
                <li><span class="font-bold text-blue-700">條件為假時的值：</span> 當條件不成立時顯示的結果（例如「不及格」）</li>
              </ul>
            </div>
          </div>
        </div>
        
        <div class="mb-6">
          <h3 class="text-xl font-bold mb-2 text-blue-700">實際案例：成績評定</h3>
          <p class="mb-2">假設儲存格 A2 中有一個學生的分數：75</p>
          
          <div class="mb-4">
            <p class="font-bold mb-1">判斷是否及格：</p>
            <div class="bg-gray-50 p-3 rounded">
              <p class="font-mono text-blue-600">=IF(A2>=60, "及格", "不及格")</p>
              <p class="mt-1">結果：「及格」（因為 75>=60 是成立的）</p>
            </div>
          </div>
          
          <div class="mb-3">
            <p class="font-bold mb-1">更複雜的案例 - 評定等級：</p>
            <table class="border-collapse w-full mb-3 bg-gray-50">
              <thead>
                <tr class="bg-gray-100">
                  <th class="border border-gray-300 p-2 text-left">分數範圍</th>
                  <th class="border border-gray-300 p-2 text-left">等級評定</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="border border-gray-300 p-2">90-100</td>
                  <td class="border border-gray-300 p-2">優秀</td>
                </tr>
                <tr>
                  <td class="border border-gray-300 p-2">80-89</td>
                  <td class="border border-gray-300 p-2">良好</td>
                </tr>
                <tr>
                  <td class="border border-gray-300 p-2">60-79</td>
                  <td class="border border-gray-300 p-2">及格</td>
                </tr>
                <tr>
                  <td class="border border-gray-300 p-2">0-59</td>
                  <td class="border border-gray-300 p-2">不及格</td>
                </tr>
              </tbody>
            </table>
            
            <div class="bg-gray-50 p-3 rounded">
              <p class="font-mono text-blue-600 break-words">=IF(A2>=90, "優秀", IF(A2>=80, "良好", IF(A2>=60, "及格", "不及格")))</p>
              <p class="mt-1">結果：「及格」（因為 75 在 60-79 的範圍內）</p>
            </div>
          </div>
        </div>

        <div class="mb-6">
          <h3 class="text-xl font-bold mb-2 text-blue-700">常見的條件運算符</h3>
          <table class="border-collapse w-full bg-gray-50">
            <thead>
              <tr class="bg-gray-100">
                <th class="border border-gray-300 p-2 text-left">運算符</th>
                <th class="border border-gray-300 p-2 text-left">意義</th>
                <th class="border border-gray-300 p-2 text-left">例子</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="border border-gray-300 p-2">=</td>
                <td class="border border-gray-300 p-2">等於</td>
                <td class="border border-gray-300 p-2 font-mono">A1=100</td>
              </tr>
              <tr>
                <td class="border border-gray-300 p-2">></td>
                <td class="border border-gray-300 p-2">大於</td>
                <td class="border border-gray-300 p-2 font-mono">A1>60</td>
              </tr>
              <tr>
                <td class="border border-gray-300 p-2"><</td>
                <td class="border border-gray-300 p-2">小於</td>
                <td class="border border-gray-300 p-2 font-mono">A1<60</td>
              </tr>
              <tr>
                <td class="border border-gray-300 p-2">>=</td>
                <td class="border border-gray-300 p-2">大於等於</td>
                <td class="border border-gray-300 p-2 font-mono">A1>=90</td>
              </tr>
              <tr>
                <td class="border border-gray-300 p-2"><=</td>
                <td class="border border-gray-300 p-2">小於等於</td>
                <td class="border border-gray-300 p-2 font-mono">A1<=30</td>
              </tr>
              <tr>
                <td class="border border-gray-300 p-2"><></td>
                <td class="border border-gray-300 p-2">不等於</td>
                <td class="border border-gray-300 p-2 font-mono">A1<>0</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div class="mb-6 bg-gray-50 p-4">
          <p class="mb-2">⚠️ <span class="font-bold">初學者注意事項：</span></p>
          <ul class="list-disc ml-6 space-y-1">
            <li>巢狀 IF 函數（IF 裡面還有 IF）不建議超過 3 層，否則會難以閱讀和維護</li>
            <li>如果條件太多，可以考慮使用 IFS 函數（Excel 2019 及以上版本支援）</li>
            <li>條件判斷為 TRUE 時，會執行第二個參數；為 FALSE 時，會執行第三個參數</li>
            <li>條件中可以使用 AND、OR 函數組合多個條件</li>
          </ul>
        </div>
        
        <div class="mb-4 bg-gray-50 p-4">
          <p class="mb-2">💡 <span class="font-bold">實用小提示：</span></p>
          <p>IF 函數不僅可以返回文字，還可以返回數值或計算結果。例如：</p>
          <p class="font-mono mt-1">=IF(A1>100, A1*0.9, A1)</p>
          <p>表示如果 A1 大於 100，則打九折；否則維持原價。</p>
        </div>
      </div>
    `,
  },
  {
    lesson_id: getLessonId(3),
    number: 3,
    title: "樞紐分析表",
    description: "學習創建和使用樞紐分析表",
    content: `
      <div class="p-4">
        <h2 class="text-2xl font-bold mb-4 text-blue-600 border-b pb-2">樞紐分析表：資料分析的強大工具</h2>
        <p class="mb-4">樞紐分析表是 Excel 中最強大的資料分析工具之一。想像你有一份包含上千行的銷售記錄，想快速了解每個月、每個產品或每個銷售人員的業績，樞紐分析表可以幫你輕鬆完成！</p>
        
        <div class="mb-6">
          <h3 class="text-xl font-bold mb-2 text-blue-700">樞紐分析表是什麼？</h3>
          <p class="mb-2">樞紐分析表就像是一個資料魔術師，它可以：</p>
          
          <ul class="list-disc ml-4 bg-gray-50 p-3 rounded mb-3 space-y-1">
            <li>迅速摘要大量資料</li>
            <li>自動計算總和、平均值、計數等</li>
            <li>根據不同角度重新組織資料</li>
            <li>輕鬆生成圖表和視覺化報告</li>
          </ul>
          
          <p>最棒的是，即使原始資料有上萬行，樞紐分析表也能在幾秒鐘內幫你整理出有價值的資訊。</p>
        </div>
        
        <div class="mb-6">
          <h3 class="text-xl font-bold mb-2 text-blue-700">樞紐分析表的基本組成</h3>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div class="bg-gray-50 p-3 rounded">
              <h4 class="font-bold text-blue-600 mb-1">1. 列區域</h4>
              <p>決定資料在哪些列中顯示，例如「產品類別」、「區域」等</p>
            </div>
            <div class="bg-gray-50 p-3 rounded">
              <h4 class="font-bold text-blue-600 mb-1">2. 欄區域</h4>
              <p>決定資料在哪些欄中顯示，例如「月份」、「年份」等</p>
            </div>
            <div class="bg-gray-50 p-3 rounded">
              <h4 class="font-bold text-blue-600 mb-1">3. 值區域</h4>
              <p>要計算的數值，例如「銷售額總和」、「庫存平均值」等</p>
            </div>
            <div class="bg-gray-50 p-3 rounded">
              <h4 class="font-bold text-blue-600 mb-1">4. 篩選區域</h4>
              <p>用於過濾資料，例如「只看特定地區」或「特定年份」</p>
            </div>
          </div>
        </div>

        <div class="mb-6">
          <h3 class="text-xl font-bold mb-2 text-blue-700">建立樞紐分析表的步驟</h3>
          
          <ol class="list-decimal ml-4 space-y-2 mb-3">
            <li class="bg-gray-50 p-3 rounded">
              <p class="font-bold text-blue-700">選擇資料範圍</p>
              <p>確保你的資料有標題行，並且沒有空白列或空白欄</p>
            </li>
            <li class="bg-gray-50 p-3 rounded">
              <p class="font-bold text-blue-700">插入樞紐分析表</p>
              <p>點擊「插入」選項卡 → 點擊「樞紐分析表」按鈕</p>
            </li>
            <li class="bg-gray-50 p-3 rounded">
              <p class="font-bold text-blue-700">設定樞紐分析表位置</p>
              <p>選擇「新工作表」或「現有工作表」中的位置</p>
            </li>
            <li class="bg-gray-50 p-3 rounded">
              <p class="font-bold text-blue-700">拖曳欄位到不同區域</p>
              <p>將欄位拖到「列」、「欄」、「值」和「篩選」區域</p>
            </li>
          </ol>
          
          <div class="mb-4 bg-gray-50 p-4">
            <p class="mb-2">⚠️ <span class="font-bold">初學者提示：</span></p>
            <p>剛開始時，可以先將一個類別拖到「列」區域，將數值欄位拖到「值」區域，觀察結果後再逐步調整。</p>
          </div>
        </div>
        
        <div class="mb-6">
          <h3 class="text-xl font-bold mb-2 text-blue-700">實際案例：銷售資料分析</h3>
          
          <p class="mb-2">假設我們有一份銷售資料，包含以下欄位：</p>
          <table class="border-collapse w-full mb-3 bg-gray-50">
            <thead>
              <tr class="bg-gray-100">
                <th class="border border-gray-300 p-2 text-left">日期</th>
                <th class="border border-gray-300 p-2 text-left">產品</th>
                <th class="border border-gray-300 p-2 text-left">區域</th>
                <th class="border border-gray-300 p-2 text-left">銷售人員</th>
                <th class="border border-gray-300 p-2 text-left">銷售數量</th>
                <th class="border border-gray-300 p-2 text-left">銷售金額</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="border border-gray-300 p-2">2023/1/5</td>
                <td class="border border-gray-300 p-2">筆記型電腦</td>
                <td class="border border-gray-300 p-2">北區</td>
                <td class="border border-gray-300 p-2">張小明</td>
                <td class="border border-gray-300 p-2">2</td>
                <td class="border border-gray-300 p-2">45000</td>
              </tr>
              <tr>
                <td class="border border-gray-300 p-2">2023/1/8</td>
                <td class="border border-gray-300 p-2">滑鼠</td>
                <td class="border border-gray-300 p-2">南區</td>
                <td class="border border-gray-300 p-2">王小華</td>
                <td class="border border-gray-300 p-2">10</td>
                <td class="border border-gray-300 p-2">3000</td>
              </tr>
              <tr class="bg-gray-50">
                <td class="border border-gray-300 p-2" colspan="6">... 更多資料 ...</td>
              </tr>
            </tbody>
          </table>
          
          <div class="bg-gray-50 p-4 rounded mb-4">
            <h4 class="font-bold text-blue-700 mb-2">我們想知道：</h4>
            <ul class="list-disc pl-5 space-y-1">
              <li>各產品的總銷售金額</li>
              <li>各區域的銷售表現</li>
              <li>每個銷售人員的業績</li>
            </ul>
          </div>
          
          <div class="bg-gray-50 p-4 rounded mb-4">
            <h4 class="font-bold text-blue-700 mb-2">建立樞紐分析表：</h4>
            <ul class="list-disc pl-5 space-y-1">
              <li>將「產品」拖到「列」區域</li>
              <li>將「區域」拖到「欄」區域</li>
              <li>將「銷售金額」拖到「值」區域（預設為加總）</li>
              <li>將「銷售人員」拖到「篩選」區域</li>
            </ul>
          </div>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div class="bg-gray-50 p-3 rounded">
            <h3 class="text-lg font-bold mb-1 text-blue-700">常用操作</h3>
            <ul class="list-disc pl-5 space-y-1">
              <li>雙擊值區域單元格可以查看詳細資料</li>
              <li>右鍵點擊值區域可以更改彙總方式（總和、平均值、計數等）</li>
              <li>使用「篩選」按鈕過濾特定資料</li>
              <li>點擊「設計」或「分析」選項卡調整樞紐分析表格式</li>
            </ul>
          </div>

          <div class="bg-gray-50 p-3 rounded">
            <h3 class="text-lg font-bold mb-1 text-blue-700">進階技巧</h3>
            <ul class="list-disc pl-5 space-y-1">
              <li>使用「分組」功能將日期分組（按月、季度、年等）</li>
              <li>添加「計算欄位」創建自訂計算</li>
              <li>使用「切片器」製作互動式報表</li>
              <li>結合「樞紐圖表」創建視覺化報告</li>
            </ul>
          </div>
        </div>
        
        <div class="mb-4 bg-gray-50 p-4">
          <p class="mb-2">💡 <span class="font-bold">實用小提示：</span></p>
          <p>當你的原始資料更新後，只需要右鍵點擊樞紐分析表，選擇「重新整理」，所有分析結果就會自動更新，無需重新建立！</p>
        </div>
      </div>
    `,
  },
  {
    lesson_id: getLessonId(4),
    number: 4,
    title: "VLOOKUP 函數",
    description: "掌握 VLOOKUP 函數的使用方法",
    content: `
      <div class="p-4">
        <h2 class="text-2xl font-bold mb-4 text-blue-600 border-b pb-2">VLOOKUP 函數：查找資料的好幫手</h2>
        <p class="mb-4">VLOOKUP 函數就像是一位圖書館管理員，能夠幫我們在大量數據中快速找到我們需要的資訊。這個函數特別適合處理表格型資料，例如學生名單、產品目錄或銷售記錄。</p>
        
        <div class="mb-6">
          <h3 class="text-xl font-bold mb-2 text-blue-700">VLOOKUP 的基本概念</h3>
          <p class="mb-2">想像你有一張學生成績表，你知道學生的姓名，想找出他的成績。VLOOKUP 可以根據學生姓名（你已知的資訊）查找對應的成績（你想知道的資訊）。</p>
          
          <div class="bg-gray-50 p-3 rounded mb-3 font-mono border-l-4 border-blue-500">
            =VLOOKUP(查找值, 表格範圍, 列號, [是否模糊匹配])
          </div>
          
          <div class="mb-3">
            <p class="font-bold mb-1">參數解釋：</p>
            <div class="bg-gray-50 p-3 rounded">
              <ul class="space-y-1 list-disc ml-4">
                <li><span class="font-bold text-blue-700">查找值：</span> 你已知的資訊（例如學生姓名「小明」）</li>
                <li><span class="font-bold text-blue-700">表格範圍：</span> 包含所有資料的表格（必須把已知資訊放在第一列）</li>
                <li><span class="font-bold text-blue-700">列號：</span> 你想獲取的資訊在第幾列（從左數起，第一列為1）</li>
                <li><span class="font-bold text-blue-700">是否模糊匹配：</span> TRUE 表示近似匹配，FALSE 表示精確匹配（建議初學者使用 FALSE）</li>
              </ul>
            </div>
          </div>
        </div>
        
        <div class="mb-6">
          <h3 class="text-xl font-bold mb-2 text-blue-700">實際案例：學生成績查詢</h3>
          <p class="mb-2">假設我們有一張表格，A1:C5 包含以下資料：</p>
          
          <table class="border-collapse w-full mb-3 bg-gray-50">
            <thead>
              <tr class="bg-gray-100">
                <th class="border border-gray-300 p-2 text-left">學生姓名</th>
                <th class="border border-gray-300 p-2 text-left">數學成績</th>
                <th class="border border-gray-300 p-2 text-left">英語成績</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="border border-gray-300 p-2">小明</td>
                <td class="border border-gray-300 p-2">85</td>
                <td class="border border-gray-300 p-2">92</td>
              </tr>
              <tr>
                <td class="border border-gray-300 p-2">小花</td>
                <td class="border border-gray-300 p-2">90</td>
                <td class="border border-gray-300 p-2">88</td>
              </tr>
              <tr>
                <td class="border border-gray-300 p-2">小華</td>
                <td class="border border-gray-300 p-2">78</td>
                <td class="border border-gray-300 p-2">95</td>
              </tr>
              <tr>
                <td class="border border-gray-300 p-2">小強</td>
                <td class="border border-gray-300 p-2">95</td>
                <td class="border border-gray-300 p-2">80</td>
              </tr>
            </tbody>
          </table>
          
          <div class="mb-3">
            <p class="font-bold mb-1">如果我想查找「小華」的英語成績：</p>
            <div class="bg-gray-50 p-3 rounded">
              <p class="font-mono text-blue-600">=VLOOKUP("小華", $A$1:$C$5, 3, FALSE)</p>
              <p class="mt-1">結果：95（「小華」的英語成績）</p>
            </div>
          </div>
          
          <p class="mb-2">在這個公式中：</p>
          <div class="bg-gray-50 p-3 rounded">
            <ul class="list-disc ml-4 space-y-1">
              <li>"小華" 是我們要查找的值</li>
              <li>A1:C5 是整個表格的範圍</li>
              <li>3 表示我們要返回第3列的值（英語成績）</li>
              <li>FALSE 表示我們要精確匹配"小華"</li>
            </ul>
          </div>
        </div>

        <div class="mb-6 bg-gray-50 p-4">
          <p class="mb-2">⚠️ <span class="font-bold">初學者注意事項：</span></p>
          <ul class="list-disc ml-6 space-y-1">
            <li>查找範圍的<span class="font-bold text-red-500">第一列</span>必須包含你要查找的值</li>
            <li>建議使用 FALSE 進行精確匹配，避免意外的錯誤</li>
            <li>如果找不到匹配的值，會返回 #N/A 錯誤</li>
            <li>VLOOKUP 只能從左到右查找，不能從右到左</li>
          </ul>
        </div>
        
        <div class="mb-4 bg-gray-50 p-4">
          <p class="mb-2">💡 <span class="font-bold">實用小提示：</span></p>
          <p>可以用 IFERROR 函數結合 VLOOKUP，當找不到匹配時顯示友好訊息：</p>
          <p class="font-mono mt-1">=IFERROR(VLOOKUP("小明", A1:C5, 2, FALSE), "未找到資料")</p>
        </div>
      </div>
    `,
  },
  {
    lesson_id: getLessonId(5),
    number: 5,
    title: "綜合測驗",
    description: "測試您對所有 Excel 函數的掌握程度",
    content: `
      <div class="p-4">
        <h2 class="text-2xl font-bold mb-4 text-blue-600 border-b pb-2">綜合測驗：Excel 技能實戰挑戰</h2>
        <p class="mb-4">恭喜你學習到最後一關！現在是時候測試你對所有 Excel 函數的掌握程度了。在這個綜合測驗中，你將面臨各種實際工作場景中的 Excel 問題。</p>
        
        <div class="mb-6">
          <h3 class="text-xl font-bold mb-2 text-blue-700">綜合測驗說明</h3>
          <p class="mb-2">在這測驗中，您需要運用前面學習的所有函數知識來解決實際問題。</p>
          
          <div class="bg-gray-50 p-3 rounded mb-3">
            <ul class="list-disc ml-4 space-y-1">
              <li>運用 SUM、AVERAGE 函數進行數據統計</li>
              <li>使用 VLOOKUP 函數查找相關數據</li>
              <li>使用 IF 函數進行條件判斷</li>
              <li>創建樞紐分析表進行數據分析</li>
            </ul>
          </div>
          
          <p class="text-blue-600 font-semibold">完成測驗後，您將獲得終極密碼！</p>
        </div>
        
        <div class="mb-6">
          <h3 class="text-xl font-bold mb-2 text-blue-700">測驗要點</h3>
          
          <div class="bg-gray-50 p-3 rounded mb-4">
            <h4 class="font-bold text-blue-700 mb-2">1. 數據彙總與統計</h4>
            <p>使用 SUM 和 AVERAGE 函數計算銷售總額、平均訂單金額等關鍵指標。</p>
          </div>
          
          <div class="bg-gray-50 p-3 rounded mb-4">
            <h4 class="font-bold text-blue-700 mb-2">2. 數據查詢與檢索</h4>
            <p>使用 VLOOKUP 函數根據客戶ID或產品編號查詢相關信息。</p>
          </div>
          
          <div class="bg-gray-50 p-3 rounded mb-4">
            <h4 class="font-bold text-blue-700 mb-2">3. 條件邏輯應用</h4>
            <p>使用 IF 函數對數據進行分類，例如識別高價值訂單或特定區域的銷售表現。</p>
          </div>
          
          <div class="bg-gray-50 p-3 rounded mb-4">
            <h4 class="font-bold text-blue-700 mb-2">4. 數據分析與視覺化</h4>
            <p>創建樞紐分析表，分析不同維度的銷售數據，找出業務趨勢和機會。</p>
          </div>
        </div>
        
        <div class="mb-4 bg-gray-50 p-4">
          <p class="mb-2">⚠️ <span class="font-bold">提示：</span></p>
          <p>在解決測驗問題時，請遵循以下步驟：</p>
          <ol class="list-decimal ml-6 space-y-1">
            <li>仔細閱讀問題要求，明確需要計算的內容</li>
            <li>識別需要使用的函數及其參數</li>
            <li>依照邏輯順序構建公式</li>
            <li>檢查結果是否合理</li>
          </ol>
        </div>
        
        <div class="mb-4 bg-gray-50 p-4">
          <p class="mb-2">💡 <span class="font-bold">實用小提示：</span></p>
          <p>在處理複雜問題時，可以將大問題拆分成小步驟，逐個解決。有時候使用多個簡單函數的組合比一個複雜的嵌套函數更容易理解和維護。</p>
        </div>
      </div>
    `,
    showGame: true,
    isFinal: true,
  }
]