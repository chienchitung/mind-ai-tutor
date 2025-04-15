'use client';

import React, { useState, useEffect } from "react";
import { useEvents, Event, EventType } from "@/contexts/EventContext";
import { format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface EventFormDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialEvent?: Event | null;
  mode?: 'create' | 'edit';
  trigger?: React.ReactNode;
}

export function EventFormDialog({ open, onOpenChange, initialEvent, mode = 'create', trigger }: EventFormDialogProps) {
  const { addEvent, updateEvent } = useEvents();
  const isEditing = mode === 'edit';
  const [sheetOpen, setSheetOpen] = useState(open || false);
  
  // Use the controlled or uncontrolled state
  const handleOpenChange = (newOpen: boolean) => {
    if (onOpenChange) {
      onOpenChange(newOpen);
    } else {
      setSheetOpen(newOpen);
    }
  };

  // Form state
  const [formData, setFormData] = useState<Partial<Event>>({
    title: "",
    description: "",
    type: "meeting" as EventType,
    status: "to_do",
    priority: "medium",
    position: 0,
    startDate: new Date().toISOString(),
    endDate: new Date().toISOString(),
    tags: []
  });
  
  // Update form state when editing an event
  useEffect(() => {
    if (initialEvent) {
      setFormData({
        ...initialEvent
      });
    }
  }, [initialEvent]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string) => (value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (isEditing && initialEvent) {
        await updateEvent({
          ...initialEvent,
          ...formData
        });
      } else {
        const newEvent: Event = {
          id: crypto.randomUUID(),
          title: formData.title || "",
          description: formData.description || "",
          type: formData.type as EventType,
          status: formData.status as any,
          priority: formData.priority as any,
          position: formData.position || 0,
          startDate: formData.startDate || new Date().toISOString(),
          endDate: formData.endDate || new Date().toISOString(),
          tags: formData.tags || [],
          attachments: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        // Convert the Event object to the format expected by addEvent
        addEvent({
          title: newEvent.title,
          description: newEvent.description,
          type: newEvent.type,
          status: newEvent.status,
          priority: newEvent.priority,
          position: newEvent.position,
          startDate: newEvent.startDate,
          endDate: newEvent.endDate,
          tagIds: newEvent.tags.map(tag => tag.id)
        });
      }
      handleOpenChange(false);
    } catch (error) {
      console.error("Error saving event:", error);
    }
  };
  
  const sheetContent = (
    <SheetContent className="w-full sm:max-w-md overflow-y-auto">
      <SheetHeader>
        <SheetTitle>{isEditing ? "Edit Event" : "Add New Event"}</SheetTitle>
      </SheetHeader>
      
      <ScrollArea className="h-[calc(100vh-8rem)] py-4">
        <form onSubmit={handleSubmit} className="space-y-6 px-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Event title"
                required
                className="w-full border border-input rounded-md"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea 
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Event description" 
                rows={3}
                className="w-full border border-input rounded-md"
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={handleSelectChange("type")}
                >
                  <SelectTrigger className="w-full border border-input rounded-md">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="course">Course</SelectItem>
                      <SelectItem value="workshop">Workshop</SelectItem>
                      <SelectItem value="training">Training</SelectItem>
                      <SelectItem value="planning">Planning</SelectItem>
                      <SelectItem value="meeting">Meeting</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={handleSelectChange("status")}
                >
                  <SelectTrigger className="w-full border border-input rounded-md">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="to_do">To Do</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={handleSelectChange("priority")}
              >
                <SelectTrigger className="w-full border border-input rounded-md">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <div className="relative">
                  <Input
                    id="startDate"
                    name="startDate"
                    type="date"
                    value={formData.startDate ? format(new Date(formData.startDate), "yyyy-MM-dd") : ""}
                    onChange={handleInputChange}
                    className="w-full border border-input rounded-md"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <div className="relative">
                  <Input
                    id="endDate"
                    name="endDate"
                    type="date"
                    value={formData.endDate ? format(new Date(formData.endDate), "yyyy-MM-dd") : ""}
                    onChange={handleInputChange}
                    className="w-full border border-input rounded-md"
                  />
                </div>
              </div>
            </div>
          </div>
          
          <SheetFooter className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 px-0">
            <SheetClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </SheetClose>
            <Button type="submit" variant="default">
              {isEditing ? "Save Changes" : "Add Event"}
            </Button>
          </SheetFooter>
        </form>
      </ScrollArea>
    </SheetContent>
  );
  
  // If a trigger is provided, use it with SheetTrigger
  if (trigger) {
    return (
      <Sheet open={open !== undefined ? open : sheetOpen} onOpenChange={handleOpenChange}>
        <SheetTrigger asChild>
          {trigger}
        </SheetTrigger>
        {sheetContent}
      </Sheet>
    );
  }
  
  // Otherwise, just return the sheet with controlled/uncontrolled state
  return (
    <Sheet open={open !== undefined ? open : sheetOpen} onOpenChange={handleOpenChange}>
      {sheetContent}
    </Sheet>
  );
} 