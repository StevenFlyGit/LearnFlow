/**
 * 全局 Zustand store — 在内存中缓存 IndexedDB 数据，驱动 UI 更新
 */
'use client';
import { create } from 'zustand';
import type { Domain, KnowledgeNode, Note, RssFeed, TokenConfig, ReviewTemplate, ReviewSession, DailyPlan } from './db';

type Store = {
  // Domains
  domains: Domain[];
  setDomains: (d: Domain[]) => void;
  upsertDomain: (d: Domain) => void;
  removeDomain: (id: string) => void;

  // Active domain & tree
  activeDomainId: string | null;
  setActiveDomainId: (id: string | null) => void;
  nodes: KnowledgeNode[];
  setNodes: (n: KnowledgeNode[]) => void;
  upsertNode: (n: KnowledgeNode) => void;
  removeNode: (id: string) => void;

  // Active note
  activeNodeId: string | null;
  setActiveNodeId: (id: string | null) => void;
  activeNote: Note | null;
  setActiveNote: (n: Note | null) => void;

  // Feeds
  feeds: RssFeed[];
  setFeeds: (f: RssFeed[]) => void;
  upsertFeed: (f: RssFeed) => void;
  removeFeed: (id: string) => void;

  // Config
  config: TokenConfig | null;
  setConfig: (c: TokenConfig | null) => void;

  // Review Templates
  reviewTemplates: ReviewTemplate[];
  setReviewTemplates: (t: ReviewTemplate[]) => void;
  upsertReviewTemplate: (t: ReviewTemplate) => void;
  removeReviewTemplate: (id: string) => void;

  // Review Sessions
  reviewSessions: ReviewSession[];
  setReviewSessions: (rs: ReviewSession[]) => void;
  upsertReviewSession: (rs: ReviewSession) => void;
  removeReviewSession: (id: string) => void;

  // Daily Plans
  dailyPlans: DailyPlan[];
  setDailyPlans: (p: DailyPlan[]) => void;
  upsertDailyPlan: (p: DailyPlan) => void;

  // UI state
  navCollapsed: boolean;
  setNavCollapsed: (v: boolean) => void;
  editorOpen: boolean;
  setEditorOpen: (v: boolean) => void;
  planningView: 'tree' | 'calendar';
  setPlanningView: (v: 'tree' | 'calendar') => void;
  treeView: 'detailed' | 'compact';
  setTreeView: (v: 'detailed' | 'compact') => void;
};

export const useStore = create<Store>((set) => ({
  domains: [],
  setDomains: (domains) => set({ domains }),
  upsertDomain: (d) => set((s) => ({
    domains: s.domains.some(x => x.id === d.id)
      ? s.domains.map(x => x.id === d.id ? d : x)
      : [...s.domains, d],
  })),
  removeDomain: (id) => set((s) => ({ domains: s.domains.filter(x => x.id !== id) })),

  activeDomainId: null,
  setActiveDomainId: (id) => set({ activeDomainId: id, activeNodeId: null, editorOpen: false }),
  nodes: [],
  setNodes: (nodes) => set({ nodes }),
  upsertNode: (n) => set((s) => {
    // Only upsert the node into the active domain's nodes list if the domainId matches.
    const isSameDomain = n.domainId === s.activeDomainId;
    if (!isSameDomain) {
      return {
        nodes: s.nodes.filter(x => x.id !== n.id)
      };
    }
    return {
      nodes: s.nodes.some(x => x.id === n.id)
        ? s.nodes.map(x => x.id === n.id ? n : x)
        : [...s.nodes, n],
    };
  }),
  removeNode: (id) => set((s) => ({ nodes: s.nodes.filter(x => x.id !== id) })),

  activeNodeId: null,
  setActiveNodeId: (id) => set({ activeNodeId: id }),
  activeNote: null,
  setActiveNote: (n) => set({ activeNote: n }),

  feeds: [],
  setFeeds: (feeds) => set({ feeds }),
  upsertFeed: (f) => set((s) => ({
    feeds: s.feeds.some(x => x.id === f.id)
      ? s.feeds.map(x => x.id === f.id ? f : x)
      : [...s.feeds, f],
  })),
  removeFeed: (id) => set((s) => ({ feeds: s.feeds.filter(x => x.id !== id) })),

  config: null,
  setConfig: (config) => set({ config }),

  reviewTemplates: [],
  setReviewTemplates: (reviewTemplates) => set({ reviewTemplates }),
  upsertReviewTemplate: (t) => set((s) => ({
    reviewTemplates: s.reviewTemplates.some(x => x.id === t.id)
      ? s.reviewTemplates.map(x => x.id === t.id ? t : x)
      : [...s.reviewTemplates, t],
  })),
  removeReviewTemplate: (id) => set((s) => ({
    reviewTemplates: s.reviewTemplates.filter(x => x.id !== id),
  })),

  reviewSessions: [],
  setReviewSessions: (reviewSessions) => set({ reviewSessions }),
  upsertReviewSession: (rs) => set((s) => ({
    reviewSessions: s.reviewSessions.some(x => x.id === rs.id)
      ? s.reviewSessions.map(x => x.id === rs.id ? rs : x)
      : [...s.reviewSessions, rs],
  })),
  removeReviewSession: (id) => set((s) => ({
    reviewSessions: s.reviewSessions.filter(x => x.id !== id),
  })),

  dailyPlans: [],
  setDailyPlans: (dailyPlans) => set({ dailyPlans }),
  upsertDailyPlan: (p) => set((s) => ({
    dailyPlans: s.dailyPlans.some(x => x.id === p.id)
      ? s.dailyPlans.map(x => x.id === p.id ? p : x)
      : [...s.dailyPlans, p],
  })),

  navCollapsed: false,
  setNavCollapsed: (navCollapsed) => set({ navCollapsed }),
  editorOpen: false,
  setEditorOpen: (editorOpen) => set({ editorOpen }),
  planningView: 'tree',
  setPlanningView: (planningView) => set({ planningView }),
  treeView: 'detailed',
  setTreeView: (treeView) => set({ treeView }),
}));

