import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/utils/utils";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/components/i18n/i18n-provider";
import { LocaleSyncEffect } from "@/components/i18n/locale-sync-effect";
import { getServerLocale } from "@/lib/i18n/server-preference";
import { StoreInitializer } from "@/components/layout/StoreInitializer";
import { LayoutShell } from "@/components/layout/layout-shell";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const SITE_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : undefined;

export const metadata: Metadata = {
  title: "LearnFlow — AI 学习规划工作流",
  description: "用 AI 把任何学习目标拆解成每日可执行任务，配合笔记和 Notion 同步管理知识体系。",
  ...(SITE_URL && { metadataBase: new URL(SITE_URL) }),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2C3328",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getServerLocale();
  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={cn("antialiased bg-[#FAF7F2]", geist.variable)}
        style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
      >
        <I18nProvider>
          <LocaleSyncEffect />
          <StoreInitializer />
          <LayoutShell>{children}</LayoutShell>
          <Toaster />
        </I18nProvider>
      </body>
    </html>
  );
}
