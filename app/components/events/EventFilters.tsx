'use client';

import React, { useState } from "react";
import { Search, Filter, Check } from "lucide-react";
import { useEvents } from "@/contexts/EventContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem
} from "@/components/ui/dropdown-menu";

export function EventFilters() {
  const { activeFilters, setActiveFilters } = useEvents();
  const [searchValue, setSearchValue] = useState("");

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
    
    // Debounced search
    const handler = setTimeout(() => {
      setActiveFilters({ ...activeFilters, search: e.target.value });
    }, 300);
    
    return () => clearTimeout(handler);
  };

  const handleStatusFilter = (value: string) => {
    setActiveFilters({ ...activeFilters, status: value });
  };

  const handlePriorityFilter = (value: string) => {
    setActiveFilters({ ...activeFilters, priority: value });
  };

  const handleTypeFilter = (value: string) => {
    setActiveFilters({ ...activeFilters, type: value });
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search events..."
          className="pl-8 h-9 md:w-[200px] lg:w-[280px]"
          value={searchValue}
          onChange={handleSearch}
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-9">
            <Filter className="mr-2 h-4 w-4" />
            <span>Filter</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={activeFilters.status || "all"}
            onValueChange={handleStatusFilter}
          >
            <DropdownMenuRadioItem value="all">
              All
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="to_do">
              To Do
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="in_progress">
              In Progress
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="done">
              Done
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuLabel>Filter by Priority</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={activeFilters.priority || "all"}
            onValueChange={handlePriorityFilter}
          >
            <DropdownMenuRadioItem value="all">
              All
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="high">
              High
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="medium">
              Medium
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="low">
              Low
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuLabel>Filter by Type</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={activeFilters.type || "all"}
            onValueChange={handleTypeFilter}
          >
            <DropdownMenuRadioItem value="all">
              All
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="course">
              Course
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="workshop">
              Workshop
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="meeting">
              Meeting
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="training">
              Training
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="planning">
              Planning
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="other">
              Other
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
} 