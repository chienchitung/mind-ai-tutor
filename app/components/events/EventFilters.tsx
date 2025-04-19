'use client';

import React, { useState } from "react";
import { useEvents } from "@/contexts/EventContext";
import { Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/app/contexts/LanguageContext";
import { useTranslation } from "@/utils/translations";

export function EventFilters() {
  const { activeFilters, setFilterText, setFilterStatus, setFilterPriority, setFilterType } = useEvents();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [searchText, setSearchText] = useState(activeFilters.text || "");
  
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchText(value);
    if (setFilterText) setFilterText(value);
  };
  
  const clearSearch = () => {
    setSearchText("");
    if (setFilterText) setFilterText("");
  };
  
  const handleStatusFilter = (value: string) => {
    if (setFilterStatus) setFilterStatus(value === "all" ? "" : value);
  };
  
  const handlePriorityFilter = (value: string) => {
    if (setFilterPriority) setFilterPriority(value === "all" ? "" : value);
  };
  
  const handleTypeFilter = (value: string) => {
    if (setFilterType) setFilterType(value === "all" ? "" : value);
  };
  
  return (
    <div className="flex items-center space-x-2 mb-4">
      <div className="relative flex-1">
        <Input 
          placeholder={t('search_events')}
          value={searchText}
          onChange={handleSearch}
        />
        {searchText && (
          <button
            onClick={clearSearch}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            &times;
          </button>
        )}
      </div>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-9">
            <Filter className="mr-2 h-4 w-4" />
            <span>{t('filters')}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>{t('select_status')}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={activeFilters.status || "all"}
            onValueChange={handleStatusFilter}
          >
            <DropdownMenuRadioItem value="all">
              {t('all')}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="to_do">
              {t('to_do')}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="in_progress">
              {t('in_progress')}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="done">
              {t('done')}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuLabel>{t('select_priority')}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={activeFilters.priority || "all"}
            onValueChange={handlePriorityFilter}
          >
            <DropdownMenuRadioItem value="all">
              {t('all')}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="high">
              {t('high')}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="medium">
              {t('medium')}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="low">
              {t('low')}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuLabel>{t('select_type')}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={activeFilters.type || "all"}
            onValueChange={handleTypeFilter}
          >
            <DropdownMenuRadioItem value="all">
              {t('all')}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="course">
              {t('course')}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="workshop">
              {t('workshop')}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="meeting">
              {t('meeting')}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="training">
              {t('training')}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="planning">
              {t('planning')}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="other">
              {t('other')}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
} 