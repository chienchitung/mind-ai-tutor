import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { PageLayout } from "@/components/layout/PageLayout";
import { Providers } from "@/components/providers";
import { Toaster } from '@/components/ui/toaster';
import { LanguageProvider } from "@/contexts/LanguageContext";

const inter = Inter({ subsets: ["latin"] });

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
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <LanguageProvider>
          <Providers>
            {children}
            <Toaster />
          </Providers>
        </LanguageProvider>
      </body>
    </html>
  );
} 