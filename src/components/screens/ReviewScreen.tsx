'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCcw, Calendar, List, Plus, Trash2, ChevronDown, ChevronRight,
  CheckCircle2, Circle, Clock, Sparkles, BookOpen, Search, Check,
  AlertCircle, Undo2, X, PlusCircle, HelpCircle, CalendarDays
} from 'lucide-react';
import { useStore } from '@/lib/store';
import {
  getDomains, getNodesByDomain, putNode, getReviewTemplates,
  putReviewTemplate, deleteReviewTemplate, getReviewSessions,
  putReviewSession, deleteReviewSession, type ReviewTemplate,
  type ReviewSession, type KnowledgeNode, type Domain, type ReviewSessionItem
} from '@/lib/db';
import { cn } from '@/utils/utils';
import { toast } from 'sonner';

export function ReviewScreen() {
  const {
    reviewTemplates, setReviewTemplates, upsertReviewTemplate, removeReviewTemplate,
    reviewSessions, setReviewSessions, upsertReviewSession, removeReviewSession,
    domains, setDomains
  } = useStore();

  const [activeTab, setActiveTab] = useState<'today' | 'all' | 'calendar'>('today');
  const [allNodes, setAllNodes] = useState<KnowledgeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals & Panels state
  const [showAddPlan, setShowAddPlan] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);

  // Load domains, nodes, templates, sessions
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const doms = await getDomains();
        setDomains(doms);

        const templates = await getReviewTemplates();
        setReviewTemplates(templates);

        const sessions = await getReviewSessions();
        setReviewSessions(sessions);

        // Gather all nodes from all domains
        const nodesList: KnowledgeNode[] = [];
        for (const d of doms) {
          const ns = await getNodesByDomain(d.id);
          nodesList.push(...ns);
        }
        setAllNodes(nodesList);
      } catch (err) {
        console.error(err);
        toast.error('数据加载失败');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [setDomains, setReviewTemplates, setReviewSessions]);

  const todayStr = new Date().toISOString().slice(0, 10);

  // Helper: Find node details
  const getNodeDetails = (nodeId: string) => {
    const node = allNodes.find(n => n.id === nodeId);
    const domain = node ? domains.find(d => d.id === node.domainId) : null;
    return { node, domain: domain || null };
  };

  // Helper: Find template name
  const getTemplateName = (templateId: string) => {
    return reviewTemplates.find(t => t.id === templateId)?.name || '自定义模板';
  };

  // Check off a specific review round
  const handleCheckRound = async (session: ReviewSession, roundIndex: number) => {
    const updatedSessions = session.sessions.map((s, idx) => {
      if (idx === roundIndex) {
        return { ...s, status: 'done' as const, completedAt: Date.now() };
      }
      return s;
    });

    const updatedSession: ReviewSession = {
      ...session,
      sessions: updatedSessions,
      updatedAt: Date.now()
    };

    try {
      await putReviewSession(updatedSession);
      upsertReviewSession(updatedSession);
      toast.success('复习轮次已标记完成！');
    } catch {
      toast.error('保存失败');
    }
  };

  // Check off next pending review round for a card
  const handleCheckNextRound = async (session: ReviewSession) => {
    const nextIdx = session.sessions.findIndex(s => s.status === 'pending' && s.date <= todayStr);
    if (nextIdx !== -1) {
      await handleCheckRound(session, nextIdx);
    } else {
      // If none are pending or overdue, check the first pending one overall
      const firstPendingIdx = session.sessions.findIndex(s => s.status === 'pending');
      if (firstPendingIdx !== -1) {
        await handleCheckRound(session, firstPendingIdx);
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#FAF7F2]">
      {/* Top Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#EFEAE0] bg-[#FDFBF7] flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-[#2C2A29]" style={{ fontFamily: 'Cinzel, Georgia, serif' }}>
            复习规划
          </h1>
          <p className="text-xs text-[#9E988F] mt-0.5">
            采用间隔重复算法，巩固记忆漏点
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTemplateManager(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#EFEAE0] text-xs font-medium text-[#6E6A64] hover:bg-[#F3EEE6] transition-colors"
          >
            <Settings2Icon className="w-3.5 h-3.5" />
            模板管理
          </button>
          <button
            onClick={() => setShowAddPlan(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#8FA67F] hover:bg-[#5D7052] text-white text-xs font-medium transition-colors shadow-sm"
          >
            <Plus size={14} />
            添加复习计划
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 px-6 border-b border-[#EFEAE0] bg-[#FDFBF7] flex-shrink-0">
        {[
          { id: 'today', label: '今日待复习', icon: RefreshCcw },
          { id: 'all', label: '全部计划', icon: List },
          { id: 'calendar', label: '日历视图', icon: Calendar },
        ].map(tab => {
          const active = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'today' | 'all' | 'calendar')}
              className={cn(
                'flex items-center gap-1.5 py-3 border-b-2 text-xs font-medium transition-all px-1 relative',
                active
                  ? 'border-[#8FA67F] text-[#3E4D3E]'
                  : 'border-transparent text-[#9E988F] hover:text-[#6E6A64]'
              )}
            >
              <Icon size={13} className={active ? 'text-[#8FA67F]' : ''} />
              {tab.label}
              {tab.id === 'today' && (
                <TodayBadge count={reviewSessions.filter(rs => rs.sessions.some(s => s.status === 'pending' && s.date <= todayStr)).length} />
              )}
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <Clock className="w-8 h-8 text-[#9E988F] animate-spin mb-2" />
            <p className="text-xs text-[#9E988F]">加载复习日程中...</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === 'today' && (
              <motion.div
                key="today-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex-1 overflow-y-auto p-6"
              >
                <TodayReviewsView
                  sessions={reviewSessions}
                  getNodeDetails={getNodeDetails}
                  getTemplateName={getTemplateName}
                  todayStr={todayStr}
                  onCheckRound={handleCheckNextRound}
                  onDeletePlan={async (id) => {
                    if (confirm('确认删除此项复习计划？')) {
                      await deleteReviewSession(id);
                      removeReviewSession(id);
                      toast.success('复习计划已删除');
                    }
                  }}
                />
              </motion.div>
            )}

            {activeTab === 'all' && (
              <motion.div
                key="all-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex-1 overflow-y-auto p-6"
              >
                <AllPlansView
                  sessions={reviewSessions}
                  getNodeDetails={getNodeDetails}
                  getTemplateName={getTemplateName}
                  onCheckRound={handleCheckRound}
                  todayStr={todayStr}
                  onDeletePlan={async (id) => {
                    if (confirm('确认删除此项复习计划？')) {
                      await deleteReviewSession(id);
                      removeReviewSession(id);
                      toast.success('复习计划已删除');
                    }
                  }}
                />
              </motion.div>
            )}

            {activeTab === 'calendar' && (
              <motion.div
                key="calendar-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex-1 overflow-hidden"
              >
                <ReviewCalendarView
                  sessions={reviewSessions}
                  getNodeDetails={getNodeDetails}
                  onCheckRound={handleCheckRound}
                  todayStr={todayStr}
                />
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Modals & Slide-overs */}
      <AnimatePresence>
        {showAddPlan && (
          <AddPlanModal
            nodes={allNodes}
            templates={reviewTemplates}
            domains={domains}
            onClose={() => setShowAddPlan(false)}
            onSave={async (nodeIds, templateId, learnedAt) => {
              const template = reviewTemplates.find(t => t.id === templateId);
              if (!template) return;
              
              let successCount = 0;
              for (const nodeId of nodeIds) {
                const sessions: ReviewSessionItem[] = template.intervals.map(interval => {
                  const date = new Date(learnedAt);
                  date.setDate(date.getDate() + interval);
                  return {
                    date: date.toISOString().slice(0, 10),
                    status: 'pending' as const
                  };
                });

                const newSession: ReviewSession = {
                  id: `rs_${Date.now()}_${nodeId}`,
                  nodeId,
                  templateId,
                  learnedAt,
                  sessions,
                  createdAt: Date.now(),
                  updatedAt: Date.now()
                };

                try {
                  await putReviewSession(newSession);
                  upsertReviewSession(newSession);
                  successCount++;
                } catch {
                  toast.error(`节点创建复习计划失败`);
                }
              }

              if (successCount > 0) {
                toast.success(`成功创建 ${successCount} 个复习计划`);
                setShowAddPlan(false);
              }
            }}
          />
        )}

        {showTemplateManager && (
          <TemplateManagerModal
            templates={reviewTemplates}
            onClose={() => setShowTemplateManager(false)}
            onSave={async (name, intervals) => {
              const newTemplate: ReviewTemplate = {
                id: `rt_${Date.now()}`,
                name,
                intervals: [...intervals].sort((a, b) => a - b),
                isDefault: false,
                createdAt: Date.now()
              };
              try {
                await putReviewTemplate(newTemplate);
                upsertReviewTemplate(newTemplate);
                toast.success('复习模板已保存');
              } catch {
                toast.error('保存失败');
              }
            }}
            onDelete={async (id) => {
              try {
                await deleteReviewTemplate(id);
                removeReviewTemplate(id);
                toast.success('模板已删除');
              } catch {
                toast.error('删除失败');
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Small badge showing today's review counts
function TodayBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="ml-1 w-4 h-4 rounded-full bg-[#C8834A] text-white flex items-center justify-center text-[9px] font-bold">
      {count}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * VIEW: Today's Pending Reviews
 * ─────────────────────────────────────────────────────────────────────────── */
function TodayReviewsView({
  sessions, getNodeDetails, getTemplateName, todayStr, onCheckRound, onDeletePlan
}: {
  sessions: ReviewSession[];
  getNodeDetails: (id: string) => { node: KnowledgeNode | undefined, domain: Domain | null };
  getTemplateName: (id: string) => string;
  todayStr: string;
  onCheckRound: (rs: ReviewSession) => void;
  onDeletePlan: (id: string) => void;
}) {
  // Filter sessions that have pending rounds due today or overdue
  const pendingSessions = sessions.filter(s =>
    s.sessions.some(round => round.status === 'pending' && round.date <= todayStr)
  );

  if (pendingSessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#ECE6DA] flex items-center justify-center mb-4">
          <RefreshCcw size={28} className="text-[#8FA67F]" />
        </div>
        <h3 className="text-[#6E6A64] font-medium mb-1">今日无待复习任务</h3>
        <p className="text-xs text-[#9E988F] max-w-[280px]">
          太棒了！今天的复习计划已全部完成。去添加更多学习节点吧。
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {pendingSessions.map(session => {
        const { node, domain } = getNodeDetails(session.nodeId);
        if (!node) return null;

        // Calculate progress ring percentage
        const completedRounds = session.sessions.filter(s => s.status === 'done').length;
        const totalRounds = session.sessions.length;
        const progressPercent = Math.round((completedRounds / totalRounds) * 100);

        // Find next due round details
        const nextRound = session.sessions.find(s => s.status === 'pending' && s.date <= todayStr);
        const roundNum = session.sessions.indexOf(nextRound!) + 1;
        const isOverdue = nextRound && nextRound.date < todayStr;

        const color = domain?.color || '#8FA67F';

        return (
          <motion.div
            layout
            key={session.id}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-[#F3EEE6] border border-[#EFEAE0] rounded-xl p-5 hover:shadow-md transition-shadow group flex flex-col justify-between"
          >
            {/* Color Accent */}
            <div className="absolute top-0 left-0 w-1 h-full rounded-l-xl" style={{ backgroundColor: color }} />

            {/* Top row */}
            <div>
              <div className="flex items-start justify-between gap-2 mb-2.5">
                <span className="text-[10px] font-semibold tracking-wider text-[#9E988F] uppercase">
                  {domain?.name || '未知领域'}
                </span>
                <button
                  onClick={() => onDeletePlan(session.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[#B36B5C]/10 text-[#9E988F] hover:text-[#B36B5C] transition-all"
                  title="删除复习计划"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              <h4 className="text-sm font-semibold text-[#2C2A29] mb-1 line-clamp-1">
                {node.title}
              </h4>
              
              <div className="flex items-center gap-2 text-[10px] text-[#9E988F] mb-4">
                <span>模板: {getTemplateName(session.templateId)}</span>
                <span>•</span>
                <span>进度: {completedRounds}/{totalRounds} 轮</span>
              </div>
            </div>

            {/* Bottom Row: Progress Ring & Next Check */}
            <div className="flex items-center justify-between border-t border-[#EFEAE0]/60 pt-4 mt-2">
              <div className="flex items-center gap-3">
                {/* Progress Circle SVG */}
                <div className="relative w-9 h-9 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="18" cy="18" r="14" stroke="#EFEAE0" strokeWidth="2.5" fill="transparent" />
                    <circle
                      cx="18"
                      cy="18"
                      r="14"
                      stroke={color}
                      strokeWidth="2.5"
                      fill="transparent"
                      strokeDasharray={2 * Math.PI * 14}
                      strokeDashoffset={2 * Math.PI * 14 * (1 - progressPercent / 100)}
                    />
                  </svg>
                  <span className="absolute text-[9px] font-semibold text-[#6E6A64]">
                    {progressPercent}%
                  </span>
                </div>

                <div className="flex flex-col">
                  <span className={cn(
                    'text-[10px] font-medium px-2 py-0.5 rounded-full inline-block w-max',
                    isOverdue ? 'bg-[#B36B5C]/15 text-[#B36B5C]' : 'bg-[#C8834A]/15 text-[#C8834A]'
                  )}>
                    {isOverdue ? '已逾期' : '今日到期'} (第{roundNum}轮)
                  </span>
                  <span className="text-[9px] text-[#9E988F] mt-0.5">
                    应复习: {nextRound?.date}
                  </span>
                </div>
              </div>

              {/* Complete button */}
              <button
                onClick={() => onCheckRound(session)}
                className="w-8 h-8 rounded-full bg-white hover:bg-[#8FA67F]/10 border border-[#EFEAE0] flex items-center justify-center text-[#8FA67F] hover:text-[#5D7052] transition-colors group/btn"
                title="完成本次复习"
              >
                <Check size={14} className="group-hover/btn:scale-110 transition-transform" />
              </button>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * VIEW: All Plans
 * ─────────────────────────────────────────────────────────────────────────── */
function AllPlansView({
  sessions, getNodeDetails, getTemplateName, onCheckRound, todayStr, onDeletePlan
}: {
  sessions: ReviewSession[];
  getNodeDetails: (id: string) => { node: KnowledgeNode | undefined, domain: Domain | null };
  getTemplateName: (id: string) => string;
  onCheckRound: (rs: ReviewSession, roundIndex: number) => void;
  todayStr: string;
  onDeletePlan: (id: string) => void;
}) {
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#ECE6DA] flex items-center justify-center mb-4">
          <List size={28} className="text-[#9E988F]" />
        </div>
        <h3 className="text-[#6E6A64] font-medium mb-1">无复习计划</h3>
        <p className="text-xs text-[#9E988F] max-w-[280px]">
          点击右上角「添加复习计划」开始追踪您的复习历史。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-4xl mx-auto">
      {sessions.map(session => {
        const { node, domain } = getNodeDetails(session.nodeId);
        if (!node) return null;

        const isExpanded = expandedPlanId === session.id;
        const color = domain?.color || '#8FA67F';

        const completedRounds = session.sessions.filter(s => s.status === 'done').length;
        const totalRounds = session.sessions.length;

        return (
          <div
            key={session.id}
            className="bg-[#F3EEE6] border border-[#EFEAE0] rounded-xl overflow-hidden transition-all duration-200"
          >
            {/* Header row */}
            <div
              onClick={() => setExpandedPlanId(isExpanded ? null : session.id)}
              className="flex items-center gap-4 p-4 cursor-pointer hover:bg-[#EFEAE0]/40 transition-colors"
            >
              {/* Expand arrow */}
              <span className="text-[#9E988F]">
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>

              {/* Dot */}
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />

              {/* Title & Domain */}
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-semibold text-[#6E6A64] uppercase tracking-wide">
                  {domain?.name || '未知领域'}
                </h4>
                <p className="text-sm font-semibold text-[#2C2A29] truncate mt-0.5">
                  {node.title}
                </p>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 flex-shrink-0 text-xs text-[#9E988F]">
                <span>{getTemplateName(session.templateId)}</span>
                <span className="bg-[#EFEAE0] px-2 py-0.5 rounded-full text-[#6E6A64] font-medium">
                  {completedRounds}/{totalRounds} 轮
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); onDeletePlan(session.id); }}
                  className="p-1 rounded hover:bg-[#B36B5C]/10 text-[#9E988F] hover:text-[#B36B5C] transition-all"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            {/* Rounds expanded view */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="overflow-hidden bg-[#FAF7F2]/40 border-t border-[#EFEAE0]/70"
                >
                  <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {session.sessions.map((round, idx) => {
                      const done = round.status === 'done';
                      const due = round.date <= todayStr && !done;
                      const overdue = round.date < todayStr && !done;

                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            if (!done) onCheckRound(session, idx);
                          }}
                          className={cn(
                            'p-3 rounded-lg border text-center cursor-pointer transition-all flex flex-col justify-between items-center min-h-[86px]',
                            done ? 'bg-[#5D7052]/08 border-[#5D7052]/20 text-[#5D7052] opacity-75' :
                            overdue ? 'bg-[#B36B5C]/08 border-[#B36B5C]/30 text-[#B36B5C]' :
                            due ? 'bg-[#C8834A]/08 border-[#C8834A]/30 text-[#C8834A]' :
                            'bg-[#FDFBF7] border-[#EFEAE0] text-[#6E6A64]'
                          )}
                        >
                          <span className="text-[10px] font-semibold block uppercase">
                            第 {idx + 1} 轮
                          </span>
                          
                          {/* Circle state */}
                          <div className="my-1.5">
                            {done ? (
                              <CheckCircle2 size={14} className="text-[#5D7052]" />
                            ) : (
                              <Circle size={14} className={cn(
                                overdue ? 'text-[#B36B5C]' : due ? 'text-[#C8834A]' : 'text-[#9E988F]'
                              )} />
                            )}
                          </div>

                          <div className="text-[9px] font-medium">
                            {round.date}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * VIEW: Review Calendar View
 * ─────────────────────────────────────────────────────────────────────────── */
function ReviewCalendarView({
  sessions, getNodeDetails, onCheckRound, todayStr
}: {
  sessions: ReviewSession[];
  getNodeDetails: (id: string) => { node: KnowledgeNode | undefined, domain: Domain | null };
  onCheckRound: (rs: ReviewSession, roundIndex: number) => void;
  todayStr: string;
}) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startWeekday = firstDay.getDay(); // 0=Sun
  const daysInMonth = lastDay.getDate();

  const monthName = currentDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' });

  // Map review items by date string
  // Key: YYYY-MM-DD
  // Value: Array<{ session: ReviewSession, roundIndex: number, date: string, status: 'pending'|'done' }>
  const roundsByDate: Record<string, Array<{
    session: ReviewSession;
    roundIndex: number;
    title: string;
    domainColor: string;
    status: 'pending' | 'done';
  }>> = {};

  sessions.forEach(session => {
    const { node, domain } = getNodeDetails(session.nodeId);
    if (!node) return;
    
    session.sessions.forEach((round, roundIndex) => {
      roundsByDate[round.date] = roundsByDate[round.date] || [];
      roundsByDate[round.date].push({
        session,
        roundIndex,
        title: node.title,
        domainColor: domain?.color || '#8FA67F',
        status: round.status
      });
    });
  });

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto">
      {/* Calendar Header Nav */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h3 className="text-sm font-semibold text-[#2C2A29]" style={{ fontFamily: 'Cinzel, Georgia, serif' }}>
          {monthName}
        </h3>
        
        <div className="flex gap-1.5">
          <button
            onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
            className="p-1 rounded hover:bg-[#EFEAE0] text-[#6E6A64]"
          >
            <ChevronRight size={14} className="rotate-180" />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-2 py-0.5 text-[10px] font-semibold border rounded hover:bg-[#EFEAE0] text-[#6E6A64]"
          >
            今天
          </button>
          <button
            onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
            className="p-1 rounded hover:bg-[#EFEAE0] text-[#6E6A64]"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Week days */}
      <div className="grid grid-cols-7 mb-1 text-center text-[10px] font-bold text-[#9E988F] uppercase tracking-wider flex-shrink-0">
        {['日', '一', '二', '三', '四', '五', '六'].map(d => <div key={d} className="py-1">{d}</div>)}
      </div>

      {/* Cells Grid */}
      <div className="grid grid-cols-7 gap-1 flex-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} className="bg-[#FAF7F2]/40 rounded-lg" />;
          
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const items = roundsByDate[dateStr] || [];
          const isToday = dateStr === todayStr;

          return (
            <div
              key={dateStr}
              className={cn(
                'min-h-[80px] rounded-lg border p-1 bg-[#FDFBF7] flex flex-col justify-between transition-colors',
                isToday ? 'border-[#8FA67F] bg-[#8FA67F]/04 shadow-sm' : 'border-[#EFEAE0] hover:border-[#D8D0C4]'
              )}
            >
              <span className={cn(
                'text-[10px] font-bold',
                isToday ? 'text-[#8FA67F]' : 'text-[#6E6A64]'
              )}>
                {day}
              </span>

              {/* Items in cell */}
              <div className="flex-1 overflow-y-auto space-y-0.5 mt-1 max-h-[64px]">
                {items.slice(0, 3).map((item, idx) => {
                  const done = item.status === 'done';
                  const overdue = dateStr < todayStr && !done;
                  const dueToday = dateStr === todayStr && !done;

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        if (!done) onCheckRound(item.session, item.roundIndex);
                      }}
                      title={`${item.title} (第${item.roundIndex + 1}轮) - ${done ? '已完成' : '未完成'}`}
                      className={cn(
                        'text-[8px] px-1 py-0.5 rounded truncate font-medium cursor-pointer transition-colors',
                        done ? 'line-through bg-gray-200 text-gray-400' :
                        overdue ? 'bg-[#B36B5C]/15 text-[#B36B5C] border border-[#B36B5C]/20' :
                        dueToday ? 'bg-[#C8834A]/15 text-[#C8834A] border border-[#C8834A]/20' :
                        'bg-[#8FA67F]/15 text-[#3E4D3E]'
                      )}
                    >
                      {item.title}
                    </div>
                  );
                })}
                {items.length > 3 && (
                  <div className="text-[8px] text-[#9E988F] text-center">
                    +{items.length - 3} 项
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 text-[10px] text-[#9E988F] flex-shrink-0">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-[#C8834A]" />今日到期</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-[#B36B5C]" />已逾期</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-[#8FA67F]" />未来安排</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-gray-300" />已完成</span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * DIALOG: Add Review Plan Modal
 * ─────────────────────────────────────────────────────────────────────────── */
function AddPlanModal({
  nodes, templates, domains, onClose, onSave
}: {
  nodes: KnowledgeNode[];
  templates: ReviewTemplate[];
  domains: Domain[];
  onClose: () => void;
  onSave: (nodeIds: string[], templateId: string, learnedAt: number) => Promise<void>;
}) {
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0]?.id || '');
  const [learnedDate, setLearnedDate] = useState(new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState('');
  const [expandedTree, setExpandedTree] = useState<Record<string, boolean>>({});

  // Initialize all domains as expanded
  useEffect(() => {
    const init: Record<string, boolean> = {};
    domains.forEach(d => { init[`d_${d.id}`] = true; });
    setExpandedTree(init);
  }, [domains]);

  const toggleNodeSelection = (nodeId: string) => {
    setSelectedNodeIds(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  // Build tree structure: domain -> root nodes -> children
  const treeByDomain = domains.map(domain => {
    const domainNodes = nodes
      .filter(n => n.domainId === domain.id)
      .filter(n => !search || n.title.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.level - b.level || a.order - b.order);
    return { domain, nodes: domainNodes };
  }).filter(g => g.nodes.length > 0);

  const toggleTreeItem = (key: string) => {
    setExpandedTree(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const renderTreeNodes = (allDomainNodes: KnowledgeNode[], parentId: string | null, depth: number): React.ReactNode => {
    return allDomainNodes
      .filter(n => n.parentId === parentId)
      .sort((a, b) => a.order - b.order)
      .map(node => {
        const children = allDomainNodes.filter(n => n.parentId === node.id);
        const hasChildren = children.length > 0;
        const treeKey = `n_${node.id}`;
        const isExpanded = expandedTree[treeKey] !== false;
        const selected = selectedNodeIds.has(node.id);

        return (
          <div key={node.id}>
            <div
              onClick={() => toggleNodeSelection(node.id)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors text-xs rounded-md mx-1',
                selected ? 'bg-[#8FA67F]/15 text-[#3E4D3E] font-medium' : 'hover:bg-[#FAF7F2] text-[#6E6A64]'
              )}
              style={{ paddingLeft: `${8 + depth * 16}px` }}
            >
              {/* Expand arrow for non-leaf */}
              {hasChildren ? (
                <div
                  className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0 text-[#9E988F]"
                  onClick={e => { e.stopPropagation(); toggleTreeItem(treeKey); }}
                >
                  {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                </div>
              ) : (
                <div className="w-3.5 flex-shrink-0" />
              )}
              {/* Checkbox */}
              <div className={cn(
                'w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-all',
                selected ? 'bg-[#8FA67F] border-[#8FA67F]' : 'border-[#D8D0C4]'
              )}>
                {selected && <Check size={9} className="text-white" />}
              </div>
              <span className="truncate flex-1">{node.title}</span>
              <span className="text-[9px] text-[#9E988F] flex-shrink-0">
                {node.status === 'done' ? '已完成' : node.status === 'in_progress' ? '进行中' : '未开始'}
              </span>
            </div>
            {hasChildren && isExpanded && renderTreeNodes(allDomainNodes, node.id, depth + 1)}
          </div>
        );
      });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedNodeIds.size === 0) {
      toast.error('请至少选择一个学习节点');
      return;
    }
    const timestamp = new Date(learnedDate).getTime();
    onSave(Array.from(selectedNodeIds), selectedTemplateId, timestamp);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[#FDFBF7] border border-[#EFEAE0] rounded-2xl w-full max-w-5xl shadow-xl flex flex-col"
        style={{ height: '80vh', minHeight: '520px' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#EFEAE0] flex-shrink-0">
          <h3 className="text-base font-semibold text-[#2C2A29]" style={{ fontFamily: 'Cinzel, Georgia, serif' }}>
            添加复习计划
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-[#F3EEE6] text-[#9E988F]">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 grid grid-cols-2 gap-0 overflow-hidden">
            {/* Left: Hierarchical node selector */}
            <div className="flex flex-col border-r border-[#EFEAE0] overflow-hidden">
              <div className="px-4 pt-4 pb-2 flex-shrink-0">
                <label className="text-xs font-medium text-[#6E6A64] block mb-2">
                  选择知识点
                </label>
                <div className="relative">
                  <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9E988F]" />
                  <input
                    type="text"
                    placeholder="搜索知识点..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-[#EFEAE0] bg-[#F3EEE6] text-[#2C2A29] focus:outline-none focus:ring-1 focus:ring-[#8FA67F]"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-2 pb-3">
                {treeByDomain.length === 0 ? (
                  <p className="text-[10px] text-[#9E988F] text-center py-8">无匹配的知识点</p>
                ) : (
                  <div className="space-y-1">
                    {treeByDomain.map(({ domain, nodes: domainNodes }) => {
                      const domainKey = `d_${domain.id}`;
                      const domainExpanded = expandedTree[domainKey] !== false;
                      const rootNodes = domainNodes.filter(n => n.parentId === null);

                      return (
                        <div key={domain.id} className="mb-1">
                          <button
                            type="button"
                            onClick={() => toggleTreeItem(domainKey)}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#EFEAE0]/60 transition-colors text-left"
                          >
                            {domainExpanded ? <ChevronDown size={12} className="text-[#9E988F]" /> : <ChevronRight size={12} className="text-[#9E988F]" />}
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: domain.color }} />
                            <span className="text-xs font-semibold text-[#2C2A29] flex-1 truncate">{domain.name}</span>
                            <span className="text-[9px] text-[#9E988F]">{domainNodes.length}</span>
                          </button>
                          {domainExpanded && (
                            <div className="mt-0.5">
                              {renderTreeNodes(domainNodes, null, 0)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Config panel */}
            <div className="flex flex-col px-6 py-4 overflow-y-auto space-y-5">
              {/* Selected nodes info */}
              {selectedNodeIds.size > 0 && (
                <div className="p-3 rounded-xl border border-[#8FA67F]/30 bg-[#8FA67F]/05">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 size={14} className="text-[#8FA67F] flex-shrink-0" />
                    <span className="text-xs text-[#3E4D3E] font-medium">
                      已选 {selectedNodeIds.size} 个知识点
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 max-h-[80px] overflow-y-auto">
                    {Array.from(selectedNodeIds).map(id => {
                      const n = nodes.find(x => x.id === id);
                      if (!n) return null;
                      return (
                        <span key={id} className="inline-flex items-center gap-1 bg-white border border-[#EFEAE0] rounded-full px-2 py-0.5 text-[10px] text-[#3E4D3E]">
                          {n.title}
                          <button type="button" onClick={() => toggleNodeSelection(id)} className="text-[#9E988F] hover:text-[#B36B5C]">
                            <X size={9} />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Template Selector */}
              <div>
                <label className="text-xs font-medium text-[#6E6A64] block mb-1.5">
                  应用复习模板
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={e => setSelectedTemplateId(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs rounded-lg border border-[#EFEAE0] bg-[#F3EEE6] text-[#2C2A29] focus:outline-none focus:ring-1 focus:ring-[#8FA67F]"
                >
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} (间隔: {t.intervals.join(', ')} 天)
                    </option>
                  ))}
                </select>
              </div>

              {/* Learned Date Selector */}
              <div>
                <label className="text-xs font-medium text-[#6E6A64] block mb-1.5">
                  学完日期
                </label>
                <input
                  type="date"
                  value={learnedDate}
                  onChange={e => setLearnedDate(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs rounded-lg border border-[#EFEAE0] bg-[#F3EEE6] text-[#2C2A29] focus:outline-none focus:ring-1 focus:ring-[#8FA67F]"
                />
                <span className="text-[9px] text-[#9E988F] mt-1.5 block">
                  复习阶段将自动从此日期开始计算，并向后安排间隔天数。
                </span>
              </div>
            </div>
          </div>

          {/* Footer buttons */}
          <div className="flex gap-2 px-6 py-4 border-t border-[#EFEAE0] flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-[#EFEAE0] text-xs text-[#6E6A64] hover:bg-[#F3EEE6] transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-lg bg-[#8FA67F] hover:bg-[#5D7052] text-white text-xs font-medium transition-colors shadow-sm"
            >
              保存计划
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * DIALOG: Template Manager Modal
 * ─────────────────────────────────────────────────────────────────────────── */
function TemplateManagerModal({
  templates, onClose, onSave, onDelete
}: {
  templates: ReviewTemplate[];
  onClose: () => void;
  onSave: (name: string, intervals: number[]) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [intervals, setIntervals] = useState<number[]>([]);
  const [newInterval, setNewInterval] = useState('');

  const handleAddInterval = () => {
    const val = parseInt(newInterval.trim());
    if (isNaN(val) || val <= 0) {
      toast.error('请输入正整数天数');
      return;
    }
    if (intervals.includes(val)) {
      toast.error('该天数已存在');
      return;
    }
    setIntervals([...intervals, val].sort((a, b) => a - b));
    setNewInterval('');
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.error('请输入模板名称');
      return;
    }
    if (intervals.length === 0) {
      toast.error('请至少添加一个复习间隔');
      return;
    }
    onSave(name.trim(), intervals);
    setName('');
    setIntervals([]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[#FDFBF7] border border-[#EFEAE0] rounded-2xl p-6 w-full max-w-2xl shadow-xl flex flex-col h-[85vh] max-h-[560px]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#EFEAE0] pb-3 mb-4">
          <h3 className="text-base font-semibold text-[#2C2A29]" style={{ fontFamily: 'Cinzel, Georgia, serif' }}>
            复习模板管理
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-[#F3EEE6] text-[#9E988F]">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6 pb-4">
          {/* Left: Template list */}
          <div className="border-r border-[#EFEAE0] pr-0 md:pr-6 space-y-3">
            <h4 className="text-xs font-semibold text-[#6E6A64] uppercase tracking-wider mb-2">
              现有模板
            </h4>
            <div className="space-y-2">
              {templates.map(t => (
                <div
                  key={t.id}
                  className="p-3 rounded-xl border border-[#EFEAE0] bg-[#F3EEE6] flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-semibold text-[#2C2A29] flex items-center gap-1.5">
                      {t.name}
                      {t.isDefault && (
                        <span className="bg-[#8FA67F]/20 text-[#3E4D3E] text-[9px] px-1.5 py-0.5 rounded">默认</span>
                      )}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {t.intervals.map((int, i) => (
                        <span key={i} className="bg-white border border-[#EFEAE0] text-[#9E988F] text-[9px] px-1.5 py-0.5 rounded">
                          第{i + 1}次: +{int}天
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  {!t.isDefault && (
                    <button
                      onClick={() => onDelete(t.id)}
                      className="p-1.5 rounded hover:bg-[#B36B5C]/10 text-[#9E988F] hover:text-[#B36B5C]"
                      title="删除此模板"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right: New template editor */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-[#6E6A64] uppercase tracking-wider mb-2">
              新建自定义模板
            </h4>

            <div>
              <label className="text-[10px] font-medium text-[#6E6A64] block mb-1">模板名称</label>
              <input
                type="text"
                placeholder="例如：快速复习"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#EFEAE0] bg-[#F3EEE6] text-[#2C2A29] focus:outline-none focus:ring-1 focus:ring-[#8FA67F]"
              />
            </div>

            <div>
              <label className="text-[10px] font-medium text-[#6E6A64] block mb-1">添加复习间隔（天）</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="number"
                  placeholder="如：3"
                  value={newInterval}
                  onChange={e => setNewInterval(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddInterval()}
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-[#EFEAE0] bg-[#F3EEE6] text-[#2C2A29] focus:outline-none focus:ring-1 focus:ring-[#8FA67F]"
                />
                <button
                  type="button"
                  onClick={handleAddInterval}
                  className="px-3 py-1.5 rounded-lg bg-[#8FA67F] text-white text-xs font-medium hover:bg-[#5D7052]"
                >
                  添加间隔
                </button>
              </div>

              {/* Day tags */}
              <div className="flex flex-wrap gap-1.5 p-3 border border-[#EFEAE0] rounded-xl bg-white min-h-[64px]">
                {intervals.length === 0 ? (
                  <span className="text-[10px] text-[#9E988F] italic self-center mx-auto">添加天数定义间隔（从小到大自动排序）</span>
                ) : (
                  intervals.map((int, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 bg-[#F3EEE6] border border-[#EFEAE0] text-[#2C2A29] text-[10px] px-2 py-0.5 rounded-full"
                    >
                      第{i + 1}次: +{int}天
                      <button
                        type="button"
                        onClick={() => setIntervals(intervals.filter(x => x !== int))}
                        className="text-[#9E988F] hover:text-[#B36B5C]"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            <button
              onClick={handleSave}
              className="w-full py-2 bg-[#8FA67F] hover:bg-[#5D7052] text-white text-xs font-semibold rounded-lg shadow-sm"
            >
              保存新模板
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// custom Settings2 icon because Settings2 icon exists under a different name or just manually build
function Settings2Icon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M20 7h-9" />
      <path d="M14 17H5" />
      <circle cx="17" cy="17" r="3" />
      <circle cx="7" cy="7" r="3" />
    </svg>
  );
}
