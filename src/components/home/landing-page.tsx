"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Compass,
  Calendar,
  BookOpen,
  Rss,
  ArrowRight,
  Sparkles,
  Brain,
  Clock,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const FEATURES = [
  {
    icon: Compass,
    title: "知识树规划",
    desc: "AI 驱动，将学习目标拆解为结构化知识树，让复杂领域变得清晰可控",
    accent: "#8FA67F",
  },
  {
    icon: Calendar,
    title: "智能日历排期",
    desc: "根据每日可用时间与节奏，自动生成可执行的个性化日程计划",
    accent: "#C8834A",
  },
  {
    icon: BookOpen,
    title: "笔记与复习",
    desc: "边学边记，基于艾宾浩斯遗忘曲线的间隔复习巩固长期记忆",
    accent: "#7B8E6E",
  },
  {
    icon: Rss,
    title: "RSS 知识订阅",
    desc: "汇聚优质信息源，持续拓展知识边界，打通知识管理闭环",
    accent: "#B07A4B",
  },
] as const;

const SELLING_POINTS = [
  { icon: Sparkles, label: "AI 驱动" },
  { icon: Brain, label: "学习闭环" },
  { icon: Clock, label: "个性化定制" },
] as const;

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay, ease: [0.25, 0.46, 0.45, 0.94] as const },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

/* ------------------------------------------------------------------ */
/*  Decorative background                                              */
/* ------------------------------------------------------------------ */

