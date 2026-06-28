'use client';

import { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { getHeatmapData } from '@/lib/learning-stats';
import { cn } from '@/utils/utils';

// 颜色等级配置
const COLOR_LEVELS = [
  { min: 0, max: 0, color: '#EFEAE0', label: '0' },
  { min: 1, max: 2, color: '#C8D8B8', label: '1-2' },
  { min: 3, max: 5, color: '#A8C498', label: '3-5' },
  { min: 6, max: 10, color: '#8FA67F', label: '6-10' },
  { min: 11, max: Infinity, color: '#5D7052', label: '10+' },
];

function getColorForCount(count: number): string {
  const level = COLOR_LEVELS.find(l => count >= l.min && count <= l.max);
  return level?.color || COLOR_LEVELS[0].color;
}

export function LearningHeatmap() {
  const [heatmapData, setHeatmapData] = useState<Array<{ date: string; count: number }>>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getHeatmapData();
        setHeatmapData(data);
        
        // 计算总数
        const total = data.reduce((sum, item) => sum + item.count, 0);
        setTotalCount(total);
      } catch (err) {
        console.error('Failed to load heatmap data:', err);
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, []);

  // 生成近12周的日期网格
  const generateGrid = () => {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 83); // 12周 * 7天 - 1天
    
    // 调整到最近的周一
    const dayOfWeek = startDate.getDay();
    if (dayOfWeek !== 1) {
      startDate.setDate(startDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    }
    
    const grid: Array<{ date: string; count: number }> = [];
    for (let i = 0; i < 84; i++) { // 12周 * 7天
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      const y = currentDate.getFullYear();
      const m = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${day}`;
      
      const dataItem = heatmapData.find(d => d.date === dateStr);
      grid.push({
        date: dateStr,
        count: dataItem?.count || 0,
      });
    }
    
    return grid;
  };

  const grid = generateGrid();
  
  // 按列组织数据（每周为一列）
  const weeks: Array<Array<{ date: string; count: number }>> = [];
  for (let i = 0; i < 12; i++) {
    const week = grid.slice(i * 7, (i + 1) * 7);
    weeks.push(week);
  }

  // 获取月份标签
  const getMonthLabels = () => {
    const labels: Array<{ month: string; startIndex: number }> = [];
    let lastMonth = '';
    
    weeks.forEach((week, index) => {
      const firstDay = week[0];
      if (firstDay) {
        const month = new Date(firstDay.date).toLocaleDateString('zh-CN', { month: 'short' });
        if (month !== lastMonth) {
          labels.push({ month, startIndex: index });
          lastMonth = month;
        }
      }
    });
    
    return labels;
  };

  const monthLabels = getMonthLabels();

  if (loading) {
    return (
      <div className="bg-[#FDFBF7] border border-[#EFEAE0] rounded-xl p-3">
        <div className="animate-pulse space-y-2">
          <div className="h-3 bg-[#EFEAE0] rounded w-1/3"></div>
          <div className="flex gap-[2px]">
            {[...Array(84)].map((_, i) => (
              <div key={i} className="w-[3px] h-[3px] bg-[#EFEAE0] rounded-[0.5px]"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#FDFBF7] border border-[#EFEAE0] rounded-xl p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Calendar size={13} className="text-[#8FA67F]" />
          <span className="text-xs font-semibold text-[#2C2A29]" style={{ fontFamily: 'Cinzel, Georgia, serif' }}>
            学习热力图
          </span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#8FA67F]/15 text-[#8FA67F]">
          近12周共 {totalCount} 次完成
        </span>
      </div>

      {/* Month Labels */}
      <div className="relative mb-1 pl-5">
        <div className="flex gap-[2px] text-[8px] text-[#9E988F]">
          {weeks.map((_, index) => {
            const monthLabel = monthLabels.find(m => m.startIndex === index);
            return (
              <div key={index} className="flex-1 text-center">
                {monthLabel ? monthLabel.month : ''}
              </div>
            );
          })}
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="flex gap-[2px]">
        {/* Weekday Labels */}
        <div className="flex flex-col gap-[2px] text-[7px] text-[#9E988F] pr-0.5 leading-none">
          <div className="h-[3px]"></div>
          <div className="h-[3px] flex items-center">一</div>
          <div className="h-[3px]"></div>
          <div className="h-[3px] flex items-center">三</div>
          <div className="h-[3px]"></div>
          <div className="h-[3px] flex items-center">五</div>
          <div className="h-[3px]"></div>
        </div>

        {/* Grid Columns */}
        <div className="flex-1 flex gap-[2px]">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-[2px]">
              {week.map((day, dayIndex) => (
                <div
                  key={`${weekIndex}-${dayIndex}`}
                  className={cn(
                    'w-[3px] h-[3px] rounded-[0.5px] transition-colors',
                    day.count > 0 ? 'cursor-pointer hover:ring-1 hover:ring-[#8FA67F] hover:ring-offset-[0.5px]' : ''
                  )}
                  style={{ backgroundColor: getColorForCount(day.count) }}
                  title={`${day.date}: ${day.count} 次完成`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-2 flex items-center gap-1.5 text-[8px] text-[#9E988F]">
        <span>少</span>
        {COLOR_LEVELS.map((level, index) => (
          <div
            key={index}
            className="w-[6px] h-[6px] rounded-[0.5px]"
            style={{ backgroundColor: level.color }}
            title={level.label}
          />
        ))}
        <span>多</span>
      </div>
    </div>
  );
}
