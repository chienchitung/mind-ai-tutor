'use client';

import { motion } from 'framer-motion';
import { usePathname } from 'next/navigation';

interface PageTransitionProps {
  children: React.ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();

  return (
    <motion.div
      key={pathname}
      // Opacity only: sliding every page up 8px on each sidebar click made
      // the whole content area visibly jump. A short fade still marks the
      // page change without moving anything.
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        duration: 0.12,
        ease: 'easeOut',
      }}
    >
      {children}
    </motion.div>
  );
}
