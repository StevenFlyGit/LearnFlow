/**
 * 右侧 Markdown 编辑面板
 */
'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Eye, Edit, Sparkles, Loader2, ChevronDown, CheckCircle2, Lightbulb, Rss, ArrowRight, Check, BookOpen } from 'lucide-react';
import { useStore } from '@/lib/store';
import { putNote, putNode, putDomain, getNote, type Note, type KnowledgeNode } from '@/lib/db';
import { toast } from 'sonner';
import { cn } from '@/utils/utils';

// Minimal markdown renderer with dynamic direct child directory
function MarkdownPreview({
  content,
  node,
  nodes,
  onNavigate
}: {
  content: string;
  node: KnowledgeNode;
  nodes: KnowledgeNode[];
  onNavigate: (nodeId: string) => void;
}) {
  const children = nodes.filter(n => n.parentId === node.id).sort((a, b) => a.order - b.order);

  // Escape user HTML first to prevent XSS
  const escaped = content
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = escaped
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-[#2C2A29] mt-4 mb-2" style="font-family:Cinzel,Georgia,serif">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold text-[#2C2A29] mt-5 mb-2" style="font-family:Cinzel,Georgia,serif">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-[#2C2A29] mt-6 mb-3" style="font-family:Cinzel,Georgia,serif">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-[#2C2A29]">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="italic text-[#6E6A64]">$1</em>')
    .replace(/`(.+?)`/g, '<code class="px-1 py-0.5 rounded bg-[#ECE6DA] text-[#C8834A] text-xs font-mono">$1</code>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 text-sm text-[#3E4D3E] list-disc">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 text-sm text-[#3E4D3E] list-decimal">$2</li>')
    .replace(/\n\n/g, '</p><p class="text-sm text-[#3E4D3E] leading-relaxed mb-3">')
    .replace(/\n/g, '<br/>');

  return (
    <div className="px-4 py-3 text-sm text-[#3E4D3E] leading-relaxed overflow-y-auto">
      {/* Dynamic Child Nodes Directory */}
      {children.length > 0 && (
        <div className="mb-5 p-3.5 rounded-xl border border-[#EFEAE0] bg-[#F3EEE6] shadow-sm">
          <h4 className="text-[11px] font-semibold text-[#6E6A64] mb-2.5 uppercase tracking-wider flex items-center gap-1.5">
            <BookOpen size={11} className="text-[#8FA67F]" />
            子知识点目录
          </h4>
          <ul className="space-y-2 pl-0 list-none">
            {children.map(child => (
              <li key={child.id} className="text-xs flex items-center justify-between gap-4">
                <button
                  onClick={() => onNavigate(child.id)}
                  className="text-[#8FA67F] hover:text-[#5D7052] font-semibold hover:underline text-left truncate flex-1"
                >
                  • {child.title}
                </button>
                <span className={cn(
                  'text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0 font-medium',
                  child.status === 'done' ? 'bg-[#5D7052]/15 text-[#5D7052]' :
                  child.status === 'in_progress' ? 'bg-[#C8834A]/15 text-[#C8834A]' :
                  'bg-[#EFEAE0] text-[#9E988F]'
                )}>
                  {child.status === 'done' ? '已完成' : child.status === 'in_progress' ? '进行中' : '未开始'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div dangerouslySetInnerHTML={{ __html: `<p class="text-sm text-[#3E4D3E] leading-relaxed mb-3">${html}</p>` }} />
    </div>
  );
}

function AIEnhancePanel({ nodeTitle, content, onInsert }: {
  nodeTitle: string; content: string; onInsert: (text: string) => void;
}) {
  const { config } = useStore();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    corrections: Array<{ issue: string; suggestion: string }>;
    derivedTopics: Array<{ title: string; reason: string }>;
  } | null>(null);

  const run = async () => {
    if (!config?.apiKey) { toast.error('请先配置 API Key'); return; }
    if (!content.trim()) { toast.error('笔记内容为空'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/ai/enhance-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content, nodeTitle,
          apiKey: config.apiKey, provider: config.aiProvider,
          modelName: config.modelName, baseUrl: config.baseUrl,
        }),
      });
      if (!res.ok) {
        let errMsg = `AI 增强失败 (状态码: ${res.status})`;
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
      if (data.error) { toast.error(data.error); return; }
      let parsed;
      try {
        const cleaned = data.result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch (parseErr) {
        console.error('Failed to parse AI JSON:', data.result, parseErr);
        toast.error(`解析 AI 返回数据失败，内容格式不正确。AI 返回内容: ${data.result.slice(0, 100)}...`);
        return;
      }
      setResult(parsed);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`AI 增强失败: ${msg}`);
    }
    finally { setLoading(false); }
  };

  return (
    <div className="border-t border-[#EFEAE0] bg-[#F3EEE6]">
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Sparkles size={13} className="text-[#C8834A]" />
          <span className="text-xs font-medium text-[#6E6A64]">AI 强化</span>
        </div>
        <button
          onClick={run} disabled={loading}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#C8834A]/90 text-white text-[11px] hover:bg-[#C8834A] disabled:opacity-60 transition-colors cursor-pointer"
        >
          {loading ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
          {loading ? '分析中...' : '分析笔记'}
        </button>
      </div>

      {result && (
        <div className="px-4 pb-4 space-y-3">
          {result.corrections.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-[#9E988F] uppercase tracking-wide mb-1.5">逻辑修正建议</p>
              {result.corrections.map((c, i) => (
                <div key={i} className="mb-2 p-2.5 rounded-lg bg-[#FDFBF7] border border-[#EFEAE0]">
                  <p className="text-[11px] text-[#B36B5C] mb-1">⚠ {c.issue}</p>
                  <p className="text-[11px] text-[#3E4D3E]">→ {c.suggestion}</p>
                </div>
              ))}
            </div>
          )}
          {result.derivedTopics.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-[#9E988F] uppercase tracking-wide mb-1.5">衍生知识点</p>
              {result.derivedTopics.map((t, i) => (
                <div key={i} className="flex items-start gap-2 mb-1.5">
                  <Lightbulb size={11} className="text-[#C29F68] mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => onInsert(`\n\n## 衍生：${t.title}\n> ${t.reason}\n\n`)}
                      className="text-[11px] font-medium text-[#8FA67F] hover:text-[#5D7052] text-left hover:underline"
                    >
                      {t.title}
                    </button>
                    <p className="text-[10px] text-[#9E988F]">{t.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function NoteEditor() {
  const { activeNodeId, activeNote, setActiveNote, setEditorOpen, nodes, feeds, config, setActiveNodeId, upsertNode, domains, upsertDomain } = useStore();
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [showAI, setShowAI] = useState(false);

  // AI Organize comparative modal state
  const [showOrganizeModal, setShowOrganizeModal] = useState(false);
  const [organizing, setOrganizing] = useState(false);
  const [organizedContent, setOrganizedContent] = useState('');

  const node = nodes.find(n => n.id === activeNodeId);
  const content = activeNote?.content || '';
  
  const [tempTitle, setTempTitle] = useState(node?.title || '');

  useEffect(() => {
    if (node) {
      setTempTitle(node.title);
    }
  }, [node?.id, node?.title]);

  const renameNode = useCallback(async (newTitle: string) => {
    if (!node || !newTitle.trim()) return;
    const updatedNode = { ...node, title: newTitle.trim() };
    await putNode(updatedNode);
    upsertNode(updatedNode);
  }, [node, upsertNode]);

  useEffect(() => {
    if (!node || tempTitle === node.title) return;
    const timer = setTimeout(() => {
      renameNode(tempTitle);
    }, 1000);
    return () => clearTimeout(timer);
  }, [tempTitle, node?.title, renameNode]);

  const [tempHours, setTempHours] = useState(node?.estimatedHours || 2);

  useEffect(() => {
    if (node) {
      setTempHours(node.estimatedHours);
    }
  }, [node?.id, node?.estimatedHours]);

  const syncDomainHours = useCallback(async (domainId: string, allNodes: KnowledgeNode[]) => {
    const domain = domains.find(d => d.id === domainId);
    if (!domain) return;
    
    const rootNodes = allNodes.filter(n => n.parentId === null);
    const totalHours = rootNodes.reduce((sum, n) => sum + n.estimatedHours, 0);
    
    if (domain.totalHours !== totalHours) {
      const updatedDomain = { ...domain, totalHours };
      await putDomain(updatedDomain);
      upsertDomain(updatedDomain);
    }
  }, [domains, upsertDomain]);

  const syncParentHours = useCallback(async (parentId: string | null, allNodes: KnowledgeNode[]) => {
    if (!node) return;
    if (!parentId) {
      await syncDomainHours(node.domainId, allNodes);
      return;
    }
    
    const parentNode = allNodes.find(n => n.id === parentId);
    if (!parentNode) return;
    
    const children = allNodes.filter(n => n.parentId === parentId);
    const totalHours = children.reduce((sum, child) => sum + child.estimatedHours, 0);
    
    let nextNodes = allNodes;
    if (parentNode.estimatedHours !== totalHours) {
      const updatedParent = { ...parentNode, estimatedHours: totalHours };
      await putNode(updatedParent);
      upsertNode(updatedParent);
      nextNodes = allNodes.map(n => n.id === parentNode.id ? updatedParent : n);
    }
    
    await syncParentHours(parentNode.parentId, nextNodes);
  }, [node, syncDomainHours, upsertNode]);

  const updateHours = useCallback(async (hours: number) => {
    if (!node) return;
    const updatedNode = { ...node, estimatedHours: hours };
    await putNode(updatedNode);
    upsertNode(updatedNode);
    
    const nextNodes = nodes.map(n => n.id === node.id ? updatedNode : n);
    await syncParentHours(node.parentId, nextNodes);
  }, [node, nodes, upsertNode, syncParentHours]);

  useEffect(() => {
    if (!node || tempHours === node.estimatedHours) return;
    const timer = setTimeout(() => {
      updateHours(tempHours);
    }, 1000);
    return () => clearTimeout(timer);
  }, [tempHours, node?.estimatedHours, updateHours]);

  // Auto-save with debounce
  const save = useCallback(async (text: string) => {
    if (!activeNodeId) return;
    setSaving(true);
    const note: Note = { id: activeNodeId, nodeId: activeNodeId, content: text, updatedAt: Date.now() };
    await putNote(note);
    setActiveNote(note);
    setSaving(false);
    setSavedAt(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
  }, [activeNodeId, setActiveNote]);

  useEffect(() => {
    if (!content) return;
    const timer = setTimeout(() => save(content), 1500);
    return () => clearTimeout(timer);
  }, [content, save]);

  // Navigate to child node handler
  const handleChildNavigation = async (childId: string) => {
    setActiveNodeId(childId);
    const note = await getNote(childId);
    setActiveNote(note || { id: childId, nodeId: childId, content: '', updatedAt: Date.now() });
  };

  // Launch AI note organization
  const handleOrganize = async () => {
    if (!config?.apiKey) {
      toast.error('请先在 Token 配置页填写 API Key');
      return;
    }
    if (!content.trim()) {
      toast.error('当前笔记内容为空');
      return;
    }

    setOrganizing(true);
    setShowOrganizeModal(true);
    try {
      const res = await fetch('/api/ai/organize-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          nodeTitle: node?.title || '',
          apiKey: config.apiKey,
          provider: config.aiProvider,
          modelName: config.modelName,
          baseUrl: config.baseUrl
        })
      });
      if (!res.ok) {
        let errMsg = `笔记整理失败 (状态码: ${res.status})`;
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
        setShowOrganizeModal(false);
        return;
      }
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
        setShowOrganizeModal(false);
        return;
      }
      setOrganizedContent(data.result || '');
      toast.success('笔记已整理完成，请对比。');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`笔记整理失败: ${msg}`);
      setShowOrganizeModal(false);
    } finally {
      setOrganizing(false);
    }
  };

  const handleAcceptOrganized = () => {
    if (organizedContent) {
      setActiveNote({
        ...(activeNote || { id: activeNodeId!, nodeId: activeNodeId!, updatedAt: Date.now() }),
        content: organizedContent
      });
      save(organizedContent);
      setShowOrganizeModal(false);
      setOrganizedContent('');
      toast.success('已采纳 AI 整理结果！');
    }
  };

  if (!node) return null;

  return (
    <>
      <motion.div
        initial={{ x: '100%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '100%', opacity: 0 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="flex flex-col h-full bg-[#FDFBF7] border-l border-[#EFEAE0]"
        style={{ width: 350, minWidth: 350 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#EFEAE0]">
          <div className="flex-1 min-w-0 mr-2">
            <input
              value={tempTitle}
              onChange={e => setTempTitle(e.target.value)}
              className="text-sm font-semibold text-[#2C2A29] bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-[#8FA67F]/40 rounded w-full px-1 py-0.5"
              style={{ fontFamily: 'Cinzel, Georgia, serif' }}
              title="编辑该字段可重命名知识点"
            />
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className="text-[10px] text-[#9E988F]">
                {saving ? '保存中...' : savedAt ? `已保存 ${savedAt}` : '编辑笔记'}
              </span>
              <span className="text-[10px] text-[#D8D0C4]">|</span>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-[#9E988F]">预计用时:</span>
                {!nodes.some(n => n.parentId === node.id) ? (
                  <input
                    type="number"
                    min="1"
                    value={tempHours}
                    onChange={e => {
                      const val = parseInt(e.target.value) || 1;
                      setTempHours(val);
                    }}
                    className="w-10 text-center text-[10px] font-semibold rounded border border-[#EFEAE0] bg-[#FAF7F2] text-[#2C2A29] focus:outline-none focus:ring-1 focus:ring-[#8FA67F]/40 py-0.5"
                  />
                ) : (
                  <span className="text-[10px] font-semibold text-[#2C2A29]">{node.estimatedHours}</span>
                )}
                <span className="text-[10px] text-[#9E988F]">h</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 ml-2">
            {/* AI Organize Button */}
            {config?.apiKey && (
              <button
                onClick={handleOrganize}
                className="p-1.5 rounded-lg text-[#9E988F] hover:bg-[#F3EEE6] hover:text-[#8FA67F] transition-colors"
                title="AI 整理笔记"
              >
                <Sparkles size={13} />
              </button>
            )}

            <button
              onClick={() => setPreview(!preview)}
              className={cn('p-1.5 rounded-lg transition-colors text-xs',
                preview ? 'bg-[#8FA67F]/15 text-[#8FA67F]' : 'text-[#9E988F] hover:bg-[#F3EEE6]')}
              title={preview ? '编辑' : '预览'}
            >
              {preview ? <Edit size={13} /> : <Eye size={13} />}
            </button>
            <button onClick={() => setEditorOpen(false)}
              className="p-1.5 rounded-lg text-[#9E988F] hover:bg-[#F3EEE6] hover:text-[#6E6A64] transition-colors">
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Editor / Preview */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {preview ? (
            <div className="flex-1 overflow-y-auto">
              {content ? (
                <MarkdownPreview
                  content={content}
                  node={node}
                  nodes={nodes}
                  onNavigate={handleChildNavigation}
                />
              ) : (
                <p className="p-4 text-sm text-[#9E988F] italic">暂无笔记内容</p>
              )}
            </div>
          ) : (
            <textarea
              value={content}
              onChange={e => setActiveNote({ ...(activeNote || { id: activeNodeId!, nodeId: activeNodeId!, updatedAt: Date.now() }), content: e.target.value })}
              placeholder={`开始记录「${node.title}」的学习笔记...\n\n支持 Markdown 格式`}
              className="flex-1 w-full px-4 py-3 text-sm text-[#2C2A29] bg-transparent resize-none focus:outline-none placeholder:text-[#9E988F] leading-relaxed font-mono"
            />
          )}
        </div>

        {/* Related RSS hint */}
        {feeds.length > 0 && (
          <div className="px-4 py-2 border-t border-[#EFEAE0] bg-[#F3EEE6]">
            <div className="flex items-center gap-1.5 text-[11px] text-[#9E988F]">
              <Rss size={10} className="text-[#C8834A]" />
              <span>在 RSS 订阅中搜索「{node.title.slice(0, 8)}」相关资讯</span>
            </div>
          </div>
        )}

        {/* AI Enhance Panel */}
        <div>
          <button
            onClick={() => setShowAI(!showAI)}
            className="w-full flex items-center justify-between px-4 py-2.5 border-t border-[#EFEAE0] text-[11px] text-[#6E6A64] hover:bg-[#F3EEE6] transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <Sparkles size={11} className="text-[#C8834A]" />
              AI 强化 & 衍生知识点
            </div>
            <ChevronDown size={11} className={cn('transition-transform', showAI && 'rotate-180')} />
          </button>
          {showAI && (
            <AIEnhancePanel
              nodeTitle={node.title}
              content={content}
              onInsert={(text) => {
                const updated = { ...(activeNote || { id: activeNodeId!, nodeId: activeNodeId!, updatedAt: Date.now() }), content: content + text };
                setActiveNote(updated);
              }}
            />
          )}
        </div>
      </motion.div>

      {/* AI Organize comparative dialog */}
      <AnimatePresence>
        {showOrganizeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#FDFBF7] border border-[#EFEAE0] rounded-2xl p-6 w-[90vw] max-w-4xl shadow-xl flex flex-col h-[85vh] max-h-[640px]"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#EFEAE0] pb-3 mb-4 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-[#8FA67F]" />
                  <h3 className="text-base font-semibold text-[#2C2A29]" style={{ fontFamily: 'Cinzel, Georgia, serif' }}>
                    AI 笔记结构化整理
                  </h3>
                </div>
                <button
                  onClick={() => { setShowOrganizeModal(false); setOrganizedContent(''); }}
                  className="p-1 rounded hover:bg-[#F3EEE6] text-[#9E988F]"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Comparative Columns */}
              <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                {/* Left: Original note */}
                <div className="flex flex-col h-full overflow-hidden border border-[#EFEAE0] rounded-xl bg-[#FAF7F2]/60">
                  <div className="px-3.5 py-2 border-b border-[#EFEAE0] bg-[#F3EEE6] text-xs font-semibold text-[#6E6A64] uppercase tracking-wider flex-shrink-0">
                    原笔记草稿
                  </div>
                  <textarea
                    readOnly
                    value={content}
                    className="flex-1 w-full p-4 text-xs text-[#6E6A64] bg-transparent resize-none focus:outline-none leading-relaxed font-mono overflow-y-auto"
                  />
                </div>

                {/* Right: Organized note */}
                <div className="flex flex-col h-full overflow-hidden border border-[#EFEAE0] rounded-xl bg-white">
                  <div className="px-3.5 py-2 border-b border-[#EFEAE0] bg-[#8FA67F]/10 text-xs font-semibold text-[#3E4D3E] uppercase tracking-wider flex-shrink-0 flex items-center justify-between">
                    <span>AI 整理结果</span>
                    {organizing && (
                      <span className="flex items-center gap-1 text-[10px] text-[#8FA67F]">
                        <Loader2 size={10} className="animate-spin" />
                        分析重组中...
                      </span>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto p-4">
                    {organizing ? (
                      <div className="h-full flex flex-col items-center justify-center text-[#9E988F]">
                        <Loader2 size={24} className="animate-spin mb-2 text-[#8FA67F]" />
                        <p className="text-xs">正在分析纠错、剔除赘余并重构层级布局...</p>
                      </div>
                    ) : organizedContent ? (
                      <textarea
                        value={organizedContent}
                        onChange={e => setOrganizedContent(e.target.value)}
                        className="w-full h-full text-xs text-[#2C2A29] bg-transparent resize-none focus:outline-none leading-relaxed font-mono"
                      />
                    ) : (
                      <p className="text-xs text-[#9E988F] italic text-center pt-20">未生成任何整理结果</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex gap-3 pt-3 border-t border-[#EFEAE0] flex-shrink-0">
                <button
                  onClick={() => { setShowOrganizeModal(false); setOrganizedContent(''); }}
                  className="flex-1 py-2.5 rounded-lg border border-[#EFEAE0] text-xs text-[#6E6A64] hover:bg-[#F3EEE6] transition-colors"
                >
                  放弃整理
                </button>
                <button
                  onClick={handleAcceptOrganized}
                  disabled={organizing || !organizedContent}
                  className="flex-1 py-2.5 rounded-lg bg-[#8FA67F] hover:bg-[#5D7052] text-white text-xs font-semibold disabled:opacity-50 transition-colors shadow-sm flex items-center justify-center gap-1.5"
                >
                  <Check size={14} />
                  采纳并更新笔记
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
