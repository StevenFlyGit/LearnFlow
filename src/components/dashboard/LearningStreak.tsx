'use client';

import { useState, useEffect } from 'react';
import { Flame, Trophy, AlertCircle } from 'lucide-react';
import { getStreakData } from '@/lib/learning-stats';
import { cn } from '@/utils/utils';

export function LearningStreak() {
  const [streakData, setStreakData] = useState<{
    currentStreak: number;
    longestStreak: number;
    lastStudyDate?: string;
  } | null>(null);
  
  const [hasStudiedToday, setHasStudiedToday] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getStreakData();
        setStreakData(data);
        
        // 检查今天是否已学习
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        setHasStudiedToday(data.lastStudyDate === today);
      } catch (err) {
        console.error('Failed to load streak data:', err);
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="bg-[#FDFBF7] border border-[#EFEAE0] rounded-xl p-5">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-[#EFEAE0] rounded w-2/3"></div>
          <div className="space-y-3">
            <div className="h-16 bg-[#EFEAE0] rounded-lg"></div>
            <div className="h-16 bg-[#EFEAE0] rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!streakData) {
    return (
      <div className="bg-[#FDFBF7] border border-[#EFEAE0] rounded-xl p-5 flex items-center justify-center min-h-[200px]">
        <p className="text-xs text-[#9E988F]">暂无连续记录</p>
      </div>
    );
  }

  return (
    <div className="bg-[#FDFBF7] border border-[#EFEAE0] rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Trophy size={18} className="text-[#C8834A]" />
        <span className="text-sm font-semibold text-[#2C2A29]" style={{ fontFamily: 'Cinzel, Georgia, serif' }}>
          学习连续记录
        </span>
      </div>

      {/* Today Status */}
      <div className={cn(
        'mb-4 p-3 rounded-lg flex items-center gap-2.5',
        hasStudiedToday 
          ? 'bg-[#5D7052]/10 border border-[#5D7052]/20' 
          : 'bg-[#EFEAE0]/50 border border-[#EFEAE0]'
      )}>
        {hasStudiedToday ? (
          <>
            <div className="w-2 h-2 rounded-full bg-[#5D7052]" />
            <span className="text-xs font-medium text-[#5D7052]">今天已学习 ✓</span>
          </>
        ) : (
          <>
            <AlertCircle size={14} className="text-[#9E988F]" />
            <span className="text-xs text-[#9E988F]">今天还未学习</span>
          </>
        )}
      </div>

      {/* Streak Stats */}
      <div className="space-y-3">
        {/* Current Streak */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-100">
          <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
            <Flame size={24} className="text-orange-500" />
          </div>
          <div>
            <p className="text-xs text-[#9E988F] mb-0.5">当前连续</p>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-orange-600">{streakData.currentStreak}</span>
              <span className="text-sm text-[#9E988F]">天</span>
            </div>
          </div>
        </div>

        {/* Longest Streak */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-100">
          <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
            <Trophy size={24} className="text-yellow-600" />
          </div>
          <div>
            <p className="text-xs text-[#9E988F] mb-0.5">最长连续</p>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-yellow-600">{streakData.longestStreak}</span>
              <span className="text-sm text-[#9E988F]">天</span>
            </div>
          </div>
        </div>
      </div>

      {/* Last Study Date */}
      {streakData.lastStudyDate && !hasStudiedToday && (
        <div className="mt-3 pt-3 border-t border-[#EFEAE0]">
          <p className="text-[10px] text-[#9E988F]">
            上次学习：{new Date(streakData.lastStudyDate).toLocaleDateString('zh-CN', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'short'
            })}
          </p>
        </div>
      )}
    </div>
  );
}
