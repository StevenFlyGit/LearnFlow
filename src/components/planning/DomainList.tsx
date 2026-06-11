/**
 * 学习领域卡片列表（手感学术风格）
 */
'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Sparkles, Tag, Clock, ChevronRight, Trash2, Loader2, BookOpen } from 'lucide-react';
import { useStore } from '@/lib/store';
import { putDomain, deleteDomain, putNode, getNodesByDomain, type Domain, type KnowledgeNode } from '@/lib/db';
import { cn } from '@/utils/utils';
import { toast } from 'sonner';

const DOMAIN_COLORS = [
  '#8FA67F', '#C8834A', '#C29F68', '#7A8FA6', '#A67F8F', '#6A8F7A', '#8F7A6A', '#6A7A8F'
];

function DomainCard({ domain, onSelect, onDelete }: {
  domain: Domain;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const progress = domain.totalHours
    ? Math.round(((domain.completedHours || 0) / domain.totalHours) * 100)
    : 0;
  const color = domain.color || '#8FA67F';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className="relative bg-[#F3EEE6] border border-[#EFEAE0] rounded-xl p-5 cursor-pointer group"
      style={{ boxShadow: hovered ? '0 4px 16px rgba(0,0,0,0.08)' : '0 1px 3px rgba(0,0,0,0.04)' }}
      onClick={onSelect}
    >
      {/* Color accent */}
      <div className="absolute top-0 left-0 w-1 h-full rounded-l-xl" style={{ backgroundColor: color }} />

      {/* Delete button */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="absolute top-3 right-3 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-[#B36B5C]/10 text-[#9E988F] hover:text-[#B36B5C] transition-all"
      >
        <Trash2 size={13} />
      </button>

      {/* Title */}
      <h3 className="text-[#2C2A29] font-semibold text-base pr-8 mb-2 leading-snug"
          style={{ fontFamily: 'Cinzel, Georgia, serif' }}>
        {domain.name}
      </h3>

      {/* Tags */}
      {domain.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {domain.tags.map(tag => (
            <span key={tag} className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border"
              style={{ color, borderColor: color + '40', backgroundColor: color + '15' }}>
              <Tag size={9} />#{tag}
            </span>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center gap-3 mb-3 text-xs text-[#9E988F]">
        <span className="flex items-center gap-1">
          <Clock size={11} />
          {domain.dailyHours}h/天
        </span>
        {domain.totalHours && (
          <span>共 {domain.totalHours}h</span>
        )}
      </div>

      {/* Progress bar */}
      {domain.totalHours && (
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-[#9E988F]">
            <span>总体进度</span>
            <span style={{ color }}>{progress}%</span>
          </div>
          <div className="h-1.5 bg-[#EFEAE0] rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{ backgroundColor: color }}
            />
          </div>
        </div>
      )}

      {/* Arrow */}
      <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight size={16} style={{ color }} />
      </div>
    </motion.div>
  );
}

function NewDomainModal({ onClose, onCreated }: { onClose: () => void; onCreated: (d: Domain) => void }) {
  const { config } = useStore();
  const [name, setName] = useState('');
  const [tags, setTags] = useState('');
  const [dailyHours, setDailyHours] = useState(2);
  const [color, setColor] = useState(DOMAIN_COLORS[0]);
  const [weekendPolicy, setWeekendPolicy] = useState<'none' | 'reduced' | 'full'>('full');
  const [loading, setLoading] = useState(false);
  const [useAI, setUseAI] = useState(true);

  const handleCreate = async () => {
    if (!name.trim()) return toast.error('请输入领域名称');
    setLoading(true);
    try {
      const id = `domain_${Date.now()}`;
      const domain: Domain = {
        id, name: name.trim(),
        tags: tags.split(' ').map(t => t.replace('#', '').trim()).filter(Boolean),
        dailyHours, color, createdAt: Date.now(),
        completedHours: 0,
        weekendPolicy,
      };
      await putDomain(domain);

      if (useAI && config?.apiKey) {
        // 后台生成知识树（异步，不阻塞创建）
        onCreated(domain);
        onClose();
        toast.info('正在用 AI 生成知识树，稍后刷新查看...');
        const res = await fetch('/api/ai/generate-tree', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            domain: name.trim(), dailyHours,
            apiKey: config.apiKey, provider: config.aiProvider,
            modelName: config.modelName, baseUrl: config.baseUrl,
          }),
        });
        if (!res.ok) {
          let errMsg = `AI 生成失败 (状态码: ${res.status})`;
          try {
            const errData = await res.json();
            if (errData.error) errMsg = errData.error;
          } catch {
            try {
              const txt = await res.text();
              if (txt) errMsg = `${errMsg}: ${txt.slice(0, 100)}`;
            } catch {}
          }
          toast.error(errMsg);
          return;
        }
        const data = await res.json();
        if (data.error) {
          toast.error(`AI 生成失败: ${data.error}`);
          return;
        }
        if (data.result) {
          const importOk = await importTreeJSON(id, data.result, dailyHours);
          if (!importOk) {
            toast.error(`解析 AI 知识树失败，内容格式不正确。AI 返回内容: ${data.result.slice(0, 150)}...`);
            return;
          }
          // recalc total hours
          const nodes = await getNodesByDomain(id);
          const total = nodes.filter(n => !n.parentId || nodes.every(p => p.id !== n.parentId || p.level < n.level))
            .reduce((s, n) => s + n.estimatedHours, 0);
          await putDomain({ ...domain, totalHours: total });
          toast.success('AI 知识树已生成！');
        }
      } else {
        onCreated(domain);
        onClose();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`创建失败: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 8 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="bg-[#FDFBF7] rounded-2xl p-6 w-full max-w-md border border-[#EFEAE0] shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-[#2C2A29] mb-5" style={{ fontFamily: 'Cinzel, Georgia, serif' }}>
          新建学习领域
        </h2>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-[#6E6A64] mb-1.5 block">领域名称</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="例如：人工智能算法学习"
              className="w-full px-3 py-2.5 rounded-lg border border-[#EFEAE0] bg-[#F3EEE6] text-sm text-[#2C2A29] placeholder:text-[#9E988F] focus:outline-none focus:ring-2 focus:ring-[#8FA67F]/40"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[#6E6A64] mb-1.5 block">标签（空格分隔，加 # 号）</label>
            <input
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="#编程 #算法 #AI"
              className="w-full px-3 py-2.5 rounded-lg border border-[#EFEAE0] bg-[#F3EEE6] text-sm text-[#2C2A29] placeholder:text-[#9E988F] focus:outline-none focus:ring-2 focus:ring-[#8FA67F]/40"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[#6E6A64] mb-1.5 block">每日投入时间（小时）</label>
            <div className="flex items-center gap-3">
              <input type="range" min={0.5} max={8} step={0.5} value={dailyHours}
                onChange={e => setDailyHours(Number(e.target.value))}
                className="flex-1 accent-[#8FA67F]" />
              <span className="text-sm font-semibold text-[#8FA67F] w-12 text-right">{dailyHours}h</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-[#6E6A64] mb-1.5 block">周末安排</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'none', label: '周末不安排' },
                { id: 'reduced', label: '周末减少安排' },
                { id: 'full', label: '正常投入' },
              ].map(item => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setWeekendPolicy(item.id as 'none' | 'reduced' | 'full')}
                  className={cn(
                    'py-2 text-center rounded-lg text-xs font-medium border transition-all',
                    weekendPolicy === item.id
                      ? 'border-[#8FA67F] bg-[#8FA67F]/10 text-[#3E4D3E]'
                      : 'border-[#EFEAE0] text-[#9E988F] hover:border-[#D8D0C4]'
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-[#6E6A64] mb-1.5 block">卡片颜色</label>
            <div className="flex gap-2">
              {DOMAIN_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className={cn('w-6 h-6 rounded-full transition-transform', color === c && 'scale-125 ring-2 ring-offset-2')}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          {config?.apiKey && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={useAI} onChange={e => setUseAI(e.target.checked)}
                className="accent-[#8FA67F]" />
              <span className="text-sm text-[#6E6A64]">创建后用 AI 自动生成知识树</span>
              <Sparkles size={14} className="text-[#C8834A]" />
            </label>
          )}
        </div>

        <div className="flex gap-2 mt-6">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-[#EFEAE0] text-sm text-[#6E6A64] hover:bg-[#F3EEE6] transition-colors">
            取消
          </button>
          <button onClick={handleCreate} disabled={loading}
            className="flex-1 py-2.5 rounded-lg bg-[#8FA67F] text-white text-sm font-medium hover:bg-[#5D7052] transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {loading ? <><Loader2 size={14} className="animate-spin" />生成中...</> : '创建'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

async function importTreeJSON(domainId: string, jsonStr: string, dailyHours: number): Promise<boolean> {
  let raw: { nodes?: unknown[] } = {};
  try {
    const cleaned = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    raw = JSON.parse(cleaned);
  } catch { return false; }

  let order = 0;
  async function walk(items: unknown[], parentId: string | null, level: number) {
    for (const item of items as Array<{ title: string; description?: string; estimatedHours?: number; children?: unknown[] }>) {
      const node: KnowledgeNode = {
        id: `node_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        domainId, parentId, title: item.title || '未命名',
        description: item.description,
        level, estimatedHours: item.estimatedHours || 2,
        status: 'pending', order: order++,
      };
      await putNode(node);
      if (item.children?.length) await walk(item.children, node.id, level + 1);
    }
  }

  if (Array.isArray(raw.nodes)) {
    await walk(raw.nodes, null, 0);
    return true;
  }
  return false;
}

export function DomainList() {
  const { domains, setDomains, upsertDomain, removeDomain, setActiveDomainId, setNodes } = useStore();
  const [showNew, setShowNew] = useState(false);

  const handleDelete = async (domain: Domain) => {
    if (!confirm(`确认删除「${domain.name}」及其所有知识点？`)) return;
    await deleteDomain(domain.id);
    removeDomain(domain.id);
    toast.success('已删除');
  };

  const handleSelect = async (domain: Domain) => {
    setActiveDomainId(domain.id);
    const nodes = await getNodesByDomain(domain.id);
    setNodes(nodes);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[#2C2A29]" style={{ fontFamily: 'Cinzel, Georgia, serif' }}>
            学习规划
          </h1>
          <p className="text-sm text-[#9E988F] mt-0.5">{domains.length} 个学习领域</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#8FA67F] text-white text-sm font-medium hover:bg-[#5D7052] transition-colors"
        >
          <Plus size={15} />新建领域
        </motion.button>
      </div>

      {/* Domain cards */}
      {domains.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#ECE6DA] flex items-center justify-center mb-4">
            <BookOpen size={28} className="text-[#9E988F]" />
          </div>
          <h3 className="text-[#6E6A64] font-medium mb-2">还没有学习领域</h3>
          <p className="text-sm text-[#9E988F] mb-5 max-w-[240px]">
            创建第一个学习领域，AI 将帮你自动拆解知识路径
          </p>
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#8FA67F] text-white text-sm font-medium hover:bg-[#5D7052] transition-colors">
            <Sparkles size={14} />用 AI 开始规划
          </button>
        </div>
      ) : (
        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {domains.map(d => (
              <DomainCard key={d.id} domain={d}
                onSelect={() => handleSelect(d)}
                onDelete={() => handleDelete(d)} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <AnimatePresence>
        {showNew && (
          <NewDomainModal
            onClose={() => setShowNew(false)}
            onCreated={(d) => { upsertDomain(d); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

