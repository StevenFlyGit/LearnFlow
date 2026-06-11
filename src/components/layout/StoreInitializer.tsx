'use client';
import { useEffect } from 'react';
import { getDomains, getConfig, getFeeds, getReviewTemplates, getReviewSessions } from '@/lib/db';
import { useStore } from '@/lib/store';

/**
 * 应用启动时从 IndexedDB 加载所有数据到 Zustand store
 */
export function StoreInitializer() {
  const { setDomains, setConfig, setFeeds, setReviewTemplates, setReviewSessions } = useStore();

  useEffect(() => {
    getDomains().then(setDomains).catch(console.error);
    getConfig().then(c => c && setConfig(c)).catch(console.error);
    getFeeds().then(setFeeds).catch(console.error);
    getReviewTemplates().then(setReviewTemplates).catch(console.error);
    getReviewSessions().then(setReviewSessions).catch(console.error);
  }, [setDomains, setConfig, setFeeds, setReviewTemplates, setReviewSessions]);

  return null;
}

