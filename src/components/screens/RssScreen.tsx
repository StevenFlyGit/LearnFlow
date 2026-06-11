'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Rss, ExternalLink, Search, Trash2, Loader2, RefreshCw, Globe } from 'lucide-react';
import { useStore } from '@/lib/store';
import { putFeed, deleteFeed, type RssFeed } from '@/lib/db';
import { cn } from '@/utils/utils';
import { toast } from 'sonner';

type Article = { title: string; link: string; pubDate?: string; description?: string };
type FeedData = { feed: RssFeed; articles: Article[]; loading: boolean; error?: string };

export function RssScreen() {
  const { feeds, upsertFeed, removeFeed } = useStore();
  const [feedData, setFeedData] = useState<Record<string, FeedData>>({});
  const [selectedFeedId, setSelectedFeedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [addUrl, setAddUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Fetch a single feed
  const fetchFeed = async (feed: RssFeed) => {
    setFeedData(prev => ({ ...prev, [feed.id]: { feed, articles: prev[feed.id]?.articles || [], loading: true } }));
    try {
      const res = await fetch('/api/rss/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: feed.url }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setFeedData(prev => ({ ...prev, [feed.id]: { feed, articles: data.items || [], loading: false } }));
      await putFeed({ ...feed, lastSyncAt: Date.now() });
    } catch (e) {
      setFeedData(prev => ({ ...prev, [feed.id]: { feed, articles: [], loading: false, error: String(e) } }));
    }
  };

  useEffect(() => {
    feeds.forEach(f => { if (!feedData[f.id]) fetchFeed(f); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feeds]);

  const handleAdd = async () => {
    if (!addUrl.trim()) return;
    setAdding(true);
    try {
      const res = await fetch('/api/rss/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: addUrl.trim() }),
      });
      const data = await res.json();
      if (data.error) { toast.error(data.error); return; }
      const feed: RssFeed = {
        id: `feed_${Date.now()}`, name: data.title || addUrl.trim(),
        url: addUrl.trim(), addedAt: Date.now(), lastSyncAt: Date.now(),
      };
      await putFeed(feed);
      upsertFeed(feed);
      setFeedData(prev => ({ ...prev, [feed.id]: { feed, articles: data.items || [], loading: false } }));
      setAddUrl('');
      setShowAddForm(false);
      setSelectedFeedId(feed.id);
      toast.success(`已添加订阅：${feed.name}`);
    } catch { toast.error('添加失败，请检查 URL'); }
    finally { setAdding(false); }
  };

  const handleDelete = async (feed: RssFeed) => {
    await deleteFeed(feed.id);
    removeFeed(feed.id);
    if (selectedFeedId === feed.id) setSelectedFeedId(null);
    setFeedData(prev => { const n = { ...prev }; delete n[feed.id]; return n; });
    toast.success('已删除订阅');
  };

  const selectedFeedData = selectedFeedId ? feedData[selectedFeedId] : null;
  const articles = selectedFeedData?.articles || [];
  const filtered = searchQuery
    ? articles.filter(a => a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.description?.toLowerCase().includes(searchQuery.toLowerCase()))
    : articles;

  return (
    <div className="flex h-svh overflow-hidden bg-[#FAF7F2]">
      {/* Left panel — feed list */}
      <div className="w-72 flex-shrink-0 border-r border-[#EFEAE0] flex flex-col bg-[#F3EEE6]">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#EFEAE0]">
          <div className="flex items-center gap-2">
            <Rss size={15} className="text-[#C8834A]" />
            <span className="text-sm font-semibold text-[#2C2A29]" style={{ fontFamily: 'Cinzel, Georgia, serif' }}>RSS 订阅</span>
          </div>
          <button onClick={() => setShowAddForm(!showAddForm)}
            className="p-1.5 rounded-lg hover:bg-[#EFEAE0] text-[#9E988F] hover:text-[#6E6A64]">
            <Plus size={14} />
          </button>
        </div>

        {/* Add form */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="p-3 border-b border-[#EFEAE0] bg-[#FDFBF7] space-y-2">
                <input value={addUrl} onChange={e => setAddUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                  placeholder="输入 RSS 源 URL"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#EFEAE0] bg-[#F3EEE6] focus:outline-none focus:ring-2 focus:ring-[#8FA67F]/30 text-[#2C2A29] placeholder:text-[#9E988F]" />
                <div className="flex gap-2">
                  <button onClick={handleAdd} disabled={adding || !addUrl.trim()}
                    className="flex-1 py-1.5 rounded-lg bg-[#8FA67F] text-white text-xs disabled:opacity-60 flex items-center justify-center gap-1.5">
                    {adding ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                    {adding ? '添加中...' : '添加'}
                  </button>
                  <button onClick={() => setShowAddForm(false)}
                    className="px-3 py-1.5 rounded-lg border border-[#EFEAE0] text-xs text-[#9E988F] hover:bg-[#F3EEE6]">取消</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Feed list */}
        <div className="flex-1 overflow-y-auto py-2">
          {feeds.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Globe size={24} className="text-[#9E988F] mx-auto mb-2" />
              <p className="text-xs text-[#9E988F]">还没有订阅源，点击 + 添加</p>
            </div>
          ) : (
            feeds.map(feed => {
              const fd = feedData[feed.id];
              return (
                <div key={feed.id}
                  className={cn('group flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors',
                    selectedFeedId === feed.id ? 'bg-[#8FA67F]/15' : 'hover:bg-[#EFEAE0]')}
                  onClick={() => setSelectedFeedId(feed.id)}>
                  <div className="w-6 h-6 rounded-lg bg-[#C8834A]/20 flex items-center justify-center flex-shrink-0">
                    <Rss size={11} className="text-[#C8834A]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[#2C2A29] truncate">{feed.name}</p>
                    <p className="text-[10px] text-[#9E988F] truncate">{fd?.articles.length || 0} 篇</p>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                    <button onClick={e => { e.stopPropagation(); fetchFeed(feed); }}
                      className="p-1 rounded hover:bg-[#EFEAE0] text-[#9E988F]">
                      <RefreshCw size={11} className={fd?.loading ? 'animate-spin' : ''} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); handleDelete(feed); }}
                      className="p-1 rounded hover:bg-[#B36B5C]/10 text-[#9E988F] hover:text-[#B36B5C]">
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right panel — articles */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedFeedId ? (
          <>
            {/* Search bar */}
            <div className="px-5 py-3 border-b border-[#EFEAE0] bg-[#FDFBF7]">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9E988F]" />
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder="在当前订阅中搜索..."
                  className="w-full pl-8 pr-4 py-2 text-sm rounded-lg border border-[#EFEAE0] bg-[#F3EEE6] focus:outline-none focus:ring-2 focus:ring-[#8FA67F]/30 text-[#2C2A29] placeholder:text-[#9E988F]" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {selectedFeedData?.loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map(i => <div key={i} className="h-16 rounded-xl skeleton-shimmer" />)}
                </div>
              ) : selectedFeedData?.error ? (
                <div className="text-center py-16">
                  <p className="text-sm text-[#B36B5C]">加载失败：{selectedFeedData.error}</p>
                  <button onClick={() => fetchFeed(selectedFeedData.feed)}
                    className="mt-3 text-xs text-[#8FA67F] hover:text-[#5D7052]">重试</button>
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-sm text-[#9E988F]">{searchQuery ? '没有匹配的文章' : '暂无文章'}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.map((article, i) => (
                    <motion.a key={i} href={article.link} target="_blank" rel="noopener noreferrer"
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      whileHover={{ x: 2 }}
                      className="flex items-start gap-3 p-3.5 rounded-xl border border-[#EFEAE0] bg-[#F3EEE6] hover:border-[#D8D0C4] transition-all group block">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#2C2A29] group-hover:text-[#8FA67F] transition-colors line-clamp-2">
                          {article.title}
                        </p>
                        {article.description && (
                          <p className="text-xs text-[#9E988F] mt-1 line-clamp-2">{article.description}</p>
                        )}
                        {article.pubDate && (
                          <p className="text-[10px] text-[#9E988F] mt-1.5">
                            {new Date(article.pubDate).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </p>
                        )}
                      </div>
                      <ExternalLink size={13} className="text-[#9E988F] group-hover:text-[#8FA67F] flex-shrink-0 mt-0.5 transition-colors" />
                    </motion.a>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-[#ECE6DA] flex items-center justify-center mb-4">
              <Rss size={28} className="text-[#C8834A]" />
            </div>
            <h3 className="text-[#6E6A64] font-medium mb-2">选择一个订阅源</h3>
            <p className="text-sm text-[#9E988F] max-w-[240px]">从左侧选择订阅源查看文章，或点击 + 添加新的 RSS 链接</p>
          </div>
        )}
      </div>
    </div>
  );
}
