'use client';

import { PageHeader } from '@/components/layout/PageHeader';
import { EventsView } from '@/components/events/EventsView';
import { AppLayout } from '@/components/layout/AppLayout';

export default function EventsPage() {
  return (
    <AppLayout>
      <div className="space-y-4">
        <PageHeader
          heading="Events"
          text="Manage and track all scheduled events"
        />
        <EventsView />
      </div>
    </AppLayout>
  );
} 