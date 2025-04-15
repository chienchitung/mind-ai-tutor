'use client';

import { AppLayout } from '@/components/layout/AppLayout';

export default function StudentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
} 