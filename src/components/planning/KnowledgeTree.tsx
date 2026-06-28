/**
 * 知识树组件 — 分层展示知识点，支持展开/折叠、添加/删除节点
 */
'use client';
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight, ChevronDown, Plus, Trash2, Circle,
  CheckCircle2, Clock, Edit, Loader2, Sparkles, ArrowUp, ArrowDown, AlertTriangle
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { putNode, deleteNode, getNote, putNote, getNodesByDomain, type KnowledgeNode } from '@/lib/db';
import { generateNodeId, getNow, syncDomainHours, syncParentHours, recalculateAllParentHours } from '@/lib/tree-utils';
import { cn } from '@/utils/utils';
import { toast } from 'sonner';

type NodeStatus = 'pending' | 'in_progress' | 'done';
const STATUS_ICONS = {
  pending: <Circle size={13} className="text-[#9E988F]" />,
  in_progress: <Clock size={13} className="text-[#C8834A]" />,
  done: <CheckCircle2 size={13} className="text-[#5D7052]" />,
};
const STATUS_LABELS: Record<NodeStatus, string> = {
  pending: '未开始', in_progress: '进行中', done: '已完成'
};


function TreeNode({
  node, allNodes, level, compact, onSelectNode
}: {
  node: KnowledgeNode;
  allNodes: KnowledgeNode[];
  level: number;
  compact: boolean;
  onSelectNode: (n: KnowledgeNode) => void;
}) {
  const { upsertNode, removeNode, setActiveNodeId, activeNodeId, setEditorOpen, setActiveNote, activeDomainId, domains, upsertDomain } = useStore();
  const [expanded, setExpanded] = useState(level < 2);
  const [addingChild, setAddingChild] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const children = allNodes.filter(n => n.parentId === node.id).sort((a, b) => a.order - b.order);
  const hasChildren = children.length > 0;
  const isActive = activeNodeId === node.id;
  
  // Check if this is an oversized leaf node (using domain's dailyHours as threshold)
  const domain = domains.find(d => d.id === node.domainId);
  const maxLeafHours = domain?.dailyHours;
  const isOversizedLeaf = !hasChildren && !!maxLeafHours && node.estimatedHours > maxLeafHours;

  const siblings = allNodes.filter(n => n.parentId === node.parentId).sort((a, b) => a.order - b.order);
  const index = siblings.findIndex(n => n.id === node.id);
  const canMoveUp = index > 0;
  const canMoveDown = index < siblings.length - 1;

  const handleMove = async (e: React.MouseEvent, direction: 'up' | 'down') => {
    e.stopPropagation();
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= siblings.length) return;
    
    const targetNode = siblings[targetIndex];
    const tempOrder = node.order;
    
    const updatedNode = { ...node, order: targetNode.order };
    const updatedTargetNode = { ...targetNode, order: tempOrder };
    
    await putNode(updatedNode);
    await putNode(updatedTargetNode);
    
    upsertNode(updatedNode);
    upsertNode(updatedTargetNode);
  };

  const handleSelect = async () => {
    setActiveNodeId(node.id);
    setEditorOpen(true);
    const note = await getNote(node.id);
    setActiveNote(note || { id: node.id, nodeId: node.id, content: '', updatedAt: getNow() });
    onSelectNode(node);
  };

  const cycleStatus = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const order: NodeStatus[] = ['pending', 'in_progress', 'done'];
    const next = order[(order.indexOf(node.status) + 1) % 3];
    const updated = { ...node, status: next };
    await putNode(updated);
    upsertNode(updated);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren && !confirm('删除该节点将同时删除所有子节点，确认？')) return;
    
    const isDescendant = (testNode: KnowledgeNode, ancestorId: string): boolean => {
      let curr = testNode;
      while (curr.parentId) {
        if (curr.parentId === ancestorId) return true;
        const parent = allNodes.find(n => n.id === curr.parentId);
        if (!parent) break;
        curr = parent;
      }
      return false;
    };

    // recursively delete children
    const deleteRecursive = async (id: string) => {
      const kids = allNodes.filter(n => n.parentId === id);
      for (const k of kids) await deleteRecursive(k.id);
      await deleteNode(id);
      removeNode(id);
    };
    await deleteRecursive(node.id);

    const remainingNodes = allNodes.filter(n => n.id !== node.id && !isDescendant(n, node.id));
    if (node.parentId) {
      await syncParentHours(node.parentId, remainingNodes, upsertNode, node.domainId, domains, upsertDomain);
    } else {
      await syncDomainHours(node.domainId, remainingNodes, domains, upsertDomain);
    }

    toast.success('已删除');
  };

  const handleAddChild = async () => {
    if (!newTitle.trim()) return;
    const childNode: KnowledgeNode = {
      id: generateNodeId(),
      domainId: node.domainId,
      parentId: node.id,
      title: newTitle.trim(),
      level: node.level + 1,
      estimatedHours: 2,
      status: 'pending',
      order: children.length,
    };

    // Clear parent's startDate (since it's now a parent node, not a leaf)
    const updatedParent = { ...node, startDate: undefined };
    await putNode(updatedParent);
    upsertNode(updatedParent);

    await putNode(childNode);
    upsertNode(childNode);

    // recalculate parent hours recursively
    const nextNodes = allNodes.map(n => n.id === node.id ? updatedParent : n).concat(childNode);
    await syncParentHours(node.id, nextNodes, upsertNode, node.domainId, domains, upsertDomain);

    setNewTitle('');
    setAddingChild(false);
    setExpanded(true);
  };

  const indentPx = level * 20;

  if (compact) {
    return (
      <div>
        <motion.div
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer group transition-colors',
            isActive ? 'bg-[#8FA67F]/12 text-[#2C2A29]' : 'hover:bg-[#EFEAE0] text-[#6E6A64]'
          )}
          style={{ paddingLeft: `${12 + indentPx}px` }}
          onClick={handleSelect}
        >
          {hasChildren ? (
            <button onClick={e => { e.stopPropagation(); setExpanded(!expanded); }} className="text-[#9E988F]">
              {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          ) : (
            <span className="w-3" />
          )}
          <span className="text-xs flex-1 truncate">{node.title}</span>
          {isOversizedLeaf && <span title={`超过 ${maxLeafHours}h，建议拆分`}><AlertTriangle size={11} className="text-[#C8834A]" /></span>}
          <span className="opacity-0 group-hover:opacity-100">{STATUS_ICONS[node.status]}</span>
        </motion.div>
        <AnimatePresence>
          {expanded && hasChildren && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }}>
              {children.map(c => (
                <TreeNode key={c.id} node={c} allNodes={allNodes} level={level + 1} compact onSelectNode={onSelectNode} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div>
      <motion.div
        layout
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        className={cn(
          'group flex flex-col rounded-xl border mb-2 cursor-pointer transition-all',
          isActive
            ? 'border-[#8FA67F]/50 bg-[#8FA67F]/08'
            : 'border-[#EFEAE0] bg-[#F3EEE6] hover:border-[#D8D0C4]'
        )}
        style={{ marginLeft: `${indentPx}px` }}
        onClick={handleSelect}
      >
        <div className="flex items-start gap-2 p-3">
          {/* Expand toggle */}
          <button
            onClick={e => { e.stopPropagation(); setExpanded(!expanded); }}
            className="mt-0.5 text-[#9E988F] hover:text-[#6E6A64] flex-shrink-0 w-4"
          >
            {hasChildren
              ? (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)
              : <span className="w-4 inline-block" />}
          </button>

          {/* Status icon */}
          <button onClick={cycleStatus} className="mt-0.5 flex-shrink-0" title={STATUS_LABELS[node.status]}>
            {STATUS_ICONS[node.status]}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className={cn('text-sm font-medium leading-snug', isActive ? 'text-[#2C2A29]' : 'text-[#3E4D3E]')}>
              {node.title}
            </p>
            {node.description && (
              <p className="text-xs text-[#9E988F] mt-0.5 line-clamp-1">{node.description}</p>
            )}
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-[10px] text-[#9E988F] flex items-center gap-1">
                <Clock size={10} />{node.estimatedHours}h
              </span>
              {isOversizedLeaf && (
                <span className="text-[10px] text-[#C8834A] flex items-center gap-0.5" title={`超过 ${maxLeafHours}h，建议拆分`}>
                  <AlertTriangle size={10} />超标
                </span>
              )}
              {node.startDate && (
                <span className="text-[10px] text-[#9E988F]">
                  {new Date(node.startDate).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                </span>
              )}
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full',
                node.status === 'done' ? 'bg-[#5D7052]/15 text-[#5D7052]' :
                node.status === 'in_progress' ? 'bg-[#C8834A]/15 text-[#C8834A]' :
                'bg-[#EFEAE0] text-[#9E988F]'
              )}>
                {STATUS_LABELS[node.status]}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            {canMoveUp && (
              <button onClick={e => handleMove(e, 'up')}
                className="p-1 rounded hover:bg-[#ECE6DA] text-[#9E988F] hover:text-[#8FA67F]"
                title="上移">
                <ArrowUp size={12} />
              </button>
            )}
            {canMoveDown && (
              <button onClick={e => handleMove(e, 'down')}
                className="p-1 rounded hover:bg-[#ECE6DA] text-[#9E988F] hover:text-[#8FA67F]"
                title="下移">
                <ArrowDown size={12} />
              </button>
            )}
            <button onClick={e => { e.stopPropagation(); setAddingChild(true); }}
              className="p-1 rounded hover:bg-[#ECE6DA] text-[#9E988F] hover:text-[#8FA67F]"
              title="添加子节点">
              <Plus size={12} />
            </button>
            <button onClick={handleDelete}
              className="p-1 rounded hover:bg-[#B36B5C]/10 text-[#9E988F] hover:text-[#B36B5C]"
              title="删除">
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Add child input */}
      <AnimatePresence>
        {addingChild && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ marginLeft: `${indentPx + 20}px` }}
            className="mb-2"
          >
            <div className="flex gap-2">
              <input
                autoFocus
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddChild(); if (e.key === 'Escape') setAddingChild(false); }}
                placeholder="输入子知识点名称，回车确认"
                className="flex-1 px-3 py-2 text-xs rounded-lg border border-[#8FA67F]/50 bg-[#FDFBF7] text-[#2C2A29] placeholder:text-[#9E988F] focus:outline-none focus:ring-2 focus:ring-[#8FA67F]/30"
              />
              <button onClick={handleAddChild}
                className="px-3 py-2 rounded-lg bg-[#8FA67F] text-white text-xs hover:bg-[#5D7052]">
                添加
              </button>
              <button onClick={() => setAddingChild(false)}
                className="px-3 py-2 rounded-lg border border-[#EFEAE0] text-xs text-[#9E988F] hover:bg-[#F3EEE6]">
                取消
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Children */}
      <AnimatePresence>
        {expanded && hasChildren && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
          >
            {children.map(child => (
              <TreeNode key={child.id} node={child} allNodes={allNodes} level={level + 1} compact={false} onSelectNode={onSelectNode} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function KnowledgeTree({ onSelectNode }: { onSelectNode: (n: KnowledgeNode) => void }) {
  const { activeDomainId, activeNodeId, domains, nodes, setNodes, config, treeView, upsertNode, upsertDomain } = useStore();
  const [generating, setGenerating] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const domain = domains.find(d => d.id === activeDomainId);
  const activeNode = nodes.find(n => n.id === activeNodeId);
  const rootNodes = nodes.filter(n => n.parentId === null).sort((a, b) => a.order - b.order);

  const handleAddNode = async (type: 'child' | 'sibling' | 'top') => {
    setShowAddMenu(false);
    if (!domain) return;
    
    let parentId: string | null = null;
    let level = 0;
    
    if (type === 'child' && activeNode) {
      parentId = activeNode.id;
      level = activeNode.level + 1;
      
      // Clear parent's startDate (since it's now a parent node, not a leaf)
      if (activeNode.startDate) {
        const updatedParent = { ...activeNode, startDate: undefined };
        await putNode(updatedParent);
        upsertNode(updatedParent);
      }
    } else if (type === 'sibling' && activeNode) {
      parentId = activeNode.parentId;
      level = activeNode.level;
    }
    
    const title = prompt(
      type === 'child' ? `在「${activeNode?.title}」下添加子知识点名称：` :
      type === 'sibling' ? `与「${activeNode?.title}」同级添加知识点名称：` :
      '添加顶层知识点名称：'
    );
    if (!title || !title.trim()) return;
    
    const siblings = nodes.filter(n => n.parentId === parentId);
    
    const node: KnowledgeNode = {
      id: generateNodeId(),
      domainId: domain.id,
      parentId,
      title: title.trim(),
      level,
      estimatedHours: 4,
      status: 'pending',
      order: siblings.length,
    };
    
    await putNode(node);
    const fresh = await getNodesByDomain(domain.id);
    setNodes(fresh);

    // Sync hours
    if (parentId) {
      await syncParentHours(parentId, fresh, upsertNode, domain.id, domains, upsertDomain);
    } else {
      await syncDomainHours(domain.id, fresh, domains, upsertDomain);
    }

    toast.success('添加成功');
  };

  const handleGenerate = async () => {
    if (!config?.apiKey) return toast.error('请先在 Token 配置页填写 API Key');
    if (!domain) return;

    if (nodes.length > 0) {
      const confirmReset = confirm('该领域下已存在学习计划。使用 AI 重新生成将彻底覆盖并删除该领域下的所有学习内容（包括已完成的任务），是否确定继续？');
      if (!confirmReset) return;
    }

    setGenerating(true);
    try {
      const res = await fetch('/api/ai/generate-tree', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: domain.name, dailyHours: domain.dailyHours,
          goal: domain.goal, scope: domain.scope, industry: domain.industry,
          apiKey: config.apiKey, provider: config.aiProvider,
          modelName: config.modelName, baseUrl: config.baseUrl,
        }),
      });
      if (!res.ok) {
        let errMsg = `生成失败 (状态码: ${res.status})`;
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
      // clear existing nodes then import
      for (const n of nodes) await deleteNode(n.id);
      let order = 0;
      const walk = async (items: Array<{ title: string; description?: string; estimatedHours?: number; children?: unknown[] }>, parentId: string | null, level: number) => {
        for (const item of items) {
          const node: KnowledgeNode = {
            id: generateNodeId(),
            domainId: domain.id, parentId, title: item.title || '未命名',
            description: item.description, level, estimatedHours: item.estimatedHours || 2,
            status: 'pending', order: order++,
          };
          await putNode(node);
          if (item.children?.length) await walk(item.children as Array<{ title: string; description?: string; estimatedHours?: number; children?: unknown[] }>, node.id, level + 1);
        }
      };
      let parsed;
      try {
        const cleaned = data.result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch (parseErr) {
        console.error('Failed to parse AI JSON:', data.result, parseErr);
        toast.error(`解析 AI 知识树数据失败，内容格式不正确。AI 返回内容: ${data.result.slice(0, 150)}...`);
        return;
      }
      if (parsed.nodes) await walk(parsed.nodes, null, 0);
      const fresh = await getNodesByDomain(domain.id);
      setNodes(fresh);
      await recalculateAllParentHours(fresh, upsertNode, domain.id, domains, upsertDomain);
      toast.success('知识树已重新生成！');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`生成失败: ${msg}`);
    }
    finally { setGenerating(false); }
  };

  if (!domain) return null;

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <motion.button
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={handleGenerate} disabled={generating}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#8FA67F] text-white text-xs font-medium hover:bg-[#5D7052] disabled:opacity-60"
        >
          {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {generating ? '生成中...' : 'AI 重新生成'}
        </motion.button>
        <div className="relative">
          {activeNode ? (
            <>
              <button
                onClick={() => setShowAddMenu(!showAddMenu)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#8FA67F] bg-[#8FA67F]/10 text-xs font-semibold text-[#3E4D3E] hover:bg-[#8FA67F]/20 transition-all cursor-pointer"
              >
                <Plus size={12} />手动添加 <ChevronDown size={10} className={cn('transition-transform', showAddMenu && 'rotate-180')} />
              </button>
              
              <AnimatePresence>
                {showAddMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowAddMenu(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                      className="absolute left-0 mt-1.5 w-40 rounded-xl border border-[#EFEAE0] bg-[#FDFBF7] shadow-lg py-1.5 z-20"
                    >
                      <button
                        onClick={() => handleAddNode('child')}
                        className="w-full px-3 py-2 text-left text-xs text-[#2C2A29] hover:bg-[#F3EEE6] transition-colors"
                      >
                        添加子知识点
                      </button>
                      <button
                        onClick={() => handleAddNode('sibling')}
                        className="w-full px-3 py-2 text-left text-xs text-[#2C2A29] hover:bg-[#F3EEE6] transition-colors"
                      >
                        添加同级知识点
                      </button>
                      <button
                        onClick={() => handleAddNode('top')}
                        className="w-full px-3 py-2 text-left text-xs text-[#2C2A29] hover:bg-[#F3EEE6] transition-colors"
                      >
                        添加顶层知识点
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </>
          ) : (
            <button
              onClick={async () => {
                const title = prompt('新知识点名称');
                if (!title || !domain) return;
                const node: KnowledgeNode = {
                  id: generateNodeId(), domainId: domain.id, parentId: null,
                  title, level: 0, estimatedHours: 4, status: 'pending', order: rootNodes.length,
                };
                await putNode(node);
                const fresh = await getNodesByDomain(domain.id);
                setNodes(fresh);
                toast.success('添加成功');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#EFEAE0] text-xs text-[#6E6A64] hover:bg-[#F3EEE6] cursor-pointer"
            >
              <Plus size={12} />手动添加
            </button>
          )}
        </div>
      </div>

      {/* Tree */}
      {nodes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-[#9E988F] mb-3">暂无知识点</p>
          <button onClick={handleGenerate}
            className="text-xs text-[#8FA67F] hover:text-[#5D7052] flex items-center gap-1">
            <Sparkles size={12} />点击用 AI 生成
          </button>
        </div>
      ) : (
        <div>
          {rootNodes.map(node => (
            <TreeNode
              key={node.id} node={node} allNodes={nodes}
              level={0} compact={treeView === 'compact'} onSelectNode={onSelectNode}
            />
          ))}
        </div>
      )}
    </div>
  );
}
