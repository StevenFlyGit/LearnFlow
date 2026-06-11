'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, Circle, Clock, Loader2, Sparkles,
  BarChart2, CalendarDays, BookOpen, Quote, RefreshCcw, AlertCircle
} from 'lucide-react';
import { useStore } from '@/lib/store';
import {
  getDailyPlan, putDailyPlan, getReviewSessions, putReviewSession,
  getNodesByDomain, putNode, getNote, type DailyPlan, type DailyPlanItem,
  type KnowledgeNode, type ReviewSession, type Domain
} from '@/lib/db';
import { cn } from '@/utils/utils';
import { toast } from 'sonner';

const getNow = () => Date.now();

export type DashboardTaskItem = {
  nodeId: string;
  nodeTitle: string;
  domainName: string;
  domainColor: string;
  estimatedHours: number;
  status: 'pending' | 'done';
  type: 'study' | 'review';
  reviewRoundIndex?: number;
};

export function WeeklySummaryPanel({ tasks }: { tasks: DashboardTaskItem[] }) {
  const { config } = useStore();
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<{
    completed: string[];
    inProgress: string[];
    pending: string[];
    highlights: string;
    suggestion: string;
  } | null>(null);

  const generate = async () => {
    if (!config?.apiKey) {
      toast.error('请先在 Token 配置页填写 API Key');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/ai/weekly-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: tasks.map(t => ({
            title: t.nodeTitle,
            status: t.status === 'done' ? 'done' : 'in_progress',
            content: `[${t.type === 'study' ? '学习' : '复习'}] ${t.domainName} - ${t.nodeTitle}`
          })),
          apiKey: config.apiKey,
          provider: config.aiProvider,
          modelName: config.modelName,
          baseUrl: config.baseUrl,
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
      if (data.error) {
        toast.error(data.error);
        return;
      }
      let parsed;
      try {
        const cleaned = data.result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch (parseErr) {
        console.error('Failed to parse AI JSON:', data.result, parseErr);
        toast.error(`解析周总结数据失败，内容格式不正确。AI 返回内容: ${data.result.slice(0, 100)}...`);
        return;
      }
      setSummary(parsed);
      toast.success('周总结已生成！');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`生成失败: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#F3EEE6] border border-[#EFEAE0] rounded-xl overflow-hidden mb-6">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#EFEAE0]">
        <div className="flex items-center gap-2">
          <BarChart2 size={15} className="text-[#8FA67F]" />
          <span className="text-sm font-semibold text-[#2C2A29]" style={{ fontFamily: 'Cinzel, Georgia, serif' }}>本周学习总结</span>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#8FA67F] text-white text-xs hover:bg-[#5D7052] disabled:opacity-60 transition-colors cursor-pointer"
        >
          {loading ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
          {loading ? '生成中...' : 'AI 生成'}
        </button>
      </div>
      {summary ? (
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: '已完成', count: summary.completed.length, color: '#5D7052' },
              { label: '进行中', count: summary.inProgress.length, color: '#C8834A' },
              { label: '未开始', count: summary.pending.length, color: '#9E988F' },
            ].map(({ label, count, color }) => (
              <div key={label} className="rounded-lg p-3 text-center" style={{ backgroundColor: color + '18' }}>
                <p className="text-2xl font-bold" style={{ color }}>{count}</p>
                <p className="text-[11px] text-[#6E6A64]">{label}</p>
              </div>
            ))}
          </div>
          <div className="bg-[#FDFBF7] rounded-lg p-3 border border-[#EFEAE0]">
            <p className="text-[11px] font-semibold text-[#8FA67F] mb-1">本周收获</p>
            <p className="text-xs text-[#3E4D3E] leading-relaxed">{summary.highlights}</p>
          </div>
          <div className="bg-[#FDFBF7] rounded-lg p-3 border border-[#EFEAE0]">
            <p className="text-[11px] font-semibold text-[#C8834A] mb-1">下周建议</p>
            <p className="text-xs text-[#3E4D3E] leading-relaxed">{summary.suggestion}</p>
          </div>
        </div>
      ) : (
        <div className="px-4 py-8 text-center">
          <p className="text-xs text-[#9E988F]">点击「AI 生成」获取本周学习与复习总结分析</p>
        </div>
      )}
    </div>
  );
}

export function DashboardScreen() {
  const { domains, config, upsertNode } = useStore();
  const [tasks, setTasks] = useState<DashboardTaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSummary, setShowSummary] = useState(false);
  const [aiSummary, setAiSummary] = useState('');
  const [loadingAiSummary, setLoadingAiSummary] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayLabel = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });

  // Load daily plan or construct it
  useEffect(() => {
    async function loadPlan() {
      if (domains.length === 0) {
        setTasks([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // 1. Try to read cache from dailyPlans
        const cachedPlan = await getDailyPlan(todayStr);

        if (cachedPlan) {
          // Resolve domain colors & titles for the cached items
          const resolvedItems: DashboardTaskItem[] = [];
          
          // Fetch all nodes to resolve details
          const allNodesMap: Record<string, { node: KnowledgeNode, dName: string, dColor: string }> = {};
          for (const d of domains) {
            const ns = await getNodesByDomain(d.id);
            ns.forEach(n => {
              allNodesMap[n.id] = { node: n, dName: d.name, dColor: d.color || '#8FA67F' };
            });
          }

          let cacheDirty = false;
          const filteredItems: typeof cachedPlan.items = [];

          cachedPlan.items.forEach(item => {
            const details = allNodesMap[item.nodeId];
            if (item.type === 'study' && !details) {
              cacheDirty = true;
              return;
            }
            filteredItems.push(item);
            
            let actualStatus = item.status;
            if (item.type === 'study' && details) {
              actualStatus = details.node.status === 'done' ? 'done' : 'pending';
            }
            if (actualStatus !== item.status) {
              item.status = actualStatus;
              cacheDirty = true;
            }

            resolvedItems.push({
              nodeId: item.nodeId,
              nodeTitle: item.title,
              domainName: details?.dName || '已删领域',
              domainColor: details?.dColor || '#8FA67F',
              estimatedHours: item.duration,
              status: actualStatus,
              type: item.type
            });
          });

          if (cacheDirty) {
            cachedPlan.items = filteredItems;
            await putDailyPlan(cachedPlan);
          }

          setTasks(resolvedItems);
          setAiSummary(cachedPlan.aiSummary || '');
        } else {
          // 2. Compute live today plan
          const todayTasks: DashboardTaskItem[] = [];

          // Study nodes: Scheduled for today or overdue
          for (const domain of domains) {
            const nodes = await getNodesByDomain(domain.id);
            
            const studyNodes = nodes.filter(n => {
              if (n.status === 'done') return false;
              if (!n.startDate) return n.status === 'in_progress';
              return n.startDate.slice(0, 10) <= todayStr;
            });

            studyNodes.forEach(n => {
              todayTasks.push({
                nodeId: n.id,
                nodeTitle: n.title,
                domainName: domain.name,
                domainColor: domain.color || '#8FA67F',
                estimatedHours: n.estimatedHours,
                status: 'pending',
                type: 'study'
              });
            });
          }

          // Review nodes: Due today or overdue
          const allReviews = await getReviewSessions();
          for (const rs of allReviews) {
            // Find active pending round that is due today or before
            const dueRound = rs.sessions.find(s => s.status === 'pending' && s.date <= todayStr);
            if (dueRound) {
              // Resolve node details
              let targetNode: KnowledgeNode | null = null;
              let targetDomain: Domain | null = null;
              
              for (const d of domains) {
                const ns = await getNodesByDomain(d.id);
                const found = ns.find(n => n.id === rs.nodeId);
                if (found) {
                  targetNode = found;
                  targetDomain = d;
                  break;
                }
              }

              if (targetNode) {
                todayTasks.push({
                  nodeId: rs.nodeId,
                  nodeTitle: `复习: ${targetNode.title}`,
                  domainName: targetDomain?.name || '未知领域',
                  domainColor: targetDomain?.color || '#C8834A',
                  estimatedHours: 0.5, // Default 0.5h for reviews
                  status: 'pending',
                  type: 'review',
                  reviewRoundIndex: rs.sessions.indexOf(dueRound)
                });
              }
            }
          }

          setTasks(todayTasks);

          // Write new plan to IndexedDB cache
          const dbItems: DailyPlanItem[] = todayTasks.map(t => ({
            nodeId: t.nodeId,
            title: t.nodeTitle,
            type: t.type,
            duration: t.estimatedHours,
            status: t.status
          }));

          const newPlan: DailyPlan = {
            id: todayStr,
            date: todayStr,
            totalAvailableHours: todayTasks.reduce((acc, t) => acc + t.estimatedHours, 0),
            items: dbItems,
            createdAt: getNow(),
            updatedAt: getNow()
          };

          await putDailyPlan(newPlan);
        }
      } catch (err) {
        console.error(err);
        toast.error('今日任务加载失败');
      } finally {
        setLoading(false);
      }
    }

    loadPlan();
  }, [domains]);

  // Toggle task completion
  const toggleTask = async (task: DashboardTaskItem) => {
    const nextStatus: 'pending' | 'done' = task.status === 'done' ? 'pending' : 'done';

    try {
      // 1. Sync backend states
      if (task.type === 'study') {
        // Update original node status
        const nodeDomain = domains.find(d => d.name === task.domainName);
        if (nodeDomain) {
          const ns = await getNodesByDomain(nodeDomain.id);
          const originalNode = ns.find(n => n.id === task.nodeId);
          if (originalNode) {
            const updatedNode = {
              ...originalNode,
              status: nextStatus === 'done' ? 'done' as const : 'in_progress' as const
            };
            await putNode(updatedNode);
            upsertNode(updatedNode);
          }
        }
      } else if (task.type === 'review') {
        // Find review session and update it
        const rs = await getReviewSessions();
        const session = rs.find(s => s.nodeId === task.nodeId);
        if (session) {
          const updatedRounds = session.sessions.map((r) => {
            // Check matching round
            if (r.status === (nextStatus === 'done' ? 'pending' : 'done') && r.date <= todayStr) {
              return { ...r, status: nextStatus === 'done' ? 'done' as const : 'pending' as const, completedAt: nextStatus === 'done' ? getNow() : undefined };
            }
            return r;
          });

          await putReviewSession({
            ...session,
            sessions: updatedRounds,
            updatedAt: getNow()
          });
        }
      }

      // 2. Update local state and IndexedDB dailyPlans
      const updatedTasks = tasks.map(t => {
        if (t.nodeId === task.nodeId && t.type === task.type) {
          return { ...t, status: nextStatus };
        }
        return t;
      });
      setTasks(updatedTasks);

      const cachedPlan = await getDailyPlan(todayStr);
      if (cachedPlan) {
        cachedPlan.items = cachedPlan.items.map(item => {
          if (item.nodeId === task.nodeId && item.type === task.type) {
            return { ...item, status: nextStatus };
          }
          return item;
        });
        cachedPlan.updatedAt = getNow();
        await putDailyPlan(cachedPlan);
      }

      toast.success(nextStatus === 'done' ? '任务已标记完成！' : '任务已撤销完成');
    } catch (err) {
      console.error(err);
      toast.error('任务状态更新失败');
    }
  };

  // Generate AI Daily Summary Text
  const handleGenerateAiSummary = async () => {
    if (!config?.apiKey) {
      toast.error('请先在 Token 配置页填写 API Key');
      return;
    }
    if (tasks.length === 0) {
      toast.info('今天没有安排任何任务，无需生成总结。');
      return;
    }

    setLoadingAiSummary(true);
    try {
      const res = await fetch('/api/ai/daily-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasks: tasks.map(t => ({ title: t.nodeTitle, type: t.type })),
          apiKey: config.apiKey,
          provider: config.aiProvider,
          modelName: config.modelName,
          baseUrl: config.baseUrl
        })
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
        toast.error(data.error);
        return;
      }

      const text = data.result || '';
      setAiSummary(text);

      // Save to IndexedDB cache
      const cachedPlan = await getDailyPlan(todayStr);
      if (cachedPlan) {
        cachedPlan.aiSummary = text;
        cachedPlan.updatedAt = getNow();
        await putDailyPlan(cachedPlan);
      }
      toast.success('今日寄语生成成功！');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`AI 生成失败: ${msg}`);
    } finally {
      setLoadingAiSummary(false);
    }
  };

  const doneCount = tasks.filter(t => t.status === 'done').length;
  const totalHours = tasks.reduce((s, t) => s + t.estimatedHours, 0);
  const byDomain: Record<string, DashboardTaskItem[]> = {};
  tasks.forEach(t => {
    byDomain[t.domainName] = byDomain[t.domainName] || [];
    byDomain[t.domainName].push(t);
  });

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[#FAF7F2]">
      {/* Top Header */}
      <div className="flex items-start justify-between mb-6 flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-[#2C2A29] mb-1" style={{ fontFamily: 'Cinzel, Georgia, serif' }}>
            每日看板
          </h1>
          <div className="flex items-center gap-1.5 text-xs text-[#9E988F]">
            <CalendarDays size={13} />
            <span>{todayLabel}</span>
          </div>
        </div>
        <button
          onClick={() => setShowSummary(!showSummary)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#EFEAE0] bg-[#FDFBF7] text-xs text-[#6E6A64] hover:bg-[#F3EEE6] transition-colors cursor-pointer"
        >
          <BarChart2 size={13} />
          本周总结
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[
          {
            value: `${doneCount}/${tasks.length}`,
            label: '今日任务进度',
            color: '#2C2A29',
            progress: tasks.length ? (doneCount / tasks.length) * 100 : 0
          },
          {
            value: `${totalHours}h`,
            label: '今日计划学习时长',
            color: '#C8834A',
            progress: null
          },
          {
            value: String(domains.length),
            label: '活跃学习领域',
            color: '#3E4D3E',
            progress: null
          },
        ].map(({ value, label, color, progress }) => (
          <div key={label} className="bg-[#F3EEE6] border border-[#EFEAE0] rounded-xl p-4">
            <p className="text-2xl font-bold" style={{ color }}>{value}</p>
            <p className="text-[10px] text-[#9E988F] font-medium uppercase tracking-wider mt-0.5">{label}</p>
            {progress !== null && (
              <div className="mt-2.5 h-1.5 bg-[#EFEAE0] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.8 }}
                  className="h-full bg-[#8FA67F] rounded-full"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* AI Daily Summary Block */}
      {config?.apiKey && tasks.length > 0 && (
        <div className="bg-[#F3EEE6]/60 border border-[#EFEAE0] rounded-xl p-5 mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <Quote size={80} />
          </div>

          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[#8FA67F] flex items-center gap-1.5" style={{ fontFamily: 'Cinzel, Georgia, serif' }}>
              <Quote size={12} className="rotate-180" />
              今日寄语
            </span>
            
            <button
              onClick={handleGenerateAiSummary}
              disabled={loadingAiSummary}
              className="p-1 rounded hover:bg-[#EFEAE0] text-[#9E988F] hover:text-[#6E6A64]"
              title="重新生成寄语"
            >
              <RefreshCcw size={12} className={loadingAiSummary ? 'animate-spin' : ''} />
            </button>
          </div>

          {aiSummary ? (
            <p className="text-xs text-[#6E6A64] leading-relaxed italic pr-6">
              “{aiSummary}”
            </p>
          ) : (
            <button
              onClick={handleGenerateAiSummary}
              disabled={loadingAiSummary}
              className="text-xs font-medium text-[#8FA67F] hover:text-[#5D7052] flex items-center gap-1 bg-[#FAF7F2] border border-[#EFEAE0] px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              {loadingAiSummary ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              生成今日 AI 寄语
            </button>
          )}
        </div>
      )}

      {/* Weekly Summary Panel */}
      <AnimatePresence>
        {showSummary && <WeeklySummaryPanel tasks={tasks} />}
      </AnimatePresence>

      {/* Task List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 rounded-xl border border-[#EFEAE0] bg-[#F3EEE6] animate-pulse" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#ECE6DA] flex items-center justify-center mb-4">
            <BookOpen size={24} className="text-[#9E988F]" />
          </div>
          <h3 className="text-[#6E6A64] font-medium mb-1">今日无待办学习任务</h3>
          <p className="text-xs text-[#9E988F] max-w-[280px]">
            去学习规划页为知识点设置开始日期，或者到复习规划中开启今日复习任务。
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(byDomain).map(([domainName, domainTasks]) => (
            <div key={domainName}>
              {/* Group label */}
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: domainTasks[0].domainColor }} />
                <span className="text-xs font-bold text-[#6E6A64] uppercase tracking-wider">{domainName}</span>
                <span className="text-[10px] text-[#9E988F] bg-[#EFEAE0] px-2 py-0.5 rounded-full ml-1">
                  {domainTasks.filter(t => t.status === 'done').length}/{domainTasks.length} 完成
                </span>
              </div>

              {/* Group items */}
              <div className="space-y-2">
                {domainTasks.map(task => {
                  const done = task.status === 'done';
                  const isReview = task.type === 'review';

                  return (
                    <motion.div
                      key={`${task.nodeId}-${task.type}`}
                      layout
                      whileHover={{ x: 2 }}
                      className={cn(
                        'flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all',
                        done
                          ? 'border-[#EFEAE0] bg-[#F3EEE6]/50 opacity-60'
                          : 'border-[#EFEAE0] bg-[#F3EEE6] hover:border-[#D8D0C4] hover:shadow-sm'
                      )}
                      onClick={() => toggleTask(task)}
                    >
                      <motion.div whileTap={{ scale: 0.9 }}>
                        {done ? (
                          <CheckCircle2 size={18} className="text-[#5D7052] flex-shrink-0" />
                        ) : (
                          <Circle size={18} className="text-[#9E988F] flex-shrink-0 hover:text-[#8FA67F] transition-colors" />
                        )}
                      </motion.div>

                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'text-sm font-medium leading-snug truncate',
                          done ? 'line-through text-[#9E988F]' : 'text-[#2C2A29]'
                        )}>
                          {task.nodeTitle}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isReview && (
                          <span className="text-[9px] font-semibold bg-[#C8834A]/12 text-[#C8834A] border border-[#C8834A]/20 px-1.5 py-0.5 rounded-full uppercase">
                            复习
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-xs text-[#9E988F]">
                          <Clock size={11} />
                          {task.estimatedHours}h
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
