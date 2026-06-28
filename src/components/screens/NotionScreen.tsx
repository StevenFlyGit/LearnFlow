'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, CheckCircle2, Circle, ChevronRight, ChevronDown, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import { useStore } from '@/lib/store';
import { getNodesByDomain, getNote, putConfig, type KnowledgeNode } from '@/lib/db';
import { cn } from '@/utils/utils';
import { toast } from 'sonner';

type SyncItem = { node: KnowledgeNode; domainName: string; selected: boolean };

function NodeSyncRow({
  item, onToggle, depth,
  expanded, onToggleExpand, hasChildren, onSelectChildren, childrenAllSelected,
}: {
  item: SyncItem; onToggle: () => void; depth: number;
  expanded?: boolean; onToggleExpand?: () => void; hasChildren?: boolean; onSelectChildren?: () => void; childrenAllSelected?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
      className={cn(
        'flex items-center gap-2.5 py-2 px-3 rounded-lg cursor-pointer transition-colors hover:bg-[#EFEAE0] group',
      )}
      style={{ paddingLeft: `${12 + depth * 18}px` }}
      onClick={onToggle}
    >
      {/* Expand/collapse arrow for non-leaf nodes */}
      {hasChildren ? (
        <div
          className="w-4 h-4 flex items-center justify-center flex-shrink-0 text-[#9E988F] hover:text-[#2C2A29] transition-colors"
          onClick={e => { e.stopPropagation(); onToggleExpand?.(); }}
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </div>
      ) : (
        <div className="w-4 flex-shrink-0" />
      )}
      <div className={cn(
        'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all',
        item.selected ? 'bg-[#8FA67F] border-[#8FA67F]' : 'border-[#D8D0C4] group-hover:border-[#8FA67F]'
      )}>
        {item.selected && <CheckCircle2 size={10} className="text-white" />}
      </div>
      <span className={cn('text-xs flex-1 truncate', item.selected ? 'text-[#2C2A29]' : 'text-[#6E6A64]')}>
        {item.node.title}
      </span>
      {/* Select all children checkbox-style button */}
      {hasChildren && onSelectChildren && (
        <div
          className="flex items-center gap-1 flex-shrink-0"
          onClick={e => { e.stopPropagation(); onSelectChildren(); }}
        >
          <div className={cn(
            'w-4 h-4 rounded border flex items-center justify-center transition-all cursor-pointer',
            childrenAllSelected ? 'bg-[#8FA67F] border-[#8FA67F]' : 'border-[#D8D0C4] hover:border-[#8FA67F]'
          )}>
            {childrenAllSelected && <CheckCircle2 size={10} className="text-white" />}
          </div>
          <span className={cn(
            'text-[10px] cursor-pointer transition-colors',
            childrenAllSelected ? 'text-[#8FA67F]' : 'text-[#9E988F] hover:text-[#8FA67F]'
          )}>全选</span>
        </div>
      )}
      <span className="text-[10px] text-[#9E988F]">{item.node.estimatedHours}h</span>
    </motion.div>
  );
}

