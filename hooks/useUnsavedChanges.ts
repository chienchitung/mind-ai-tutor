'use client';

import { useCallback, useEffect } from 'react';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { isLeavingDocument, NAVIGATION_REQUEST } from '@/lib/navigation-guard';

export function useUnsavedChanges(dirty: boolean, busy = false) {
  const { language } = useLanguage();
  const confirmLeave = useCallback(() => {
    if (busy) {
      window.alert(language === 'zh-TW' ? '正在處理，請稍候再離開。' : 'Processing is in progress. Please wait before leaving.');
      return false;
    }
    return !dirty || window.confirm(language === 'zh-TW'
      ? '有尚未儲存的變更。確定要放棄變更並離開嗎？'
      : 'You have unsaved changes. Discard them and leave?');
  }, [busy, dirty, language]);

  useEffect(() => {
    if (!dirty && !busy) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const requestNavigation = (event: Event) => {
      if (!confirmLeave()) event.preventDefault();
    };
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return;
      const target = new URL(anchor.href, window.location.href);
      if (!['https:', 'http:'].includes(target.protocol) || !isLeavingDocument(new URL(window.location.href), target)) return;
      if (!confirmLeave()) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener(NAVIGATION_REQUEST, requestNavigation);
    document.addEventListener('click', click, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener(NAVIGATION_REQUEST, requestNavigation);
      document.removeEventListener('click', click, true);
    };
  }, [busy, dirty, confirmLeave]);

  return confirmLeave;
}
