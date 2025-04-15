type Language = 'en' | 'zh-TW';

const translations = {
  en: {
    search: "Search",
    try_typing: "Try typing",
    no_results_found: "No results found",
    navigation: "Navigation",
    excel_lessons: "Excel Lessons",
    quick_actions: "Quick Actions",
    open_genially: "Open Genially"
  },
  'zh-TW': {
    search: "搜尋",
    try_typing: "試著輸入",
    no_results_found: "找不到結果",
    navigation: "導航",
    excel_lessons: "Excel 課程",
    quick_actions: "快速操作",
    open_genially: "開啟 Genially"
  }
};

export function useTranslation(language: Language) {
  const t = (key: keyof typeof translations['en']) => {
    return translations[language]?.[key] || translations['en'][key];
  };

  return { t };
} 