import { ReactNode } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';

export default function DigitalGamesLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
} 