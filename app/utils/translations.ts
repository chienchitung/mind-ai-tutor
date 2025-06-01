'use client';

import type { Language } from '@/app/contexts/LanguageContext';

// Define translation types
type TranslationKey =
  | 'all'
  | 'clear'
  | 'apply'
  | 'view_all'
  | 'view_details'
  | 'search'
  | 'filter'
  | 'sort'
  | 'newest'
  | 'oldest'
  | 'read'
  | 'unread'
  | 'progress'
  | 'update'
  | 'feedback'
  | 'reminders'
  | 'achievement'
  | 'new'
  | 'activity_feed'
  | 'search_activities'
  | 'select_date_range'
  | 'mark_all_as_read'
  | 'no_activities_found'
  | 'try_adjusting_filters'
  | 'clear_filters'
  | 'student_completed_lesson'
  | 'course_content_updated'
  | 'new_student_feedback'
  | 'upcoming_deadline'
  | 'student_earned_badge'
  | 'view_changes'
  | 'respond'
  | 'send_reminder'
  | 'congratulate'
  | 'just_now'
  | 'minute_ago'
  | 'minutes_ago'
  | 'hour_ago'
  | 'hours_ago'
  | 'day_ago'
  | 'days_ago'
  | 'previous_month'
  | 'next_month'
  | 'your_choice'
  | 'correct_and_selected';

// Define translation keys and values
const translations: Record<Language, Record<TranslationKey, string>> = {
  'en': {
    // Common
    'all': 'All',
    'clear': 'Clear',
    'apply': 'Apply',
    'view_all': 'View All',
    'view_details': 'View Details',
    'search': 'Search',
    'filter': 'Filter',
    'sort': 'Sort',
    'newest': 'Newest',
    'oldest': 'Oldest',
    'read': 'Read',
    'unread': 'Unread',
    'progress': 'Progress',
    'update': 'Update',
    'feedback': 'Feedback',
    'reminders': 'Reminders',
    'achievement': 'Achievement',
    'new': 'New',
    
    // Activities page
    'activity_feed': 'Activity Feed',
    'search_activities': 'Search activities...',
    'select_date_range': 'Select date range',
    'mark_all_as_read': 'Mark All as Read',
    'no_activities_found': 'No activities found',
    'try_adjusting_filters': 'Try adjusting your filters or search criteria',
    'clear_filters': 'Clear Filters',
    
    // Activity types
    'student_completed_lesson': 'Student Completed Lesson',
    'course_content_updated': 'Course Content Updated',
    'new_student_feedback': 'New Student Feedback',
    'upcoming_deadline': 'Upcoming Deadline',
    'student_earned_badge': 'Student Earned Badge',
    'view_changes': 'View Changes',
    'respond': 'Respond',
    'send_reminder': 'Send Reminder',
    'congratulate': 'Congratulate',
    
    // Date related
    'just_now': 'Just now',
    'minute_ago': '1 minute ago',
    'minutes_ago': '{n} minutes ago',
    'hour_ago': '1 hour ago',
    'hours_ago': '{n} hours ago',
    'day_ago': 'Yesterday',
    'days_ago': '{n} days ago',
    'previous_month': 'Previous month',
    'next_month': 'Next month',
    'your_choice': 'Your Choice',
    'correct_and_selected': 'Correct & Selected',
  },
  'zh-TW': {
    // Common
    'all': '全部',
    'clear': '清除',
    'apply': '應用',
    'view_all': '查看全部',
    'view_details': '查看詳情',
    'search': '搜索',
    'filter': '篩選',
    'sort': '排序',
    'newest': '最新',
    'oldest': '最舊',
    'read': '已讀',
    'unread': '未讀',
    'progress': '進度',
    'update': '更新',
    'feedback': '反饋',
    'reminders': '提醒事項',
    'achievement': '成就',
    'new': '新',
    
    // Activities page
    'activity_feed': '活動摘要',
    'search_activities': '搜索活動...',
    'select_date_range': '選擇日期範圍',
    'mark_all_as_read': '標記所有為已讀',
    'no_activities_found': '未找到活動',
    'try_adjusting_filters': '嘗試調整篩選條件或搜索條件',
    'clear_filters': '清除篩選',
    
    // Activity types
    'student_completed_lesson': '學生完成課程',
    'course_content_updated': '課程內容已更新',
    'new_student_feedback': '新的學生反饋',
    'upcoming_deadline': '即將到期的截止日期',
    'student_earned_badge': '學生獲得徽章',
    'view_changes': '查看變更',
    'respond': '回覆',
    'send_reminder': '發送提醒',
    'congratulate': '祝賀',
    
    // Date related
    'just_now': '剛剛',
    'minute_ago': '1分鐘前',
    'minutes_ago': '{n}分鐘前',
    'hour_ago': '1小時前',
    'hours_ago': '{n}小時前',
    'day_ago': '昨天',
    'days_ago': '{n}天前',
    'previous_month': '上個月',
    'next_month': '下個月',
    'your_choice': '你的選擇',
    'correct_and_selected': '正確且有選到',
  }
};

// Translation function
export const useTranslation = (language: Language) => {
  const t = (key: TranslationKey, params?: Record<string, string | number>) => {
    let translation = translations[language][key] || key;
    
    if (params) {
      Object.entries(params).forEach(([paramKey, paramValue]) => {
        translation = translation.replace(`{${paramKey}}`, String(paramValue));
      });
    }
    
    return translation;
  };

  return { t };
};

// Format time ago
export const formatTimeAgo = (date: Date | number | string, language: Language): string => {
  const { t } = useTranslation(language);
  const now = new Date();
  const time = typeof date === 'string' || typeof date === 'number'
    ? new Date(date)
    : date;
  
  const seconds = Math.floor((now.getTime() - time.getTime()) / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 60) return t('just_now');
  if (minutes === 1) return t('minute_ago');
  if (minutes < 60) return t('minutes_ago', { n: minutes });
  if (hours === 1) return t('hour_ago');
  if (hours < 24) return t('hours_ago', { n: hours });
  if (days === 1) return t('day_ago');
  return t('days_ago', { n: days });
};