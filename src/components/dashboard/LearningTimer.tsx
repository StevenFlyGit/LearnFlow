'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Timer, Coffee, Zap, RotateCcw, Play, Pause, SkipForward } from 'lucide-react';
import { useStore } from '@/lib/store';
import { getNodesByDomain, type KnowledgeNode } from '@/lib/db';
import { cn } from '@/utils/utils';

type TimerMode = 'pomodoro' | 'free';
type PomodoroPhase = 'focus' | 'shortBreak' | 'longBreak';

const POMODORO_CONFIG = {
  focus: 25 * 60,        // 25分钟
  shortBreak: 5 * 60,    // 5分钟
  longBreak: 15 * 60,    // 15分钟
};

export function LearningTimer() {
  const { domains, activeDomainId } = useStore();
  
  const [mode, setMode] = useState<TimerMode>('pomodoro');
  const [phase, setPhase] = useState<PomodoroPhase>('focus');
  const [timeLeft, setTimeLeft] = useState(POMODORO_CONFIG.focus);
  const [isRunning, setIsRunning] = useState(false);
  const [round, setRound] = useState(1);
  const [selectedNode, setSelectedNode] = useState<string>('');
  const [availableNodes, setAvailableNodes] = useState<KnowledgeNode[]>([]);
  const [todayPomodoros, setTodayPomodoros] = useState(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const roundRef = useRef(round);
  roundRef.current = round;

  // 加载当前领域的知识点列表
  useEffect(() => {
    async function loadNodes() {
      if (activeDomainId) {
        const nodes = await getNodesByDomain(activeDomainId);
        // 只显示未完成的叶子节点
        const leafNodes = nodes.filter(n => 
          n.status !== 'done' && 
          !nodes.some(child => child.parentId === n.id)
        );
        setAvailableNodes(leafNodes);
      } else {
        setAvailableNodes([]);
      }
    }
    loadNodes();
  }, [activeDomainId]);

  // 计时器逻辑
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            // 时间到
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRunning]);

  const handleTimerComplete = () => {
    setIsRunning(false);
    
    if (modeRef.current === 'pomodoro') {
      if (phaseRef.current === 'focus') {
        // 专注阶段完成，增加今日番茄数
        setTodayPomodoros(prev => prev + 1);
        
        // 每4个番茄后进入长休息
        if (roundRef.current % 4 === 0) {
          setPhase('longBreak');
          setTimeLeft(POMODORO_CONFIG.longBreak);
        } else {
          setPhase('shortBreak');
          setTimeLeft(POMODORO_CONFIG.shortBreak);
        }
      } else {
        // 休息阶段完成，进入下一轮专注
        setRound(prev => prev + 1);
        setPhase('focus');
        setTimeLeft(POMODORO_CONFIG.focus);
      }
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const getPhaseLabel = () => {
    if (mode === 'free') return '自由计时';
    switch (phase) {
      case 'focus': return '番茄钟';
      case 'shortBreak': return '短休息';
      case 'longBreak': return '长休息';
    }
  };

  const getPhaseColor = () => {
    if (mode === 'free') return '#8FA67F';
    switch (phase) {
      case 'focus': return '#5D7052';
      case 'shortBreak': return '#8FA67F';
      case 'longBreak': return '#C8834A';
    }
  };

  const handleToggle = () => {
    setIsRunning(!isRunning);
  };

  const handleReset = () => {
    setIsRunning(false);
    if (mode === 'pomodoro') {
      setTimeLeft(POMODORO_CONFIG[phase]);
    } else {
      setTimeLeft(0);
    }
  };

  const handleSkip = () => {
    setIsRunning(false);
    handleTimerComplete();
  };

  const progress = mode === 'pomodoro' 
    ? ((mode === 'pomodoro' ? POMODORO_CONFIG[phase] : 0) - timeLeft) / (mode === 'pomodoro' ? POMODORO_CONFIG[phase] : 1) * 100
    : 0;

  return (
    <div className="bg-[#FDFBF7] border border-[#EFEAE0] rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Timer size={18} className="text-[#8FA67F]" />
          <span className="text-sm font-semibold text-[#2C2A29]" style={{ fontFamily: 'Cinzel, Georgia, serif' }}>
            学习计时器
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode(mode === 'pomodoro' ? 'free' : 'pomodoro')}
            className="p-1.5 rounded-lg hover:bg-[#F3EEE6] text-[#9E988F] hover:text-[#6E6A64] transition-colors"
            title={mode === 'pomodoro' ? '切换到自由计时' : '切换到番茄钟'}
          >
            <RotateCcw size={14} />
          </button>
          <span className="text-xs px-2 py-1 rounded-full bg-[#8FA67F]/15 text-[#8FA67F]">
            🍅 {todayPomodoros} 今日完成
          </span>
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setMode('pomodoro')}
          className={cn(
            'flex-1 py-2 rounded-lg text-xs font-medium transition-all',
            mode === 'pomodoro'
              ? 'bg-[#5D7052] text-white shadow-sm'
              : 'bg-[#F3EEE6] text-[#9E988F] hover:bg-[#EFEAE0]'
          )}
        >
          <Timer size={12} className="inline mr-1" />
          番茄钟
        </button>
        <button
          onClick={() => setMode('free')}
          className={cn(
            'flex-1 py-2 rounded-lg text-xs font-medium transition-all',
            mode === 'free'
              ? 'bg-[#5D7052] text-white shadow-sm'
              : 'bg-[#F3EEE6] text-[#9E988F] hover:bg-[#EFEAE0]'
          )}
        >
          <Coffee size={12} className="inline mr-1" />
          自由计时
        </button>
      </div>

      {/* Timer Display */}
      <div className="relative mb-6">
        {/* Progress Ring - Always show for both modes */}
        <svg className="w-full h-32 mb-2" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r="50"
            fill="none"
            stroke="#EFEAE0"
            strokeWidth="8"
          />
          {mode === 'pomodoro' && (
            <motion.circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke={getPhaseColor()}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 50}`}
              strokeDashoffset={`${2 * Math.PI * 50 * (1 - progress / 100)}`}
              transform="rotate(-90 60 60)"
              initial={false}
              animate={{ strokeDashoffset: `${2 * Math.PI * 50 * (1 - progress / 100)}` }}
              transition={{ duration: 0.5, ease: "linear" }}
            />
          )}
        </svg>
        
        {/* Time Display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.div
            key={`${mode}-${phase}-${Math.floor(timeLeft / 60)}`}
            initial={{ scale: 0.95, opacity: 0.8 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-3xl font-bold tabular-nums"
            style={{ color: getPhaseColor() }}
          >
            {formatTime(timeLeft)}
          </motion.div>
          <p className="text-[10px] text-[#9E988F] mt-0.5">{getPhaseLabel()}</p>
        </div>
      </div>

      {/* Current Learning Content */}
      <div className="mb-4">
        <label className="text-xs text-[#9E988F] mb-1.5 block">当前学习内容</label>
        <select
          value={selectedNode}
          onChange={(e) => setSelectedNode(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-[#EFEAE0] bg-[#FDFBF7] text-xs text-[#2C2A29] focus:outline-none focus:ring-2 focus:ring-[#8FA67F]/30"
        >
          <option value="">选择要学习的知识点...</option>
          {availableNodes.map(node => (
            <option key={node.id} value={node.id}>
              {node.title} ({node.estimatedHours}h)
            </option>
          ))}
        </select>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={handleReset}
          className="p-3 rounded-full bg-[#F3EEE6] text-[#9E988F] hover:bg-[#EFEAE0] hover:text-[#6E6A64] transition-colors"
          title="重置"
        >
          <RotateCcw size={18} />
        </button>
        
        <button
          onClick={handleToggle}
          className="p-4 rounded-full text-white shadow-lg hover:shadow-xl transition-all"
          style={{ backgroundColor: getPhaseColor() }}
        >
          {isRunning ? <Pause size={24} /> : <Play size={24} />}
        </button>
        
        {mode === 'pomodoro' && (
          <button
            onClick={handleSkip}
            className="p-3 rounded-full bg-[#F3EEE6] text-[#9E988F] hover:bg-[#EFEAE0] hover:text-[#6E6A64] transition-colors"
            title="跳过"
          >
            <SkipForward size={18} />
          </button>
        )}
      </div>

      {/* Round Indicator */}
      {mode === 'pomodoro' && (
        <div className="mt-4 flex items-center justify-center gap-1.5">
          {[1, 2, 3, 4].map(i => (
            <div
              key={i}
              className={cn(
                'w-2 h-2 rounded-full transition-colors',
                i <= (round % 4 || 4) ? 'bg-[#8FA67F]' : 'bg-[#EFEAE0]'
              )}
            />
          ))}
          <span className="text-xs text-[#9E988F] ml-2">第 {round} 轮</span>
        </div>
      )}
    </div>
  );
}
