'use client';

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface StudentFiltersProps {
  selectedTab: "all" | "active";
  setSelectedTab: (tab: "all" | "active") => void;
}

export function StudentFilters({ selectedTab, setSelectedTab }: StudentFiltersProps) {
  return (
    <div className="flex items-center pb-4">
      <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as "all" | "active")}>
        <TabsList>
          <TabsTrigger value="all">All Students</TabsTrigger>
          <TabsTrigger value="active">Active Students</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
} 