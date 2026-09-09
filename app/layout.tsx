import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { LanguageProvider } from "@/app/contexts/LanguageContext";
import { PersistentAppShell } from "@/components/layout/PersistentAppShell";

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
            <PersistentAppShell>{children}</PersistentAppShell>
          </Providers>
        </LanguageProvider>
      </body>
    </html>
  );
}
