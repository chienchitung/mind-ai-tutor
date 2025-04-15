'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';

export default function ResetEventsPage() {
  const router = useRouter();

  const handleReset = () => {
    localStorage.removeItem('events');
    router.push('/events');
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader 
          heading="Reset Events Data" 
          text="This will reset all events to their default state" 
        />
        
        <div className="bg-white p-6 border rounded-md shadow-sm">
          <p className="mb-4">
            This action will reset all your events to their initial state. Any changes you've made, including dragging cards or adding new events, will be lost.
          </p>
          <Button variant="destructive" onClick={handleReset}>
            Reset Events Data
          </Button>
        </div>
      </div>
    </AppLayout>
  );
} 