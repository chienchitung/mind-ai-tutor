'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { usesAppShell } from '@/lib/app-shell';
import { AppLayout } from './AppLayout';

export function PersistentAppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (!usesAppShell(pathname)) return children;

  return <AppLayout>{children}</AppLayout>;
}
