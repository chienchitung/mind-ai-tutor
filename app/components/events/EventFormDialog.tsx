'use client';

import React, { useState, useEffect } from "react";
import { useEvents, Event, EventType } from "@/contexts/EventContext";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/app/contexts/LanguageContext";
import { useTranslation } from "@/utils/translations";

interface EventFormDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialEvent?: Event | null;
  mode?: 'create' | 'edit';
  trigger?: React.ReactNode;
}

export function EventFormDialog({ open, onOpenChange, initialEvent, mode = 'create', trigger }: EventFormDialogProps) {
  const { addEvent, updateEvent } = useEvents();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const isEditing = mode === 'edit';
  const [dialogOpen, setDialogOpen] = useState(open || false);

  // Use the controlled or uncontrolled state. Radix's Dialog already handles
  // its own open/close animation timing internally - no manual delay needed.
  const handleOpenChange = (newOpen: boolean) => {
    if (onOpenChange) {
      onOpenChange(newOpen);
    } else {
      setDialogOpen(newOpen);
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

  const dialogContent = (
    <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{isEditing ? t('edit_event') : t('add_new_event')}</DialogTitle>
        <DialogDescription>
          {isEditing ? t('edit_event_description') : t('add_event_description')}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="title">{t('title')}</Label>
          <Input
            id="title"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            placeholder={t('event_title')}
            required
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">{t('description')}</Label>
          <Textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder={t('event_description')}
            rows={3}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="type">{t('type')}</Label>
            <Select
              value={formData.type}
              onValueChange={handleSelectChange("type")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('select_type')} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="course">{t('course')}</SelectItem>
                  <SelectItem value="workshop">{t('workshop')}</SelectItem>
                  <SelectItem value="training">{t('training')}</SelectItem>
                  <SelectItem value="planning">{t('planning')}</SelectItem>
                  <SelectItem value="meeting">{t('meeting')}</SelectItem>
                  <SelectItem value="other">{t('other')}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">{t('status')}</Label>
            <Select
              value={formData.status}
              onValueChange={handleSelectChange("status")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('select_status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="to_do">{t('to_do')}</SelectItem>
                  <SelectItem value="in_progress">{t('in_progress')}</SelectItem>
                  <SelectItem value="done">{t('done')}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">{t('priority')}</Label>
            <Select
              value={formData.priority}
              onValueChange={handleSelectChange("priority")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('select_priority')} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="low">{t('low')}</SelectItem>
                  <SelectItem value="medium">{t('medium')}</SelectItem>
                  <SelectItem value="high">{t('high')}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startDate">{t('start_date')}</Label>
            <Input
              id="startDate"
              name="startDate"
              type="date"
              value={formData.startDate ? format(new Date(formData.startDate), "yyyy-MM-dd") : ""}
              onChange={handleInputChange}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="endDate">{t('end_date')}</Label>
            <Input
              id="endDate"
              name="endDate"
              type="date"
              value={formData.endDate ? format(new Date(formData.endDate), "yyyy-MM-dd") : ""}
              onChange={handleInputChange}
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {t('cancel')}
            </Button>
          </DialogClose>
          <Button type="submit" variant="default">
            {isEditing ? t('save_changes') : t('add_event')}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );

  // If a trigger is provided, use it with DialogTrigger
  if (trigger) {
    return (
      <Dialog open={open !== undefined ? open : dialogOpen} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
        {dialogContent}
      </Dialog>
    );
  }

  // Otherwise, just return the dialog with controlled/uncontrolled state
  return (
    <Dialog open={open !== undefined ? open : dialogOpen} onOpenChange={handleOpenChange}>
      {dialogContent}
    </Dialog>
  );
}
