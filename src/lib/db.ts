/**
 * LearnFlow IndexedDB — 所有本地数据通过这里持久化
 */
import { openDB, type IDBPDatabase } from 'idb';

export type Domain = {
  id: string;
  name: string;
  description?: string;
  tags: string[];
  dailyHours: number;
  totalHours?: number;
  completedHours?: number;
  createdAt: number;
  color?: string;
  weekendPolicy?: 'none' | 'reduced' | 'full'; // none = 不安排, reduced = 减少安排, full = 正常安排
  goal?: string;      // 学习目的
  scope?: string;     // 范围/方向约束
  industry?: string;  // 行业/应用场景
};

export type NodeStatus = 'pending' | 'in_progress' | 'done';

export type KnowledgeNode = {
  id: string;
  domainId: string;
  parentId: string | null;
  title: string;
  description?: string;
  level: number;
  estimatedHours: number;
  startDate?: string;   // ISO date string (YYYY-MM-DD)
  status: NodeStatus;
  order: number;
};

export type Note = {
  id: string;          // same as nodeId
  nodeId: string;
  content: string;
  updatedAt: number;
};

export type RssFeed = {
  id: string;
  name: string;
  url: string;
  addedAt: number;
  lastSyncAt?: number;
};

export type TokenConfig = {
  id: 'config';
  aiProvider: 'openai' | 'deepseek' | 'anthropic';
  apiKey: string;
  modelName: string;
  baseUrl?: string;
  
  openaiApiKey?: string;
  openaiModelName?: string;
  openaiBaseUrl?: string;
  
  anthropicApiKey?: string;
  anthropicModelName?: string;
  anthropicBaseUrl?: string;

  notionToken: string;
  notionDatabaseId?: string;
  userName?: string;
  userAvatar?: string;
  
  // System and Learning Preferences
  globalDailyHours?: number;
  learningPreferences?: string;
};

export type ReviewTemplate = {
  id: string;
  name: string;
  intervals: number[]; // e.g. [1, 2, 4, 7, 15, 30]
  isDefault: boolean;
  createdAt: number;
};

export type ReviewSessionItem = {
  date: string; // YYYY-MM-DD
  status: 'pending' | 'done';
  completedAt?: number;
};

export type ReviewSession = {
  id: string;
  nodeId: string;
  templateId: string;
  learnedAt: number; // learned/start date timestamp
  sessions: ReviewSessionItem[];
  createdAt: number;
  updatedAt: number;
};

export type DailyPlanItem = {
  nodeId: string;
  title: string;
  type: 'study' | 'review';
  duration: number;
  status: 'pending' | 'done';
};

export type DailyPlan = {
  id: string; // YYYY-MM-DD
  date: string; // YYYY-MM-DD
  totalAvailableHours: number;
  items: DailyPlanItem[];
  aiSummary?: string;
  createdAt: number;
  updatedAt: number;
};

const DB_NAME = 'learnflow';
const DB_VERSION = 2;

let _db: IDBPDatabase | null = null;

