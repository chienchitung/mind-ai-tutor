import { Metadata } from "next";
import type { ReactNode } from "react";
import ClientLayout from "./client-layout";

export const metadata: Metadata = {
  title: "Feedback",
  description: "View and manage student feedback.",
};

interface LayoutProps {
  children: ReactNode;
}

export default function FeedbackLayout({ children }: LayoutProps) {
  return <ClientLayout>{children}</ClientLayout>;
} 