function BackgroundDecor() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Large warm gradient orb — top right */}
      <motion.div
        className="absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full opacity-30"
        style={{
          background:
            "radial-gradient(circle, rgba(143,166,127,0.45) 0%, rgba(200,131,74,0.18) 50%, transparent 70%)",
        }}
        animate={{ scale: [1, 1.08, 1], opacity: [0.25, 0.35, 0.25] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Secondary orb — bottom left */}
      <motion.div
        className="absolute -bottom-32 -left-32 h-[500px] w-[500px] rounded-full opacity-25"
        style={{
          background:
            "radial-gradient(circle, rgba(200,131,74,0.35) 0%, rgba(143,166,127,0.15) 50%, transparent 70%)",
        }}
        animate={{ scale: [1, 1.06, 1], opacity: [0.2, 0.3, 0.2] }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2,
        }}
      />
      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(#2C2A29 1px, transparent 1px), linear-gradient(90deg, #2C2A29 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      {/* Floating particles */}
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute h-2 w-2 rounded-full"
          style={{
            background: i % 2 === 0 ? "#8FA67F" : "#C8834A",
            top: `${20 + i * 15}%`,
            left: `${10 + i * 18}%`,
          }}
          animate={{
            y: [0, -20, 0],
            opacity: [0.15, 0.35, 0.15],
          }}
          transition={{
            duration: 4 + i * 1.2,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.6,
          }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Feature card                                                       */
/* ------------------------------------------------------------------ */

function FeatureCard({
  icon: Icon,
  title,
  desc,
  accent,
  index,
}: {
  icon: React.ComponentType<{ className?: string; size?: number; color?: string }>;
  title: string;
  desc: string;
  accent: string;
  index: number;
}) {
  return (
    <motion.article
      custom={1.2 + index * 0.15}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      whileHover={{ y: -6, transition: { duration: 0.25 } }}
      className="group relative flex flex-col rounded-2xl border border-[#E8E2D9] bg-white/60 p-6 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md"
    >
      {/* Icon container */}
      <div
        className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl transition-transform group-hover:scale-110"
        style={{ backgroundColor: `${accent}18` }}
      >
        <Icon className="h-6 w-6" color={accent} />
      </div>
      <h3
        className="mb-2 text-lg font-semibold"
        style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
      >
        {title}
      </h3>
      <p className="text-sm leading-relaxed text-[#6E6A64]">{desc}</p>
      {/* Bottom accent line */}
      <motion.div
        className="absolute bottom-0 left-6 right-6 h-[2px] rounded-full origin-left"
        style={{ backgroundColor: accent }}
        initial={{ scaleX: 0 }}
        whileHover={{ scaleX: 1 }}
        transition={{ duration: 0.3 }}
      />
    </motion.article>
  );
}

/* ------------------------------------------------------------------ */
/*  Main landing page                                                  */
/* ------------------------------------------------------------------ */

export function LandingPage() {
  const router = useRouter();
  const [exiting, setExiting] = useState(false);

  const handleEnter = useCallback(() => {
    setExiting(true);
    setTimeout(() => {
      router.push("/planning");
    }, 700);
  }, [router]);

  return (
    <AnimatePresence mode="wait">
      {exiting ? (
        /* ---------- Exit overlay ---------- */
        <motion.div
          key="exit"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#FAF7F2]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            className="flex flex-col items-center gap-3"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, duration: 0.35 }}
          >
            <motion.div
              className="h-10 w-10 rounded-full border-2 border-[#8FA67F] border-t-transparent"
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
            />
            <span
              className="text-sm text-[#6E6A64]"
              style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
            >
              正在进入系统…
            </span>
          </motion.div>
        </motion.div>
      ) : (
        /* ---------- Landing content ---------- */
        <motion.div
          key="landing"
          className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-5 py-16"
          exit={{ opacity: 0, y: -60 }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] as const }}
        >
          <BackgroundDecor />

          <div className="relative z-10 flex w-full max-w-4xl flex-col items-center gap-10">
            {/* --- Selling point pills --- */}
            <motion.div
              className="flex flex-wrap items-center justify-center gap-3"
              custom={0.15}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
            >
              {SELLING_POINTS.map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#8FA67F]/20 bg-[#8FA67F]/8 px-3.5 py-1.5 text-xs font-medium text-[#5C6E50]"
                >
                  <Icon size={13} />
                  {label}
                </span>
              ))}
            </motion.div>

            {/* --- Hero text --- */}
            <motion.div
              className="flex flex-col items-center gap-5 text-center"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              <motion.h1
                custom={0.3}
                variants={fadeUp}
                className="text-4xl font-bold tracking-tight text-[#2C2A29] sm:text-5xl md:text-6xl"
                style={{
                  fontFamily: '"Cinzel", Georgia, serif',
                  lineHeight: 1.15,
                }}
              >
                Welcome to
                <br />
                <span className="bg-gradient-to-r from-[#8FA67F] via-[#7B8E6E] to-[#C8834A] bg-clip-text text-transparent">
                  Learn Flow System
                </span>
              </motion.h1>

              <motion.p
                custom={0.6}
                variants={fadeUp}
                className="max-w-xl text-base leading-relaxed text-[#6E6A64] sm:text-lg"
              >
                为终身学习者打造的 AI 学习规划工作流
                <br className="hidden sm:block" />
                从知识输入到规划、执行、复习，形成完整学习闭环
              </motion.p>

              <motion.p
                custom={0.75}
                variants={fadeUp}
                className="max-w-md text-sm leading-relaxed text-[#9E988F]"
              >
                让学习像流水一样自然推进——AI 智能拆解目标，个性化定制计划，
                配合间隔复习巩固记忆，助你高效掌握任何领域
              </motion.p>
            </motion.div>

            {/* --- Feature cards --- */}
            <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f, i) => (
                <FeatureCard key={f.title} {...f} index={i} />
              ))}
            </div>

            {/* --- CTA button --- */}
            <motion.div custom={1.9} variants={fadeUp} initial="hidden" animate="visible">
              <motion.button
                onClick={handleEnter}
                className="group relative inline-flex items-center gap-2.5 overflow-hidden rounded-full bg-[#2C3328] px-8 py-3.5 text-sm font-medium text-[#FAF7F2] shadow-lg shadow-[#2C3328]/20"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                {/* Hover gradient sweep */}
                <motion.span
                  className="absolute inset-0 bg-gradient-to-r from-[#8FA67F]/30 to-[#C8834A]/30"
                  initial={{ x: "-100%" }}
                  whileHover={{ x: "0%" }}
                  transition={{ duration: 0.4 }}
                />
                <span className="relative">进入系统</span>
                <ArrowRight
                  className="relative h-4 w-4 transition-transform group-hover:translate-x-1"
                  size={16}
                />
              </motion.button>
            </motion.div>

            {/* --- Footer hint --- */}
            <motion.p
              custom={2.2}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="text-xs text-[#9E988F]"
            >
              AI 驱动 · 个性化定制 · 知识管理闭环
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
