'use client';

import React, { useState, forwardRef, useRef } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { DateRange } from 'react-day-picker';
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from 'date-fns';
import { cn } from "@/lib/utils";
import "./date-picker.css"; // We'll create this file next

export interface ModernDateRangePickerProps {
  value: DateRange | undefined;
  onChange: (value: DateRange | undefined) => void;
  placeholder?: string;
  className?: string;
  align?: "start" | "center" | "end";
}

export function ModernDateRangePicker({
  value,
  onChange,
  placeholder = "Select date range",
  className,
}: ModernDateRangePickerProps) {
  const [startDate, setStartDate] = useState<Date | null>(value?.from || null);
  const [endDate, setEndDate] = useState<Date | null>(value?.to || null);
  const [isOpen, setIsOpen] = useState(false);
  // For temporary storage of dates before applying
  const [tempStartDate, setTempStartDate] = useState<Date | null>(value?.from || null);
  const [tempEndDate, setTempEndDate] = useState<Date | null>(value?.to || null);

  // Create a ref for the DatePicker component
  const datePickerRef = useRef<any>(null);

  // Update local state when props change
  React.useEffect(() => {
    setStartDate(value?.from || null);
    setEndDate(value?.to || null);
    setTempStartDate(value?.from || null);
    setTempEndDate(value?.to || null);
  }, [value]);

  // Custom input component
  const CustomInput = forwardRef<HTMLButtonElement, { value?: string; onClick?: () => void }>(
    ({ value, onClick }, ref) => (
      <Button
        variant="outline"
        onClick={onClick}
        ref={ref}
        className={cn(
          "w-full justify-start text-left font-normal",
          !value && "text-muted-foreground"
        )}
      >
        <CalendarIcon className="mr-2 h-4 w-4" />
        {value || placeholder}
      </Button>
    )
  );

  CustomInput.displayName = "CustomDatePickerInput";

  // Handle temporary date changes
  const handleTempDateChange = (dates: [Date | null, Date | null]) => {
    const [start, end] = dates;
    setTempStartDate(start);
    setTempEndDate(end);
  };

  // Apply the date changes
  const handleApply = () => {
    setStartDate(tempStartDate);
    setEndDate(tempEndDate);
    
    if (tempStartDate) {
      onChange({
        from: tempStartDate,
        to: tempEndDate || undefined
      });
    } else {
      onChange(undefined);
    }
    
    // Close the date picker programmatically
    if (datePickerRef.current) {
      datePickerRef.current.setOpen(false);
    }
    setIsOpen(false);
  };

  // Cancel date selection
  const handleCancel = () => {
    // Restore original values when canceling
    setTempStartDate(startDate);
    setTempEndDate(endDate);
    
    // Close the date picker programmatically
    if (datePickerRef.current) {
      datePickerRef.current.setOpen(false);
    }
    setIsOpen(false);
  };

  // Format the displayed date range
  const formatDateRange = () => {
    if (!startDate) return "";
    
    if (endDate) {
      return `${format(startDate, 'MMM dd, yyyy')} - ${format(endDate, 'MMM dd, yyyy')}`;
    }
    
    return format(startDate, 'MMM dd, yyyy');
  };

  // Get day class names based on selection state
  const getDayClassNames = (date: Date) => {
    // Check if date is the same day (by day, month and year)
    const isSameDay = (d1: Date | null, d2: Date) => {
      if (!d1) return false;
      return (
        d1.getDate() === d2.getDate() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getFullYear() === d2.getFullYear()
      );
    };
    
    // Check if date is within the range
    const isInRange = tempStartDate && tempEndDate && 
      isSameDay(tempStartDate, date) || isSameDay(tempEndDate, date) || 
      (tempStartDate && tempEndDate && 
        date > new Date(new Date(tempStartDate).setHours(0,0,0,0)) && 
        date < new Date(new Date(tempEndDate).setHours(23,59,59,999)));
    
    // Check if date is the start date
    const isStartDate = isSameDay(tempStartDate, date);
    
    // Check if date is the end date
    const isEndDate = isSameDay(tempEndDate, date);
    
    // For single-day selection
    const isSingleDay = isStartDate && isEndDate && tempStartDate && tempEndDate && 
      tempStartDate.getTime() === tempEndDate.getTime();

    // Construct the appropriate class name
    if (isSingleDay) {
      return "selected-day single-day";
    } else if (isStartDate) {
      return "selected-day start-day";
    } else if (isEndDate) {
      return "selected-day end-day";
    } else if (isInRange) {
      return "in-range-day";
    }
    
    return "";
  };

  // Custom render of the calendar with buttons
  const renderCalendarContainer = ({ children }: any) => {
    return (
      <div className="date-picker-container">
        <div className="date-picker-calendar">
          {children}
        </div>
        <div className="date-picker-footer">
          <div className="date-picker-buttons">
            <Button 
              variant="outline"
              onClick={handleCancel}
              className="date-picker-cancel-button"
              type="button"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleApply}
              className="date-picker-apply-button"
              type="button"
            >
              Apply
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={className}>
      <DatePicker
        ref={datePickerRef}
        selected={tempStartDate}
        onChange={handleTempDateChange}
        startDate={tempStartDate}
        endDate={tempEndDate}
        selectsRange
        monthsShown={2}
        openToDate={startDate || undefined}
        customInput={<CustomInput value={formatDateRange()} />}
        showPopperArrow={false}
        calendarClassName="custom-datepicker"
        wrapperClassName="w-full"
        popperClassName="z-50"
        onCalendarOpen={() => setIsOpen(true)}
        onCalendarClose={() => setIsOpen(false)}
        dateFormat="MMM d, yyyy"
        showMonthDropdown={false}
        showYearDropdown={false}
        open={isOpen}
        onClickOutside={() => setIsOpen(false)}
        dayClassName={getDayClassNames}
        renderCustomHeader={({ decreaseMonth, increaseMonth, prevMonthButtonDisabled, nextMonthButtonDisabled, monthDate, customHeaderCount }) => {
          // Only show prev button for first month and next button for second month
          const isFirstMonth = customHeaderCount === 0;
          const isSecondMonth = customHeaderCount === 1;
          
          return (
            <div className="custom-header-container">
              {isFirstMonth && (
                <button 
                  onClick={decreaseMonth} 
                  disabled={prevMonthButtonDisabled}
                  className="custom-prev-button"
                  type="button"
                >
                  {"<"}
                </button>
              )}
              {!isFirstMonth && <div className="w-8"></div>}
              
              <div className="custom-month-year">
                {format(monthDate, "MMMM yyyy")}
              </div>
              
              {isSecondMonth && (
                <button 
                  onClick={increaseMonth} 
                  disabled={nextMonthButtonDisabled}
                  className="custom-next-button"
                  type="button"
                >
                  {">"}
                </button>
              )}
              {!isSecondMonth && <div className="w-8"></div>}
            </div>
          );
        }}
        shouldCloseOnSelect={false}
        calendarContainer={renderCalendarContainer}
      />
    </div>
  );
} 