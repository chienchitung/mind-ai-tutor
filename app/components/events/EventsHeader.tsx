'use client';

import React from "react";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { ViewSelector } from "./ViewSelector";

interface EventsHeaderProps {
  onAddEvent: () => void;
}

export function EventsHeader({ onAddEvent }: EventsHeaderProps) {
  return (
    <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between w-full">
      <ViewSelector />

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={onAddEvent} className="h-8">
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Event
        </Button>
      </div>
    </div>
  );
} 