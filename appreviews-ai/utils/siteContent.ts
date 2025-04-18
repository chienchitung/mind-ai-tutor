export const SITE_CONTENT = {
  features: {
    scraper: {
      title: "資料爬取功能",
      description: "支援從 Apple App Store 和 Google Play Store 爬取APP評論數據。使用者只需輸入APP的網址，系統就能自動收集評論資料。",
      usage: "在爬取頁面輸入APP網址，點擊開始爬取即可。",
      pricing: "基本版每月可爬取1000則評論，進階版無限制。"
    },
    analysis: {
      title: "數據分析功能",
      description: "運用AI技術分析評論數據，自動生成見解報告，包含情感分析、關鍵字分析、主題分類等。",
      usage: "在分析頁面上傳評論數據或選擇已爬取的數據，系統會自動進行分析並生成報告。",
      features: [
        "情感分析：分析評論正負面情緒",
        "關鍵字提取：識別高頻詞彙和重要術語",
        "主題分類：自動將評論分類到不同主題",
        "趨勢分析：追蹤評論趨勢變化"
      ]
    },
    search: {
      title: "APP搜尋功能",
      description: "提供APP搜尋功能，精準搜尋你想要尋找的應用程式。",
      usage: "在搜尋欄位輸入關鍵字，即可搜尋到相關的APP。"
    }
  },
  pricing: {
    basic: {
      name: "基本版",
      price: "免費/月",
      features: [
        "每月100則評論爬取額度",
        "基礎數據分析功能",
        "標準搜尋功能",
      ]
    },
    pro: {
      name: "專業版",
      price: "NT$499/月",
      features: [
        "每月1000則評論爬取額度",
        "進階數據分析功能",
        "AI智能分析",
        "優先技術支援",
      ]
    }
  },
  support: {
    contact: {
      email: "support@appreviewsai.com",
      phone: "(02) 1234-5678",
      hours: "週一至週五 9:00-18:00"
    },
    faq: [
      {
        question: "如何開始使用平台？",
        answer: "註冊帳號後，可以直接使用爬取功能收集評論，或上傳已有的評論數據進行分析。"
      },
      {
        question: "支援哪些格式的數據上傳？",
        answer: "支援 CSV、Excel、JSON 格式的評論數據上傳。"
      }
    ]
  }
}; 