'use client';

import React from "react";
import { useEvents } from "@/contexts/EventContext";
import { LayoutList, KanbanSquare, Table2, CalendarDays, GanttChartSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ViewSelector() {
  const { activeView, setActiveView } = useEvents();
  
  return (
    <div className="flex items-center space-x-1">
      <Button
        variant={activeView === 'table' ? 'default' : 'ghost'}
        size="sm"
        className="h-8 px-2"
        onClick={() => setActiveView('table')}
        aria-label="Table View"
      >
        <Table2 className="h-4 w-4 mr-1" />
        <span>Table</span>
      </Button>
      
      <Button
        variant={activeView === 'kanban' ? 'default' : 'ghost'}
        size="sm"
        className="h-8 px-2"
        onClick={() => setActiveView('kanban')}
        aria-label="Kanban View"
      >
        <KanbanSquare className="h-4 w-4 mr-1" />
        <span>Kanban</span>
      </Button>
      
      <Button
        variant={activeView === 'calendar' ? 'default' : 'ghost'}
        size="sm"
        className="h-8 px-2"
        onClick={() => setActiveView('calendar')}
        aria-label="Calendar View"
      >
        <CalendarDays className="h-4 w-4 mr-1" />
        <span>Calendar</span>
      </Button>
      
      <Button
        variant={activeView === 'timeline' ? 'default' : 'ghost'}
        size="sm"
        className="h-8 px-2"
        onClick={() => setActiveView('timeline')}
        aria-label="Timeline View"
      >
        <GanttChartSquare className="h-4 w-4 mr-1" />
        <span>Timeline</span>
      </Button>
    </div>
  );
} 