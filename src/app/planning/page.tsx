'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, LayoutGrid, CalendarDays, AlignJustify, LayoutList, Scissors } from 'lucide-react';
import { useStore } from '@/lib/store';
import { DomainList } from '@/components/planning/DomainList';
import { KnowledgeTree } from '@/components/planning/KnowledgeTree';
import { NoteEditor } from '@/components/planning/NoteEditor';
import { CalendarView } from '@/components/planning/CalendarView';
import { cn } from '@/utils/utils';
import { putNode, type KnowledgeNode } from '@/lib/db';
import { findOversizedLeaves, executeSplitAll } from '@/lib/node-splitter';
import { toast } from 'sonner';

export default function PlanningPage() {
  const {
    activeDomainId, activeNodeId, setActiveDomainId, domains, nodes, setNodes,
    planningView, setPlanningView, treeView, setTreeView, editorOpen,
    upsertNode, upsertDomain,
  } = useStore();

  const activeDomain = domains.find(d => d.id === activeDomainId);

  const handleAutoSplit = async () => {
    if (!activeDomain || nodes.length === 0) return;
    
    const maxLeafHours = activeDomain.dailyHours;
    if (!maxLeafHours) {
      toast.error('请先设置该领域的每日投入时间');
      return;
    }
    
    const oversized = findOversizedLeaves(nodes, maxLeafHours);
    if (oversized.length === 0) {
      toast.info('所有节点均在限制范围内，无需拆分');
      return;
    }
    
    const confirmed = confirm(`发现 ${oversized.length} 个节点超过 ${maxLeafHours}h，是否自动拆分？\n\n${oversized.map(n => `• ${n.title} (${n.estimatedHours}h)`).join('\n')}`);
    if (!confirmed) return;
    
    try {
      const result = await executeSplitAll(oversized, maxLeafHours, nodes, upsertNode, domains, upsertDomain);
      setNodes(result);
      toast.success(`已拆分 ${oversized.length} 个节点`);
    } catch (err) {
      console.error(err);
      toast.error('拆分失败');
    }
  };

  const handleSelectNode = (node: KnowledgeNode) => {
    // editor opens via store side effect in KnowledgeTree
  };

  const handleAutoSchedule = async () => {
    if (!activeDomain || nodes.length === 0) return;
    
    // 1. DFS topological sort
    const dfsSequence: KnowledgeNode[] = [];
    const visit = (parentId: string | null) => {
      const children = nodes.filter(n => n.parentId === parentId).sort((a, b) => a.order - b.order);
      for (const child of children) {
        dfsSequence.push(child);
        visit(child.id);
      }
    };
    visit(null);

    // Filter to leaf nodes only (no children) to avoid double scheduling parent categories
    const isLeaf = (nodeId: string) => !nodes.some(n => n.parentId === nodeId);
    const leafSequence = dfsSequence.filter(n => isLeaf(n.id));
    
    // Check if there's an active leaf node to allow starting schedule from it
    const activeNode = activeNodeId ? leafSequence.find(n => n.id === activeNodeId) : null;
    
    let nodesToSchedule: KnowledgeNode[] = [];
    let startDefaultDate = new Date().toISOString().slice(0, 10);
    let isPartial = false;

    if (activeNode && activeNode.status !== 'done') {
      const startFromSelected = confirm(`是否仅从当前选中的知识点「${activeNode.title}」开始重新排期？\n（点击“确定”仅重新编排该知识点及之后的计划，点击“取消”将重新排期整个领域）`);
      if (startFromSelected) {
        isPartial = true;
        const index = leafSequence.findIndex(n => n.id === activeNode.id);
        nodesToSchedule = leafSequence.slice(index).filter(n => n.status !== 'done');
        startDefaultDate = activeNode.startDate || startDefaultDate;
      }
    }

    if (!isPartial) {
      nodesToSchedule = leafSequence.filter(n => n.status !== 'done');
    }

    const startStr = prompt(
      isPartial 
        ? `请输入从知识点「${activeNode?.title}」开始的排期日期 (格式: YYYY-MM-DD):` 
        : '请输入重新排期的开始日期 (格式: YYYY-MM-DD):', 
      startDefaultDate
    );
    if (!startStr) return;
    
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startStr)) {
      toast.error('日期格式不正确，请输入 YYYY-MM-DD');
      return;
    }

    const dailyHours = activeDomain.dailyHours || 2;
    const weekendPolicy = activeDomain.weekendPolicy || 'full';

    if (nodesToSchedule.length === 0) {
      toast.info('无需排期（选中的安排节点列表为空或已全部学完）');
      return;
    }

    let currentDate = new Date(startStr);
    let currentCapacity = 0;
    let capacityInitialized = false;

    const getAvailableHoursForDate = (date: Date) => {
      const day = date.getDay(); // 0=Sun, 6=Sat
      const isWeekend = day === 0 || day === 6;
      if (isWeekend) {
        if (weekendPolicy === 'none') return 0;
        if (weekendPolicy === 'reduced') return 1;
      }
      return dailyHours;
    };

    const advanceDate = (date: Date) => {
      const next = new Date(date);
      next.setDate(next.getDate() + 1);
      return next;
    };

    const formatDate = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    const updatedNodes = [...nodes];
    const scheduleToast = toast.loading('正在计算排期...');

    try {
      // 1. Clear ALL parent nodes' startDates to ensure only leaf nodes have dates
      for (let i = 0; i < updatedNodes.length; i++) {
        if (updatedNodes[i].domainId === activeDomain.id && !isLeaf(updatedNodes[i].id) && updatedNodes[i].startDate) {
          updatedNodes[i] = { ...updatedNodes[i], startDate: undefined };
          await putNode(updatedNodes[i]);
        }
      }

      // 2. Clear startDates for the nodes to be recalculated
      for (const node of nodesToSchedule) {
        const idx = updatedNodes.findIndex(n => n.id === node.id);
        if (idx !== -1 && updatedNodes[idx].domainId === activeDomain.id) {
          updatedNodes[idx] = { ...updatedNodes[idx], startDate: undefined };
          await putNode(updatedNodes[idx]);
        }
      }

      // 3. If full reschedule, clear ALL leaf startDates in this domain
      if (!isPartial) {
        for (let i = 0; i < updatedNodes.length; i++) {
          if (updatedNodes[i].domainId === activeDomain.id && updatedNodes[i].startDate) {
            updatedNodes[i] = { ...updatedNodes[i], startDate: undefined };
            await putNode(updatedNodes[i]);
          }
        }
      }

      // 4. Map used hours for preserved nodes (which have a startDate and are NOT in nodesToSchedule)
      const usedHoursMap: Record<string, number> = {};
      const preservedNodes = updatedNodes.filter(
        n => n.domainId === activeDomain.id && n.startDate && !nodesToSchedule.some(s => s.id === n.id)
      );

      for (const pNode of preservedNodes) {
        let remainingHours = pNode.estimatedHours;
        let pDate = new Date(pNode.startDate!);
        while (remainingHours > 0) {
          const dateStr = formatDate(pDate);
          const dailyLimit = getAvailableHoursForDate(pDate);
          const alreadyUsed = usedHoursMap[dateStr] || 0;
          const available = Math.max(0, dailyLimit - alreadyUsed);

          if (available <= 0) {
            pDate = advanceDate(pDate);
            continue;
          }

          const allocated = Math.min(remainingHours, available);
          remainingHours -= allocated;
          usedHoursMap[dateStr] = alreadyUsed + allocated;

          if (remainingHours > 0) {
            pDate = advanceDate(pDate);
          }
        }
      }

      // 5. Schedule remaining nodes
      for (const node of nodesToSchedule) {
        let remainingHours = node.estimatedHours;
        let firstDateStr: string | null = null;

        while (remainingHours > 0) {
          const dateStr = formatDate(currentDate);
          if (!capacityInitialized) {
            const dailyLimit = getAvailableHoursForDate(currentDate);
            const alreadyUsed = usedHoursMap[dateStr] || 0;
            currentCapacity = Math.max(0, dailyLimit - alreadyUsed);
            capacityInitialized = true;
          }

          if (currentCapacity <= 0) {
            currentDate = advanceDate(currentDate);
            capacityInitialized = false;
            continue;
          }

          if (!firstDateStr) {
            firstDateStr = dateStr;
          }

          const allocated = Math.min(remainingHours, currentCapacity);
          remainingHours -= allocated;
          currentCapacity -= allocated;
          usedHoursMap[dateStr] = (usedHoursMap[dateStr] || 0) + allocated;

          if (currentCapacity <= 0) {
            currentDate = advanceDate(currentDate);
            capacityInitialized = false;
          }
        }

        // Find index and update
        const nodeIndex = updatedNodes.findIndex(n => n.id === node.id);
        if (nodeIndex !== -1 && updatedNodes[nodeIndex].domainId === activeDomain.id) {
          updatedNodes[nodeIndex] = {
            ...updatedNodes[nodeIndex],
            startDate: firstDateStr || undefined
          };
          await putNode(updatedNodes[nodeIndex]);
        }
      }

      setNodes(updatedNodes);
      toast.dismiss(scheduleToast);
      toast.success('自动排期成功！');
    } catch (err) {
      toast.dismiss(scheduleToast);
      toast.error('排期计算出错');
      console.error(err);
    }
  };

  return (
    <div className="flex h-svh overflow-hidden bg-[#FAF7F2]">
      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar — only shown when inside a domain */}
        {activeDomainId && activeDomain && (
          <div className="flex items-center gap-3 px-5 py-3 border-b border-[#EFEAE0] bg-[#FDFBF7] flex-shrink-0">
            <button
              onClick={() => { setActiveDomainId(null); setNodes([]); }}
              className="flex items-center gap-1.5 text-sm text-[#9E988F] hover:text-[#6E6A64] transition-colors"
            >
              <ChevronLeft size={15} />
              <span>学习规划</span>
            </button>
            <span className="text-[#D8D0C4]">/</span>
            <span className="text-sm font-medium text-[#2C2A29]" style={{ fontFamily: 'Cinzel, Georgia, serif' }}>
              {activeDomain.name}
            </span>

            <div className="ml-auto flex items-center gap-2">
              {/* Auto Split Button */}
              <button
                onClick={handleAutoSplit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#EFEAE0] bg-[#FDFBF7] text-xs font-medium text-[#6E6A64] hover:bg-[#F3EEE6] transition-colors"
              >
                <Scissors size={12} className="text-[#C8834A]" />
                自动拆分
              </button>

              {/* Auto Schedule Button */}
              <button
                onClick={handleAutoSchedule}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#EFEAE0] bg-[#FDFBF7] text-xs font-medium text-[#6E6A64] hover:bg-[#F3EEE6] transition-colors"
              >
                <CalendarDays size={12} className="text-[#8FA67F]" />
                自动排期
              </button>

              {/* Tree/Calendar toggle */}
              <div className="flex items-center gap-0.5 bg-[#ECE6DA] rounded-lg p-0.5">
                <button
                  onClick={() => setPlanningView('tree')}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all',
                    planningView === 'tree'
                      ? 'bg-[#FDFBF7] text-[#2C2A29] shadow-sm'
                      : 'text-[#9E988F] hover:text-[#6E6A64]'
                  )}
                >
                  <LayoutGrid size={12} />树视图
                </button>
                <button
                  onClick={() => setPlanningView('calendar')}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all',
                    planningView === 'calendar'
                      ? 'bg-[#FDFBF7] text-[#2C2A29] shadow-sm'
                      : 'text-[#9E988F] hover:text-[#6E6A64]'
                  )}
                >
                  <CalendarDays size={12} />日历
                </button>
              </div>

              {/* Compact/Detailed toggle (only in tree view) */}
              {planningView === 'tree' && (
                <div className="flex items-center gap-0.5 bg-[#ECE6DA] rounded-lg p-0.5">
                  <button
                    onClick={() => setTreeView('detailed')}
                    className={cn(
                      'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-all',
                      treeView === 'detailed' ? 'bg-[#FDFBF7] text-[#2C2A29] shadow-sm' : 'text-[#9E988F]'
                    )}
                    title="详细视图"
                  >
                    <LayoutList size={12} />
                  </button>
                  <button
                    onClick={() => setTreeView('compact')}
                    className={cn(
                      'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-all',
                      treeView === 'compact' ? 'bg-[#FDFBF7] text-[#2C2A29] shadow-sm' : 'text-[#9E988F]'
                    )}
                    title="精简视图"
                  >
                    <AlignJustify size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            {!activeDomainId ? (
              <motion.div
                key="domain-list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex-1 overflow-hidden flex"
              >
                <DomainList />
              </motion.div>
            ) : planningView === 'calendar' ? (
              <motion.div
                key="calendar"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex-1 min-h-0 flex flex-col overflow-hidden"
              >
                <CalendarView />
              </motion.div>
            ) : (
              <motion.div
                key="tree"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex-1 min-h-0 flex flex-col overflow-hidden"
              >
                <KnowledgeTree onSelectNode={handleSelectNode} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Right editor panel */}
          <AnimatePresence>
            {editorOpen && activeDomainId && (
              <NoteEditor />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

