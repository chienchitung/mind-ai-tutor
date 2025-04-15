'use client';

import { Card, CardContent } from "@/components/ui/card";

interface StudentCardProps {
  title: string;
  count: number;
}

export function StudentCard({ title, count }: StudentCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="text-2xl font-bold">{count}</div>
        <div className="text-sm font-medium text-muted-foreground">{title}</div>
      </CardContent>
    </Card>
  );
} 