export function NotionScreen() {
  const { domains, config, setConfig } = useStore();
  const [items, setItems] = useState<SyncItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ ok: number; fail: number } | null>(null);
  const [expandedDomains, setExpandedDomains] = useState<Record<string, boolean>>({});
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function load() {
      setLoading(true);
      const all: SyncItem[] = [];
      for (const domain of domains) {
        const nodes = await getNodesByDomain(domain.id);
        nodes.sort((a, b) => a.level - b.level || a.order - b.order);
        nodes.forEach(n => all.push({ node: n, domainName: domain.name, selected: false }));
      }
      setItems(all);
      const expanded: Record<string, boolean> = {};
      domains.forEach(d => { expanded[d.id] = true; });
      setExpandedDomains(expanded);
      setLoading(false);
    }
    load();
  }, [domains]);

  const toggleItem = (nodeId: string) => {
    setItems(prev => prev.map(i => i.node.id === nodeId ? { ...i, selected: !i.selected } : i));
  };

  const toggleAll = () => {
    const allSelected = items.every(i => i.selected);
    setItems(prev => prev.map(i => ({ ...i, selected: !allSelected })));
  };

  const toggleDomain = (domainId: string) => {
    const domainItems = items.filter(i => i.node.domainId === domainId);
    const allSel = domainItems.every(i => i.selected);
    setItems(prev => prev.map(i => i.node.domainId === domainId ? { ...i, selected: !allSel } : i));
  };

  const handleSync = async () => {
    if (!config?.notionToken) { toast.error('请先在 Token 配置页填写 Notion Token'); return; }
    const selected = items.filter(i => i.selected);
    if (selected.length === 0) { toast.error('请至少选择一个知识点'); return; }

    setSyncing(true);
    setSyncResult(null);
    try {
      const syncNodes = await Promise.all(selected.map(async item => {
        const note = await getNote(item.node.id);
        return {
          id: item.node.id, title: item.node.title,
          domainName: item.domainName, level: item.node.level,
          estimatedHours: item.node.estimatedHours, status: item.node.status,
          startDate: item.node.startDate, content: note?.content,
        };
      }));

      const res = await fetch('/api/notion/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notionToken: config.notionToken,
          databaseId: config.notionDatabaseId || undefined,
          nodes: syncNodes,
        }),
      });
      const data = await res.json();
      if (data.error) { toast.error(data.error); return; }

      // Save databaseId for future syncs
      if (data.databaseId && !config.notionDatabaseId) {
        const updated = { ...config, notionDatabaseId: data.databaseId };
        await putConfig(updated);
        setConfig(updated);
      }

      const ok = data.results.filter((r: { ok: boolean }) => r.ok).length;
      const fail = data.results.length - ok;
      setSyncResult({ ok, fail });
      toast.success(`成功同步 ${ok} 个知识点到 Notion`);
    } catch { toast.error('同步失败，请检查 Notion Token 和权限'); }
    finally { setSyncing(false); }
  };

  const collectDescendants = (nodeId: string, domainId: string): string[] => {
    const children = items.filter(i => i.node.parentId === nodeId && i.node.domainId === domainId);
    return children.flatMap(c => [c.node.id, ...collectDescendants(c.node.id, domainId)]);
  };

  const selectChildren = (nodeId: string, domainId: string) => {
    const descendantIds = collectDescendants(nodeId, domainId);
    const allSelected = descendantIds.every(id => items.find(i => i.node.id === id)?.selected);
    const idsToToggle = new Set([nodeId, ...descendantIds]);
    setItems(prev => prev.map(i => idsToToggle.has(i.node.id) ? { ...i, selected: !allSelected } : i));
  };

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const selectedCount = items.filter(i => i.selected).length;
  const byDomain: Record<string, SyncItem[]> = {};
  items.forEach(i => {
    byDomain[i.node.domainId] = byDomain[i.node.domainId] || [];
    byDomain[i.node.domainId].push(i);
  });

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[#FAF7F2]">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#2C2A29]/10 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-[#2C2A29]">
                <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z"/>
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-[#2C2A29]" style={{ fontFamily: 'Cinzel, Georgia, serif' }}>Notion 同步</h1>
              <p className="text-xs text-[#9E988F] mt-0.5">勾选要同步的知识点，一键推送到 Notion Database</p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={handleSync} disabled={syncing || selectedCount === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2C2A29] text-white text-sm font-medium hover:bg-[#3E4D3E] disabled:opacity-50 transition-colors"
          >
            {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {syncing ? '同步中...' : `同步 ${selectedCount > 0 ? selectedCount + ' 项' : ''}`}
          </motion.button>
        </div>

        {/* Config status */}
        {!config?.notionToken && (
          <div className="flex items-center gap-2.5 p-3.5 rounded-xl border border-[#C29F68]/40 bg-[#C29F68]/08 mb-4">
            <AlertCircle size={14} className="text-[#C29F68] flex-shrink-0" />
            <p className="text-xs text-[#6E6A64]">
              需要先在 <a href="/token" className="text-[#8FA67F] hover:underline font-medium">Token 配置</a> 页填写 Notion Integration Token
            </p>
          </div>
        )}

        {config?.notionDatabaseId && (
          <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-[#EFEAE0] bg-[#F3EEE6] mb-4 text-xs text-[#6E6A64]">
            <CheckCircle2 size={13} className="text-[#5D7052]" />
            已关联 Database
            <a href={`https://www.notion.so/${config.notionDatabaseId.replace(/-/g, '')}`}
              target="_blank" rel="noopener noreferrer"
              className="ml-auto flex items-center gap-1 text-[#8FA67F] hover:text-[#5D7052]">
              在 Notion 中查看 <ExternalLink size={11} />
            </a>
          </div>
        )}

        {/* Sync result */}
        <AnimatePresence>
          {syncResult && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-center gap-3 p-3.5 rounded-xl border border-[#5D7052]/30 bg-[#5D7052]/08 mb-4">
              <CheckCircle2 size={14} className="text-[#5D7052]" />
              <p className="text-xs text-[#3E4D3E]">
                成功 {syncResult.ok} 项
                {syncResult.fail > 0 && <span className="text-[#B36B5C] ml-1">，失败 {syncResult.fail} 项</span>}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Select all + count */}
        {items.length > 0 && (
          <div className="flex items-center justify-between mb-3 px-1">
            <button onClick={toggleAll} className="flex items-center gap-2 text-xs text-[#6E6A64] hover:text-[#2C2A29]">
              <div className={cn('w-4 h-4 rounded border flex items-center justify-center',
                items.every(i => i.selected) ? 'bg-[#8FA67F] border-[#8FA67F]' : 'border-[#D8D0C4]')}>
                {items.every(i => i.selected) && <CheckCircle2 size={10} className="text-white" />}
              </div>
              全选 / 全不选
            </button>
            <span className="text-xs text-[#9E988F]">{selectedCount} / {items.length} 已选</span>
          </div>
        )}

        {/* Tree list */}
        {loading ? (
          <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-10 rounded-lg skeleton-shimmer" />)}</div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-[#9E988F]">暂无知识点，先去学习规划页创建领域和知识树</p>
          </div>
        ) : (
          <div className="bg-[#F3EEE6] border border-[#EFEAE0] rounded-xl overflow-hidden">
            {Object.entries(byDomain).map(([domainId, domainItems]) => {
              const domain = domains.find(d => d.id === domainId);
              if (!domain) return null;
              const domainSelected = domainItems.every(i => i.selected);
              const expanded = expandedDomains[domainId] !== false;
              const rootItems = domainItems.filter(i => i.node.parentId === null);

              const renderTree = (items: SyncItem[], parentId: string | null, depth: number): React.ReactNode => {
                return items
                  .filter(i => i.node.parentId === parentId)
                  .sort((a, b) => a.node.order - b.node.order)
                  .map(item => {
                    const children = domainItems.filter(i => i.node.parentId === item.node.id);
                    const hasChildren = children.length > 0;
                    const isExpanded = expandedNodes[item.node.id] !== false;
                    const descendantIds = hasChildren ? collectDescendants(item.node.id, domainId) : [];
                    const childrenAllSelected = hasChildren && descendantIds.length > 0 && descendantIds.every(id => items.find(i => i.node.id === id)?.selected);

                    return (
                      <div key={item.node.id}>
                        <NodeSyncRow
                          item={item}
                          onToggle={() => toggleItem(item.node.id)}
                          depth={depth}
                          hasChildren={hasChildren}
                          expanded={isExpanded}
                          onToggleExpand={() => toggleNode(item.node.id)}
                          onSelectChildren={hasChildren ? () => selectChildren(item.node.id, domainId) : undefined}
                          childrenAllSelected={childrenAllSelected}
                        />
                        {hasChildren && isExpanded && renderTree(domainItems, item.node.id, depth + 1)}
                      </div>
                    );
                  });
              };

              return (
                <div key={domainId} className="border-b border-[#EFEAE0] last:border-b-0">
                  <button
                    onClick={() => setExpandedDomains(prev => ({ ...prev, [domainId]: !prev[domainId] }))}
                    className="w-full flex items-center gap-2 px-4 py-3 hover:bg-[#EFEAE0] transition-colors text-left"
                  >
                    <div className={cn('w-4 h-4 rounded border flex items-center justify-center flex-shrink-0',
                      domainSelected ? 'bg-[#8FA67F] border-[#8FA67F]' : 'border-[#D8D0C4]')}
                      onClick={e => { e.stopPropagation(); toggleDomain(domainId); }}>
                      {domainSelected && <CheckCircle2 size={10} className="text-white" />}
                    </div>
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: domain.color }} />
                    <span className="text-sm font-semibold text-[#2C2A29] flex-1"
                      style={{ fontFamily: 'Cinzel, Georgia, serif' }}>{domain.name}</span>
                    <span className="text-xs text-[#9E988F] mr-2">
                      {domainItems.filter(i => i.selected).length}/{domainItems.length}
                    </span>
                    {expanded ? <ChevronDown size={14} className="text-[#9E988F]" /> : <ChevronRight size={14} className="text-[#9E988F]" />}
                  </button>
                  <AnimatePresence>
                    {expanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} className="overflow-hidden pb-2">
                        {renderTree(domainItems, null, 0)}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
