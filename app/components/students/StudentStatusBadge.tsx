'use client';

import { Badge } from "@/components/ui/badge";

interface StudentStatusBadgeProps {
  progress: number;
}

export function StudentStatusBadge({ progress }: StudentStatusBadgeProps) {
  let status = '';
  let variant: 'default' | 'destructive' | 'outline' | 'secondary' = 'default';
  let className = '';

  if (progress === 0) {
    status = 'Not Started';
    variant = 'outline';
    className = 'bg-muted text-muted-foreground';
  } else if (progress === 100) {
    status = 'Completed';
    variant = 'outline';
    className = 'bg-green-50 text-green-700 border-green-200';
  } else if (progress > 0) {
    status = 'In Progress';
    variant = 'outline';
    className = 'bg-amber-50 text-amber-700 border-amber-200';
  }

  return (
    <Badge variant={variant} className={className}>
      {status}
    </Badge>
  );
} 