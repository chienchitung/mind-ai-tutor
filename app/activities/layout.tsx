import { Metadata } from "next";
import type { ReactNode } from "react";
import ClientLayout from "./client-layout";

export const metadata: Metadata = {
  title: "Activities",
  description: "View and manage student activities.",
};

interface LayoutProps {
  children: ReactNode;
}

export default function ActivitiesLayout({ children }: LayoutProps) {
  return <ClientLayout>{children}</ClientLayout>;
} 