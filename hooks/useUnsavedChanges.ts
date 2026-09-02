'use client';

import { useCallback, useEffect, useRef } from 'react';
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

  // Browser back/forward doesn't go through NAVIGATION_REQUEST or the link
  // click handler below - the history entry changes before any handler can
  // run. Push one throwaway entry so the first back press is absorbed as a
  // popstate on this same page instead of actually leaving; re-armed once
  // per "became dirty" stretch, not on every render, so confirming a leave
  // only costs the user one extra back press, not one per keystroke.
  const guardArmedRef = useRef(false);
  useEffect(() => {
    if (!dirty) {
      guardArmedRef.current = false;
      return;
    }
    if (!guardArmedRef.current) {
      guardArmedRef.current = true;
      window.history.pushState(null, '', window.location.href);
    }
  }, [dirty]);

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
    const popstate = () => {
      // The browser already moved back a step by the time this fires.
      // Cancelling means pushing the guard entry right back on top of it.
      if (!confirmLeave()) {
        window.history.pushState(null, '', window.location.href);
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener(NAVIGATION_REQUEST, requestNavigation);
    document.addEventListener('click', click, true);
    window.addEventListener('popstate', popstate);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener(NAVIGATION_REQUEST, requestNavigation);
      document.removeEventListener('click', click, true);
      window.removeEventListener('popstate', popstate);
    };
  }, [busy, dirty, confirmLeave]);

  return confirmLeave;
}
