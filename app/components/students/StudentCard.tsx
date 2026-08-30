'use client';

import { Card, CardContent } from "@/components/ui/card";

interface StudentCardProps {
  title: string;
  count: number;
}

export function StudentCard({ title, count }: StudentCardProps) {
  return (
    <Card className="shadow-none">
      <CardContent className="p-4 md:p-5">
        <div className="text-3xl font-semibold tracking-tight">{count}</div>
        <div className="mt-1 text-sm font-medium text-muted-foreground">{title}</div>
      </CardContent>
    </Card>
  );
}
