'use client';

import type { ReactNode } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}
