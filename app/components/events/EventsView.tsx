'use client';

import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { KanbanView } from "./views/KanbanView";
import { TableView } from "./views/TableView";
import { TimelineView } from "./views/TimelineView";
import { EventsHeader } from "./EventsHeader";
import { EventFormDialog } from "./EventFormDialog";
import { EventProvider, useEvents } from "@/contexts/EventContext";
import { CalendarView } from "./views/CalendarView";

export function EventsView() {
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  const ViewContent = () => {
    const { activeView } = useEvents();
    
    const renderView = () => {
      switch (activeView) {
        case "list":
          return <TableView />;
        case "kanban":
          return <KanbanView />;
        case "table":
          return <TableView />;
        case "calendar":
          return <CalendarView />;
        case "timeline":
          return <TimelineView />;
        default:
          return <TableView />;
      }
    };

    return (
      <div className="space-y-6">
        <EventsHeader onAddEvent={() => setShowEventForm(true)} />
        
        <Card className="bg-background border shadow-sm">
          <div className="p-4 md:p-6">
            {renderView()}
          </div>
        </Card>
        
        {showEventForm && (
          <EventFormDialog 
            open={showEventForm} 
            onOpenChange={setShowEventForm} 
            initialEvent={editingEvent}
            mode={editingEvent ? "edit" : "create"}
          />
        )}
      </div>
    );
  };

  return (
    <EventProvider>
      <ViewContent />
    </EventProvider>
  );
} 