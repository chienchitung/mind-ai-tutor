'use client';

import React, { useState, useEffect } from "react";
import { useEvents } from "@/contexts/EventContext";
import { Check, Filter, Search, Tag, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function EventsFilter() {
  const { 
    tags = [],
    filterText, 
    setFilterText,
    selectedTags, 
    setSelectedTags,
    filterPriority, 
    setFilterPriority,
    filterStatus, 
    setFilterStatus,
    filterType, 
    setFilterType 
  } = useEvents();
  
  // Local state to manage UI elements
  const [localFilterText, setLocalFilterText] = useState(filterText || "");
  const [tagsOpen, setTagsOpen] = useState(false);
  const [localSelectedTags, setLocalSelectedTags] = useState<string[]>(selectedTags || []);
  
  // Update context when local state changes
  useEffect(() => {
    if (setFilterText) {
      setFilterText(localFilterText);
    }
  }, [localFilterText, setFilterText]);
  
  useEffect(() => {
    if (setSelectedTags) {
      setSelectedTags(localSelectedTags);
    }
  }, [localSelectedTags, setSelectedTags]);

  // Handle search input
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalFilterText(e.target.value);
  };

  // Clear all filters
  const clearFilters = () => {
    setLocalFilterText("");
    setLocalSelectedTags([]);
    
    if (setFilterText) setFilterText("");
    if (setSelectedTags) setSelectedTags([]);
    if (setFilterPriority) setFilterPriority("");
    if (setFilterStatus) setFilterStatus("");
    if (setFilterType) setFilterType("");
  };

  // Check if any filter is active
  const hasActiveFilters = 
    localFilterText || 
    (localSelectedTags && localSelectedTags.length > 0) || 
    filterPriority || 
    filterStatus || 
    filterType;

  // Options for dropdown filters
  const statusOptions = [
    { value: "", label: "All Statuses" },
    { value: "to_do", label: "To Do" },
    { value: "in_progress", label: "In Progress" },
    { value: "done", label: "Done" },
  ];

  const priorityOptions = [
    { value: "", label: "All Priorities" },
    { value: "high", label: "High" },
    { value: "medium", label: "Medium" },
    { value: "low", label: "Low" },
  ];

  const typeOptions = [
    { value: "", label: "All Types" },
    { value: "course", label: "Course" },
    { value: "workshop", label: "Workshop" },
    { value: "meeting", label: "Meeting" },
    { value: "planning", label: "Planning" },
    { value: "training", label: "Training" },
    { value: "other", label: "Other" },
  ];

  return (
    <div className="flex flex-wrap gap-2 mb-4 items-center">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
        <Input
          placeholder="Search events..."
          value={localFilterText}
          onChange={handleSearchChange}
          className="pl-8"
        />
      </div>

      <Popover open={tagsOpen} onOpenChange={setTagsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1">
            <Tag className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Tags</span>
            {localSelectedTags.length > 0 && (
              <Badge variant="secondary" className="px-1 font-normal">
                {localSelectedTags.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-60 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search tags..." />
            <CommandEmpty>No tags found</CommandEmpty>
            <CommandGroup>
              {tags.map(tag => (
                <CommandItem
                  key={tag.id}
                  onSelect={() => {
                    if (localSelectedTags.includes(tag.id)) {
                      setLocalSelectedTags(localSelectedTags.filter(id => id !== tag.id));
                    } else {
                      setLocalSelectedTags([...localSelectedTags, tag.id]);
                    }
                  }}
                >
                  <div
                    className="mr-2 h-3 w-3 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="flex-1">{tag.name}</span>
                  {localSelectedTags.includes(tag.id) && (
                    <Check className="h-4 w-4" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
      
      {/* Status filter */}
      {setFilterStatus && (
        <Select
          value={filterStatus || ""}
          onValueChange={(value) => setFilterStatus(value)}
        >
          <SelectTrigger className="h-8 w-[130px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Priority filter */}
      {setFilterPriority && (
        <Select
          value={filterPriority || ""}
          onValueChange={(value) => setFilterPriority(value)}
        >
          <SelectTrigger className="h-8 w-[130px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            {priorityOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Filter dropdown for mobile */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 lg:hidden">
            <Filter className="h-3.5 w-3.5" />
            <span className="ml-2">Filters</span>
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-1 px-1 font-normal">
                !
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[200px]">
          <DropdownMenuLabel>Filters</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {/* Type filter for mobile */}
            {setFilterType && (
              <DropdownMenuItem>
                <Select
                  value={filterType || ""}
                  onValueChange={(value) => setFilterType(value)}
                >
                  <SelectTrigger className="h-8 w-full">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {typeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Type filter for desktop */}
      {setFilterType && (
        <div className="hidden lg:block">
          <Select
            value={filterType || ""}
            onValueChange={(value) => setFilterType(value)}
          >
            <SelectTrigger className="h-8 w-[130px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              {typeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={clearFilters}
        >
          <X className="h-4 w-4" />
          <span className="ml-2">Clear Filters</span>
        </Button>
      )}
    </div>
  );
} 