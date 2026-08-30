"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTranslation } from "@/utils/translations";
import { useLanguage } from "@/app/contexts/LanguageContext";

export interface DateRangePickerProps {
  value: DateRange | undefined;
  onChange: (value: DateRange | undefined) => void;
  placeholder?: string;
  className?: string;
  align?: "start" | "center" | "end";
  dateFormat?: string;
}

export function DateRangePicker({
  value,
  onChange,
  placeholder,
  className,
  align = "start",
  dateFormat = "MMM dd, yyyy",
}: DateRangePickerProps) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [isOpen, setIsOpen] = React.useState(false);
  const [tempDateRange, setTempDateRange] = React.useState<DateRange | undefined>(value);
  const [currentMonth, setCurrentMonth] = React.useState<Date | undefined>(
    value?.from ? new Date(value.from) : new Date()
  );

  // Update internal state when external value changes
  React.useEffect(() => {
    setTempDateRange(value);
  }, [value]);

  // Use localized placeholder if not provided
  const localizedPlaceholder = placeholder || 'Select date range';

  // Format date using the provided format or default
  const formatDate = (date: Date) => {
    return format(date, dateFormat);
  };

  // Handle month navigation
  const handlePreviousMonth = () => {
    if (currentMonth) {
      const previousMonth = new Date(currentMonth);
      previousMonth.setMonth(previousMonth.getMonth() - 1);
      setCurrentMonth(previousMonth);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth) {
      const nextMonth = new Date(currentMonth);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      setCurrentMonth(nextMonth);
    }
  };

  // Calculate next month for display
  const nextMonthDate = React.useMemo(() => {
    if (!currentMonth) return new Date();
    return new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1);
  }, [currentMonth]);

  // Handle applying the date range
  const handleApply = () => {
    onChange(tempDateRange);
    setIsOpen(false);
  };

  // Handle clearing the date range
  const handleClear = () => {
    setTempDateRange(undefined);
  };

  // Reset temp state when popover opens
  React.useEffect(() => {
    if (isOpen) {
      setTempDateRange(value);
    }
  }, [isOpen, value]);

  // Override localization - force English interface
  const localizedClear = "Clear";
  const localizedApply = "Apply";
  const localizedPrevMonth = "Previous month";
  const localizedNextMonth = "Next month";

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full h-10 justify-start text-left font-normal border border-input bg-background",
              !value && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value?.from ? (
              value.to ? (
                <>
                  {formatDate(value.from)} - {formatDate(value.to)}
                </>
              ) : (
                formatDate(value.from)
              )
            ) : (
              <span>{localizedPlaceholder}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-auto p-0 border rounded-lg shadow-md" 
          align={align}
          sideOffset={4}
        >
          <div className="p-0">
            <div className="flex justify-between items-center p-4 border-b">
              <button 
                onClick={handlePreviousMonth} 
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
                type="button"
                aria-label={localizedPrevMonth}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              
              <div className="flex flex-1 justify-between gap-4">
                <div className="flex-1 text-center font-medium text-sm sm:text-base">{format(currentMonth || new Date(), "MMMM yyyy")}</div>
                <div className="flex-1 text-center font-medium text-sm sm:text-base">{format(nextMonthDate, "MMMM yyyy")}</div>
              </div>
              
              <button 
                onClick={handleNextMonth} 
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
                type="button"
                aria-label={localizedNextMonth}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={value?.from}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              selected={tempDateRange}
              onSelect={setTempDateRange}
              numberOfMonths={2}
              className="border-none"
              showOutsideDays={true}
              modifiers={{
                range: tempDateRange && {
                  from: tempDateRange.from,
                  to: tempDateRange.to,
                },
                start: tempDateRange?.from,
                end: tempDateRange?.to,
              }}
              modifiersClassNames={{
                start: "!bg-black !text-white !font-semibold !rounded-md hover:!bg-black",
                end: "!bg-black !text-white !font-semibold !rounded-md hover:!bg-black",
                range: "!bg-gray-100 !text-gray-900 hover:!bg-gray-200",
                middle: "!bg-gray-100 !text-gray-900",
              }}
              classNames={{
                months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                month: "space-y-4 w-full sm:w-auto",
                caption: "hidden", // Hide all month captions as we have custom header
                nav: "hidden",
                nav_button: "hidden",
                nav_button_previous: "hidden",
                nav_button_next: "hidden",
                table: "w-full border-collapse",
                head_row: "flex border-b pb-2 mb-2",
                head_cell: "text-gray-500 font-medium w-9 sm:w-10 text-xs sm:text-sm flex items-center justify-center",
                row: "flex w-full mt-2",
                cell: "relative p-0 text-center",
                day: cn(
                  "h-9 w-9 sm:h-10 sm:w-10 p-0 font-normal aria-selected:opacity-100 rounded-none transition-none hover:bg-gray-100 focus:z-20"
                ),
                day_range_start: "rounded-md focus:!bg-black focus:!text-white",
                day_range_end: "rounded-md focus:!bg-black focus:!text-white",
                day_selected: "bg-black text-white hover:!bg-black rounded-md",
                day_today: "bg-gray-100 font-semibold",
                day_outside: "!text-gray-300",
                day_disabled: "text-muted-foreground opacity-50",
                day_range_middle: "bg-gray-100 text-gray-900 hover:bg-gray-200",
                day_hidden: "invisible",
              }}
              styles={{
                day: {
                  margin: 0,
                },
                caption: {
                  display: 'none'
                }
              }}
              modifiersStyles={{
                outside: {
                  color: '#d1d5db'
                }
              }}
              onDayClick={(day) => {
                // Provide immediate visual feedback while state updates
                const clickedElement = document.activeElement;
                if (clickedElement instanceof HTMLElement) {
                  // Add a quick flash of color
                  const originalBg = clickedElement.style.backgroundColor;
                  clickedElement.style.backgroundColor = "#000000";
                  clickedElement.style.color = "white";
                  
                  // Reset after a very short delay
                  setTimeout(() => {
                    clickedElement.style.backgroundColor = originalBg;
                    clickedElement.style.color = "";
                  }, 50);
                }
              }}
              formatters={{
                formatCaption: () => "" // Empty string to remove month captions completely
              }}
            />
            
            <div className="flex items-center justify-end gap-2 p-4 border-t">
              <Button
                variant="outline"
                onClick={handleClear}
                className="h-10 px-4 rounded-lg"
                type="button"
              >
                {localizedClear}
              </Button>
              <Button
                onClick={handleApply}
                className="h-10 px-6 rounded-lg bg-black hover:bg-gray-800 text-white transition-colors"
                type="button"
              >
                {localizedApply}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
