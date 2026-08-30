'use client';

import type { ReactNode } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';

export default function AiQuizLayout({ children }: { children: ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}
