'use client';

import type { ReactNode } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}