export async function getDB() {
  if (_db) return _db;
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      if (!db.objectStoreNames.contains('domains')) {
        db.createObjectStore('domains', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('nodes')) {
        const nodeStore = db.createObjectStore('nodes', { keyPath: 'id' });
        nodeStore.createIndex('by-domain', 'domainId');
        nodeStore.createIndex('by-parent', 'parentId');
      }
      if (!db.objectStoreNames.contains('notes')) {
        db.createObjectStore('notes', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('feeds')) {
        db.createObjectStore('feeds', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('config')) {
        db.createObjectStore('config', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('reviewTemplates')) {
        db.createObjectStore('reviewTemplates', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('reviewSessions')) {
        const reviewStore = db.createObjectStore('reviewSessions', { keyPath: 'id' });
        reviewStore.createIndex('by-node', 'nodeId');
      }
      if (!db.objectStoreNames.contains('dailyPlans')) {
        db.createObjectStore('dailyPlans', { keyPath: 'id' });
      }

      // Add default templates if upgrading/creating
      const defaultTemplate: ReviewTemplate = {
        id: 'ebbinghaus_default',
        name: '艾宾浩斯记忆法',
        intervals: [1, 2, 4, 7, 15, 30],
        isDefault: true,
        createdAt: Date.now()
      };
      
      // We perform the transaction put in a microtask/callback block
      transaction.objectStore('reviewTemplates').put(defaultTemplate);
    },
  });
  return _db;
}

/* ── Domains ── */
export async function getDomains(): Promise<Domain[]> {
  const db = await getDB();
  return db.getAll('domains');
}
export async function putDomain(d: Domain) {
  const db = await getDB();
  return db.put('domains', d);
}
export async function deleteDomain(id: string) {
  const db = await getDB();
  await db.delete('domains', id);
  // also delete all nodes, notes & reviewSessions for this domain
  const nodes = await db.getAllFromIndex('nodes', 'by-domain', id);
  for (const n of nodes) {
    await db.delete('nodes', n.id);
    await db.delete('notes', n.id);
    const rs = await db.getAllFromIndex('reviewSessions', 'by-node', n.id);
    for (const r of rs) {
      await db.delete('reviewSessions', r.id);
    }
  }
}

/* ── Nodes ── */
export async function getNodesByDomain(domainId: string): Promise<KnowledgeNode[]> {
  const db = await getDB();
  return db.getAllFromIndex('nodes', 'by-domain', domainId);
}
export async function getNode(id: string): Promise<KnowledgeNode | undefined> {
  const db = await getDB();
  return db.get('nodes', id);
}
export async function putNode(n: KnowledgeNode) {
  const db = await getDB();
  return db.put('nodes', n);
}
export async function deleteNode(id: string) {
  const db = await getDB();
  await db.delete('nodes', id);
  await db.delete('notes', id);
  const rs = await db.getAllFromIndex('reviewSessions', 'by-node', id);
  for (const r of rs) {
    await db.delete('reviewSessions', r.id);
  }
}

/* ── Notes ── */
export async function getNote(nodeId: string): Promise<Note | undefined> {
  const db = await getDB();
  return db.get('notes', nodeId);
}
export async function putNote(n: Note) {
  const db = await getDB();
  return db.put('notes', n);
}

/* ── Feeds ── */
export async function getFeeds(): Promise<RssFeed[]> {
  const db = await getDB();
  return db.getAll('feeds');
}
export async function putFeed(f: RssFeed) {
  const db = await getDB();
  return db.put('feeds', f);
}
export async function deleteFeed(id: string) {
  const db = await getDB();
  return db.delete('feeds', id);
}

/* ── Config ── */
export async function getConfig(): Promise<TokenConfig | undefined> {
  const db = await getDB();
  return db.get('config', 'config');
}
export async function putConfig(c: TokenConfig) {
  const db = await getDB();
  return db.put('config', { ...c, id: 'config' });
}

/* ── Review Templates ── */
export async function getReviewTemplates(): Promise<ReviewTemplate[]> {
  const db = await getDB();
  return db.getAll('reviewTemplates');
}
export async function putReviewTemplate(t: ReviewTemplate) {
  const db = await getDB();
  return db.put('reviewTemplates', t);
}
export async function deleteReviewTemplate(id: string) {
  const db = await getDB();
  return db.delete('reviewTemplates', id);
}

/* ── Review Sessions ── */
export async function getReviewSessions(): Promise<ReviewSession[]> {
  const db = await getDB();
  return db.getAll('reviewSessions');
}
export async function getReviewSessionByNode(nodeId: string): Promise<ReviewSession | undefined> {
  const db = await getDB();
  const list = await db.getAllFromIndex('reviewSessions', 'by-node', nodeId);
  return list[0];
}
export async function putReviewSession(rs: ReviewSession) {
  const db = await getDB();
  return db.put('reviewSessions', rs);
}
export async function deleteReviewSession(id: string) {
  const db = await getDB();
  return db.delete('reviewSessions', id);
}

/* ── Daily Plans ── */
export async function getDailyPlans(): Promise<DailyPlan[]> {
  const db = await getDB();
  return db.getAll('dailyPlans');
}
export async function getDailyPlan(id: string): Promise<DailyPlan | undefined> {
  const db = await getDB();
  return db.get('dailyPlans', id);
}
export async function putDailyPlan(p: DailyPlan) {
  const db = await getDB();
  return db.put('dailyPlans', p);
}

