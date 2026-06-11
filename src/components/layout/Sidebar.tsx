'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Compass, Calendar, RotateCcw, Rss, Key, RefreshCw,
  ChevronLeft, ChevronRight, User, ArrowLeftRight
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { cn } from '@/utils/utils';

const NAV_ITEMS = [
  { href: '/planning', icon: Compass,    label: '学习规划' },
  { href: '/dashboard', icon: Calendar,   label: '每日看板' },
  { href: '/review',    icon: RotateCcw,  label: '复习规划' },
  { href: '/rss',      icon: Rss,        label: 'RSS 订阅' },
  { href: '/token',    icon: Key,        label: 'Token 配置' },
  { href: '/notion',   icon: RefreshCw,  label: 'Notion 同步' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { navCollapsed, setNavCollapsed, config, reviewSessions } = useStore();

  const todayStr = new Date().toISOString().slice(0, 10);
  const pendingReviewCount = reviewSessions.filter(rs =>
    rs.sessions.some(s => s.status === 'pending' && s.date <= todayStr)
  ).length;

  return (
    <motion.aside
      animate={{ width: navCollapsed ? 64 : 200 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className="flex flex-col h-svh bg-[#FDFBF7] border-r border-[#EFEAE0] overflow-hidden flex-shrink-0 relative z-20 animate-in fade-in duration-200"
    >
      {/* Header */}
      <div className={cn(
        "flex items-center border-b border-[#EFEAE0] min-h-[56px] px-3.5 py-3",
        navCollapsed ? "justify-center" : "gap-2.5"
      )}>
        {/* Logo green rounded square */}
        <div className="w-9 h-9 rounded-xl bg-[#8FA67F] flex items-center justify-center flex-shrink-0 text-white font-bold text-lg select-none shadow-sm"
             style={{ fontFamily: 'Cinzel, Georgia, serif' }}>
          L
        </div>
        
        <AnimatePresence>
          {!navCollapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden whitespace-nowrap flex flex-1 items-center justify-between"
            >
              <div className="flex flex-col">
                <span
                  className="text-sm font-bold text-[#2C2A29] leading-none"
                  style={{ fontFamily: 'Cinzel, Georgia, serif' }}
                >
                  LearnFlow
                </span>
                <span className="text-[9px] font-bold text-[#9E988F] tracking-[0.1em] mt-1 select-none">
                  AI WORKSPACE
                </span>
              </div>
              
              <ArrowLeftRight size={14} className="text-[#9E988F] hover:text-[#6E6A64] transition-colors cursor-pointer ml-2" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-3 flex flex-col gap-1.5 px-3 overflow-y-auto">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href);
          const isReview = href === '/review';
          return (
            <Link
              key={href}
              href={href}
              title={navCollapsed ? label : undefined}
              className={cn(
                'flex items-center gap-3 rounded-xl transition-all duration-150 group relative',
                navCollapsed ? 'justify-center px-0 py-3' : 'px-3.5 py-2.5',
                active
                  ? 'bg-[#8FA67F] text-white shadow-sm'
                  : 'text-[#6E6A64] hover:bg-[#F3EEE6] hover:text-[#2C2A29]'
              )}
            >
              <div className="relative">
                <Icon size={18} className="flex-shrink-0" />
                {isReview && pendingReviewCount > 0 && navCollapsed && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#C8834A] border-2 border-[#FDFBF7] rounded-full" />
                )}
              </div>
              <AnimatePresence>
                {!navCollapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.15 }}
                    className="text-sm font-semibold overflow-hidden whitespace-nowrap flex-1"
                  >
                    {label}
                  </motion.span>
                )}
              </AnimatePresence>

              {isReview && pendingReviewCount > 0 && !navCollapsed && (
                <span className="ml-auto bg-[#C8834A] text-white text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[18px] text-center">
                  {pendingReviewCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User info */}
      <div className="border-t border-[#EFEAE0] px-3 py-3 bg-[#FDFBF7]">
        <div className={cn(
          'flex items-center rounded-xl',
          navCollapsed ? 'justify-center py-1' : 'gap-3 px-1 py-1'
        )}>
          <div className="w-9 h-9 rounded-full bg-[#ECE6DA] flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm border border-[#EFEAE0]">
            {config?.userAvatar
              ? <img src={config.userAvatar} className="w-9 h-9 rounded-full object-cover" alt="avatar" />
              : <span className="text-xs font-bold text-[#6E6A64]">LD</span>
            }
          </div>
          <AnimatePresence>
            {!navCollapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden whitespace-nowrap flex-1 min-w-0"
              >
                <p className="text-xs font-bold text-[#2C2A29] truncate">
                  {config?.userName || '学徒小陈'}
                </p>
                <p className="text-[9px] text-[#8FA67F] font-semibold tracking-wide mt-0.5">
                  PRO 会员 · 已激活
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Collapse toggle button at the very bottom */}
      <button
        onClick={() => setNavCollapsed(!navCollapsed)}
        className="w-full flex items-center justify-center py-3 border-t border-[#EFEAE0] text-[#9E988F] hover:text-[#6E6A64] hover:bg-[#F3EEE6] transition-colors cursor-pointer flex-shrink-0"
        title={navCollapsed ? '展开导航栏' : '收起导航栏'}
      >
        {navCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </motion.aside>
  );
}
