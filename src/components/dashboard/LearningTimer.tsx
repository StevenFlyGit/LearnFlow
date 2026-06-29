'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Timer, Coffee, RotateCcw, Play, Pause, SkipForward } from 'lucide-react';
import { cn } from '@/utils/utils';

type TimerMode = 'pomodoro' | 'free';
type PomodoroPhase = 'focus' | 'shortBreak' | 'longBreak';

const POMODORO_CONFIG = {
  focus: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
};

// 自由计时预设选项（分钟）
const FREE_PRESETS = [5, 10, 15, 25, 45, 60];

export function LearningTimer() {
  // ---- 番茄钟状态 ----
  const [phase, setPhase] = useState<PomodoroPhase>('focus');
  const [pomodoroTimeLeft, setPomodoroTimeLeft] = useState(POMODORO_CONFIG.focus);
  const [isPomodoroRunning, setIsPomodoroRunning] = useState(false);
  const [round, setRound] = useState(1);
  const [todayPomodoros, setTodayPomodoros] = useState(0);

  // ---- 自由计时状态 ----
  const [freeDuration, setFreeDuration] = useState(25 * 60); // 默认25分钟
  const [freeTimeLeft, setFreeTimeLeft] = useState(25 * 60);
  const [isFreeRunning, setIsFreeRunning] = useState(false);
  const [freeMinutesInput, setFreeMinutesInput] = useState('25');

  // ---- 公共 ----
  const [mode, setMode] = useState<TimerMode>('pomodoro');

  const pomodoroTimerRef = useRef<NodeJS.Timeout | null>(null);
  const freeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const roundRef = useRef(round);
  roundRef.current = round;

  // 番茄钟计时
  useEffect(() => {
    if (isPomodoroRunning) {
      pomodoroTimerRef.current = setInterval(() => {
        setPomodoroTimeLeft(prev => {
          if (prev <= 1) {
            handlePomodoroComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (pomodoroTimerRef.current) {
        clearInterval(pomodoroTimerRef.current);
        pomodoroTimerRef.current = null;
      }
    }
    return () => {
      if (pomodoroTimerRef.current) clearInterval(pomodoroTimerRef.current);
    };
  }, [isPomodoroRunning]);

  // 自由计时
  useEffect(() => {
    if (isFreeRunning) {
      freeTimerRef.current = setInterval(() => {
        setFreeTimeLeft(prev => {
          if (prev <= 1) {
            setIsFreeRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (freeTimerRef.current) {
        clearInterval(freeTimerRef.current);
        freeTimerRef.current = null;
      }
    }
    return () => {
      if (freeTimerRef.current) clearInterval(freeTimerRef.current);
    };
  }, [isFreeRunning]);

  const handlePomodoroComplete = () => {
    setIsPomodoroRunning(false);
    if (phaseRef.current === 'focus') {
      setTodayPomodoros(prev => prev + 1);
      if (roundRef.current % 4 === 0) {
        setPhase('longBreak');
        setPomodoroTimeLeft(POMODORO_CONFIG.longBreak);
      } else {
        setPhase('shortBreak');
        setPomodoroTimeLeft(POMODORO_CONFIG.shortBreak);
      }
    } else {
      setRound(prev => prev + 1);
      setPhase('focus');
      setPomodoroTimeLeft(POMODORO_CONFIG.focus);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const getPhaseLabel = () => {
    switch (phase) {
      case 'focus': return '专注中';
      case 'shortBreak': return '短休息';
      case 'longBreak': return '长休息';
    }
  };

  // 统一颜色：所有阶段都用同一个绿色系
  const PRIMARY_COLOR = '#5D7052';
  const SECONDARY_COLOR = '#8FA67F';
  const BREAK_COLOR = '#C8834A';

  const getPhaseColor = () => {
    switch (phase) {
      case 'focus': return PRIMARY_COLOR;
      case 'shortBreak': return SECONDARY_COLOR;
      case 'longBreak': return BREAK_COLOR;
    }
  };

  // 番茄钟进度
  const pomodoroProgress = (POMODORO_CONFIG[phase] - pomodoroTimeLeft) / POMODORO_CONFIG[phase] * 100;
  // 自由计时进度
  const freeProgress = freeDuration > 0 ? (freeDuration - freeTimeLeft) / freeDuration * 100 : 0;

  // 自由计时调整时间（分钟）
  const adjustFreeTime = (deltaMinutes: number) => {
    const currentMinutes = Math.round(freeDuration / 60);
    const newMinutes = Math.max(1, currentMinutes + deltaMinutes);
    const newSeconds = newMinutes * 60;
    setFreeDuration(newSeconds);
    setFreeMinutesInput(String(newMinutes));
    if (!isFreeRunning) {
      setFreeTimeLeft(newSeconds);
    }
  };

  // 处理自由计时输入
  const handleFreeMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFreeMinutesInput(value);
    
    // 只允许数字
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 1 && num <= 999) {
      const newSeconds = num * 60;
      setFreeDuration(newSeconds);
      if (!isFreeRunning) {
        setFreeTimeLeft(newSeconds);
      }
    }
  };

  // 应用输入的分钟数
  const applyFreeMinutes = () => {
    const num = parseInt(freeMinutesInput, 10);
    if (!isNaN(num) && num >= 1 && num <= 999) {
      const newSeconds = num * 60;
      setFreeDuration(newSeconds);
      if (!isFreeRunning) {
        setFreeTimeLeft(newSeconds);
      }
    } else {
      // 恢复为当前有效值
      setFreeMinutesInput(String(Math.round(freeDuration / 60)));
    }
  };

  const handleFreeReset = () => {
    setIsFreeRunning(false);
    setFreeTimeLeft(freeDuration);
  };

  const handlePomodoroReset = () => {
    setIsPomodoroRunning(false);
    setPomodoroTimeLeft(POMODORO_CONFIG[phase]);
  };

  const handlePomodoroSkip = () => {
    setIsPomodoroRunning(false);
    handlePomodoroComplete();
  };

  // SVG 参数 - 统一尺寸
  const svgSize = 160;
  const center = svgSize / 2;
  const radius = 65;
  const circumference = 2 * Math.PI * radius;

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
        <span className="text-xs px-2 py-1 rounded-full bg-[#8FA67F]/15 text-[#8FA67F]">
          🍅 {todayPomodoros} 今日完成
        </span>
      </div>

      {/* Mode Tabs */}
      <div className="flex gap-2 mb-5">
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

      {/* ===== 番茄钟面板 ===== */}
      {mode === 'pomodoro' && (
        <div className="min-h-[280px] flex flex-col">
          {/* Clock with time inside */}
          <div className="mb-5 flex justify-center">
            <div className="relative" style={{ width: svgSize, height: svgSize }}>
              <svg className="absolute inset-0" width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
                <circle cx={center} cy={center} r={radius} fill="none" stroke="#EFEAE0" strokeWidth="8" />
                <motion.circle
                  cx={center} cy={center} r={radius} fill="none"
                  stroke={getPhaseColor()} strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={circumference}
                  animate={{ strokeDashoffset: circumference * (1 - pomodoroProgress / 100) }}
                  transition={{ duration: 0.5, ease: 'linear' }}
                  transform={`rotate(-90 ${center} ${center})`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.div
                  key={`pomo-${phase}-${Math.floor(pomodoroTimeLeft / 60)}`}
                  initial={{ scale: 0.95, opacity: 0.8 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-3xl font-bold tabular-nums"
                  style={{ color: getPhaseColor() }}
                >
                  {formatTime(pomodoroTimeLeft)}
                </motion.div>
                <p className="text-[10px] text-[#9E988F] mt-0.5">{getPhaseLabel()}</p>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3 mb-3">
            <button
              onClick={handlePomodoroReset}
              className="p-3 rounded-full bg-[#F3EEE6] text-[#9E988F] hover:bg-[#EFEAE0] hover:text-[#6E6A64] transition-colors"
              title="重置"
            >
              <RotateCcw size={18} />
            </button>
            <button
              onClick={() => setIsPomodoroRunning(!isPomodoroRunning)}
              className="p-4 rounded-full text-white shadow-lg hover:shadow-xl transition-all"
              style={{ backgroundColor: getPhaseColor() }}
            >
              {isPomodoroRunning ? <Pause size={24} /> : <Play size={24} />}
            </button>
            <button
              onClick={handlePomodoroSkip}
              className="p-3 rounded-full bg-[#F3EEE6] text-[#9E988F] hover:bg-[#EFEAE0] hover:text-[#6E6A64] transition-colors"
              title="跳过"
            >
              <SkipForward size={18} />
            </button>
          </div>

          {/* Round Indicator */}
          <div className="flex items-center justify-center gap-1.5">
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
        </div>
      )}

      {/* ===== 自由计时面板 ===== */}
      {mode === 'free' && (
        <div className="min-h-[280px] flex flex-col">
          {/* Clock with time inside */}
          <div className="mb-5 flex justify-center">
            <div className="relative" style={{ width: svgSize, height: svgSize }}>
              <svg className="absolute inset-0" width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
                <circle cx={center} cy={center} r={radius} fill="none" stroke="#EFEAE0" strokeWidth="8" />
                <motion.circle
                  cx={center} cy={center} r={radius} fill="none"
                  stroke={PRIMARY_COLOR} strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={circumference}
                  animate={{ strokeDashoffset: circumference * (1 - freeProgress / 100) }}
                  transition={{ duration: 0.5, ease: 'linear' }}
                  transform={`rotate(-90 ${center} ${center})`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.div
                  key={`free-${Math.floor(freeTimeLeft / 60)}`}
                  initial={{ scale: 0.95, opacity: 0.8 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-3xl font-bold tabular-nums"
                  style={{ color: PRIMARY_COLOR }}
                >
                  {formatTime(freeTimeLeft)}
                </motion.div>
                <p className="text-[10px] text-[#9E988F] mt-0.5">自由计时</p>
              </div>
            </div>
          </div>

          {/* Controls - same as pomodoro */}
          <div className="flex items-center justify-center gap-3 mb-3">
            <button
              onClick={handleFreeReset}
              className="p-3 rounded-full bg-[#F3EEE6] text-[#9E988F] hover:bg-[#EFEAE0] hover:text-[#6E6A64] transition-colors"
              title="重置"
            >
              <RotateCcw size={18} />
            </button>
            <button
              onClick={() => setIsFreeRunning(!isFreeRunning)}
              className="p-4 rounded-full text-white shadow-lg hover:shadow-xl transition-all"
              style={{ backgroundColor: PRIMARY_COLOR }}
            >
              {isFreeRunning ? <Pause size={24} /> : <Play size={24} />}
            </button>
          </div>

          {/* Preset Buttons + Custom */}
          {!isFreeRunning && (
            <div className="flex flex-wrap justify-center items-center gap-1.5 mt-2">
              {FREE_PRESETS.map(minutes => (
                <button
                  key={minutes}
                  onClick={() => {
                    setFreeDuration(minutes * 60);
                    setFreeTimeLeft(minutes * 60);
                    setFreeMinutesInput(String(minutes));
                  }}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-medium transition-all',
                    FREE_PRESETS.includes(Math.round(freeDuration / 60)) && freeDuration === minutes * 60
                      ? 'bg-[#5D7052] text-white shadow-sm'
                      : 'bg-[#F3EEE6] text-[#9E988F] hover:bg-[#EFEAE0]'
                  )}
                >
                  {minutes}分钟
                </button>
              ))}
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={freeMinutesInput}
                  onChange={handleFreeMinutesChange}
                  onBlur={applyFreeMinutes}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                  className={cn(
                    'w-16 text-center text-xs font-medium rounded-lg px-2 py-1 border-none outline-none transition-all',
                    FREE_PRESETS.includes(Math.round(freeDuration / 60))
                      ? 'text-[#2C2A29] bg-[#F3EEE6] focus:ring-1 focus:ring-[#8FA67F]'
                      : 'text-white bg-[#5D7052] shadow-sm'
                  )}
                />
                <span className="text-xs text-[#9E988F]">分钟</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
