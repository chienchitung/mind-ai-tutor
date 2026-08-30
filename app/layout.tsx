import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { PageLayout } from "@/components/layout/PageLayout";
import { Providers } from "@/components/providers";
import { LanguageProvider } from "@/app/contexts/LanguageContext";

const inter = Inter({
  subsets: ["latin"],
  fallback: ["Noto Sans TC", "PingFang TC", "Microsoft JhengHei", "sans-serif"],
});

export const metadata: Metadata = {
  title: "MindAiTutor - Student Tracking System",
  description: "AI-powered student tracking and tutoring system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <LanguageProvider>
          <Providers>
            {children}
          </Providers>
        </LanguageProvider>
      </body>
    </html>
  );
}
