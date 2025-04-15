'use client';

import type { ReactNode } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';

export type ClientLayoutProps = {
  children: ReactNode;
};

const ClientLayout = ({ children }: ClientLayoutProps): JSX.Element => {
  return <AppLayout>{children}</AppLayout>;
};

export default ClientLayout; 