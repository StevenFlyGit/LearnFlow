/**
 * 日历视图 — 展示知识点排期
 */
'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '@/lib/store';
import { cn } from '@/utils/utils';

export function CalendarView() {
  const { nodes, domains } = useStore();
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startWeekday = firstDay.getDay(); // 0=Sun
  const daysInMonth = lastDay.getDate();

  const monthName = currentDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' });

  // Map nodes by start date
  const nodesByDate: Record<string, typeof nodes> = {};
  nodes.forEach(n => {
    if (!n.startDate) return;
    const key = n.startDate.slice(0, 10);
    nodesByDate[key] = nodesByDate[key] || [];
    nodesByDate[key].push(n);
  });

  const getDomainColor = (domainId: string) => domains.find(d => d.id === domainId)?.color || '#8FA67F';

  const cells = [];
  // Empty cells for start of month
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex-1 overflow-y-auto p-5">
      {/* Navigation */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold text-[#2C2A29]" style={{ fontFamily: 'Cinzel, Georgia, serif' }}>
          {monthName}
        </h2>
        <div className="flex gap-1">
          <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
            className="p-1.5 rounded-lg hover:bg-[#EFEAE0] text-[#6E6A64]">
            <ChevronLeft size={15} />
          </button>
          <button onClick={() => setCurrentDate(new Date())}
            className="px-2.5 py-1 text-xs rounded-lg hover:bg-[#EFEAE0] text-[#6E6A64]">今天</button>
          <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
            className="p-1.5 rounded-lg hover:bg-[#EFEAE0] text-[#6E6A64]">
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-2">
        {['日', '一', '二', '三', '四', '五', '六'].map(d => (
          <div key={d} className="text-center text-[11px] font-medium text-[#9E988F] py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayNodes = nodesByDate[dateStr] || [];
          const isToday = dateStr === todayStr;

            return (
              <motion.div
                key={dateStr}
                whileHover={{ scale: 1.01 }}
                className={cn(
                  'min-h-[100px] rounded-lg p-1.5 border text-left flex flex-col justify-between transition-colors',
                  isToday ? 'border-[#8FA67F]/60 bg-[#8FA67F]/08' : 'border-[#EFEAE0] hover:border-[#D8D0C4]',
                )}
              >
                <div className="flex-1 flex flex-col">
                  <span className={cn(
                    'text-xs font-semibold block mb-1',
                    isToday ? 'text-[#8FA67F]' : 'text-[#6E6A64]'
                  )}>{day}</span>
                  <div className="space-y-1">
                    {dayNodes.slice(0, 3).map(n => (
                      <div
                        key={n.id}
                        className="relative pl-2 pr-1.5 py-0.5 rounded border border-[#EFEAE0] bg-[#FDFBF7] text-[#2C2A29] flex flex-col gap-0.5 mb-1 last:mb-0 hover:shadow-sm transition-all"
                        style={{ borderLeftWidth: '3px', borderLeftColor: getDomainColor(n.domainId) }}
                      >
                        <span className="font-semibold text-[10px] truncate text-[#2C2A29]" title={n.title}>
                          {n.title}
                        </span>
                        <div className="flex items-center justify-between text-[8px] text-[#6E6A64] mt-0.5">
                          <span>工时: {n.estimatedHours}h</span>
                          <span className={cn(
                            'px-1 py-0.2 rounded-full text-[7px] font-semibold',
                            n.status === 'done' ? 'bg-[#5D7052]/15 text-[#5D7052]' :
                            n.status === 'in_progress' ? 'bg-[#C8834A]/15 text-[#C8834A]' :
                            'bg-[#ECE6DA] text-[#9E988F]'
                          )}>
                            {n.status === 'done' ? '已完成' : n.status === 'in_progress' ? '进行中' : '未开始'}
                          </span>
                        </div>
                      </div>
                    ))}
                    {dayNodes.length > 3 && (
                      <span className="text-[9px] text-[#9E988F] font-semibold block text-right">
                        +{dayNodes.length - 3} 个任务
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
        })}
      </div>

      {/* Legend */}
      {domains.length > 0 && (
        <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-[#EFEAE0]">
          {domains.map(d => (
            <div key={d.id} className="flex items-center gap-1.5 text-[11px] text-[#6E6A64]">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
              {d.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
