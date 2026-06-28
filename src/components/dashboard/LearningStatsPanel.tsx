'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Clock, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { useStore } from '@/lib/store';
import { getNodesByDomain, type KnowledgeNode, type NodeStatus } from '@/lib/db';
import { getOverallStats, getWeeklyTrend } from '@/lib/learning-stats';
import { cn } from '@/utils/utils';

export function LearningStatsPanel() {
  const { domains, activeDomainId } = useStore();
  
  const [stats, setStats] = useState<{
    totalNodes: number;
    completedNodes: number;
    inProgressNodes: number;
    pendingNodes: number;
    completionRate: number;
  } | null>(null);
  
  const [weeklyTrend, setWeeklyTrend] = useState<Array<{
    date: string;
    count: number;
  }> | null>(null);
  
  const [estimatedRemainingHours, setEstimatedRemainingHours] = useState(0);
  const [loading, setLoading] = useState(true);

  // 加载统计数据
  useEffect(() => {
    async function loadStats() {
      if (!activeDomainId || domains.length === 0) {
        setLoading(false);
        return;
      }

      try {
        // 获取当前领域的所有节点
        const nodes = await getNodesByDomain(activeDomainId);
        
        // 计算总体统计
        const overallStats = await getOverallStats(nodes);
        setStats(overallStats);
        
        // 计算预计剩余学习时长
        const remainingNodes = nodes.filter(n => n.status !== 'done');
        const remainingHours = remainingNodes.reduce((sum, n) => sum + n.estimatedHours, 0);
        setEstimatedRemainingHours(remainingHours);
        
        // 获取本周趋势
        const trend = await getWeeklyTrend();
        setWeeklyTrend(trend);
      } catch (err) {
        console.error('Failed to load stats:', err);
      } finally {
        setLoading(false);
      }
    }
    
    loadStats();
  }, [activeDomainId, domains]);

  if (loading) {
    return (
      <div className="bg-[#FDFBF7] border border-[#EFEAE0] rounded-xl p-5 flex items-center justify-center min-h-[300px]">
        <Loader2 size={24} className="text-[#9E988F] animate-spin" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-[#FDFBF7] border border-[#EFEAE0] rounded-xl p-5 flex items-center justify-center min-h-[300px]">
        <p className="text-xs text-[#9E988F]">暂无统计数据</p>
      </div>
    );
  }

  const weekDays = ['一', '二', '三', '四', '五', '六', '日'];
  const maxCount = Math.max(...weeklyTrend?.map(t => t.count) || [1], 1);

  return (
    <div className="bg-[#FDFBF7] border border-[#EFEAE0] rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-[#8FA67F]" />
          <span className="text-sm font-semibold text-[#2C2A29]" style={{ fontFamily: 'Cinzel, Georgia, serif' }}>
            学习统计
          </span>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-[#8FA67F]/15 text-[#8FA67F]">
          {stats.completionRate.toFixed(0)}% 总进度
        </span>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-[#9E988F]">总体学习进度</span>
          <span className="text-xs font-medium text-[#2C2A29]">
            {stats.completedNodes} / {stats.totalNodes} 知识点
          </span>
        </div>
        <div className="h-2.5 bg-[#EFEAE0] rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${stats.completionRate}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="h-full bg-gradient-to-r from-[#8FA67F] to-[#5D7052] rounded-full"
          />
        </div>
      </div>

      {/* Status Counts */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#5D7052]/10">
          <CheckCircle2 size={14} className="text-[#5D7052]" />
          <div>
            <p className="text-lg font-bold text-[#5D7052]">{stats.completedNodes}</p>
            <p className="text-[10px] text-[#9E988F]">已完成</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#C8834A]/10">
          <Clock size={14} className="text-[#C8834A]" />
          <div>
            <p className="text-lg font-bold text-[#C8834A]">{stats.inProgressNodes}</p>
            <p className="text-[10px] text-[#9E988F]">进行中</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#9E988F]/10">
          <Circle size={14} className="text-[#9E988F]" />
          <div>
            <p className="text-lg font-bold text-[#9E988F]">{stats.pendingNodes}</p>
            <p className="text-[10px] text-[#9E988F]">待开始</p>
          </div>
        </div>
      </div>

      {/* Estimated Remaining Hours */}
      <div className="mb-4 p-3 rounded-lg bg-[#C8834A]/10 border border-[#C8834A]/20">
        <div className="flex items-center gap-2 mb-1">
          <Clock size={14} className="text-[#C8834A]" />
          <span className="text-xs font-medium text-[#C8834A]">预计剩余学习时长</span>
        </div>
        <p className="text-sm text-[#6E6A64]">
          {estimatedRemainingHours} 小时（按预估时长计算）
        </p>
      </div>

      {/* Weekly Trend */}
      <div>
        <p className="text-xs font-medium text-[#9E988F] mb-3">本周完成趋势</p>
        <div className="flex items-end justify-between gap-1 h-20">
          {weeklyTrend?.map((item, index) => {
            const height = item.count > 0 ? (item.count / maxCount) * 100 : 0;
            return (
              <div key={item.date} className="flex flex-col items-center gap-1 flex-1">
                <div className="w-full relative" style={{ height: '60px' }}>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${height}%` }}
                    transition={{ duration: 0.5, delay: index * 0.05 }}
                    className={cn(
                      'absolute bottom-0 left-0 right-0 rounded-t-sm',
                      item.count > 0 ? 'bg-[#8FA67F]' : 'bg-[#EFEAE0]'
                    )}
                  />
                </div>
                <span className="text-[10px] text-[#9E988F]">{weekDays[index]}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
