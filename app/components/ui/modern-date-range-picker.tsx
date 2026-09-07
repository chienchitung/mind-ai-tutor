'use client';

import React, { useState, useEffect, forwardRef, useRef } from 'react';
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

  // Anchors which month react-datepicker's left-hand pane shows (the
  // right-hand pane always follows one month ahead). react-datepicker
  // internally re-anchors both panes to whichever day was just clicked -
  // fine for a single month, but with two months shown it means clicking an
  // end date in the right-hand pane slides the whole view forward a month,
  // hiding the start month the user just picked. Bumping remountKey forces
  // a fresh DatePicker instance (which re-reads openToDate) to correct that.
  const [viewAnchor, setViewAnchor] = useState<Date>(value?.from || new Date());
  const [remountKey, setRemountKey] = useState(0);

  // Create a ref for the DatePicker component
  const datePickerRef = useRef<any>(null);

  // Show a single month on narrow viewports so the two-month calendar
  // doesn't overflow small screens. Starts at false (matching SSR) and
  // updates on mount/resize to avoid a hydration mismatch.
  const [isNarrowViewport, setIsNarrowViewport] = useState(false);
  useEffect(() => {
    const updateViewport = () => setIsNarrowViewport(window.innerWidth < 640);
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);
  const monthsShown = isNarrowViewport ? 1 : 2;

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
    const wasCompletingRange = tempEndDate === null && end !== null;
    setTempStartDate(start);
    setTempEndDate(end);

    if (wasCompletingRange && start) {
      // The end date was just picked, possibly in a later pane than the
      // start date - react-datepicker re-anchors the whole two-month view
      // to whichever day was just clicked, which would otherwise slide the
      // start month out of view. Snap the view back to the start month.
      setViewAnchor(start);
      setRemountKey((k) => k + 1);
    }
    // A start-date click (first click, or restarting after a completed
    // range) is left alone: react-datepicker already brings the clicked
    // month into the first pane on its own, which is the behavior we want.
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
        key={remountKey}
        ref={datePickerRef}
        selected={tempStartDate}
        onChange={handleTempDateChange}
        startDate={tempStartDate}
        endDate={tempEndDate}
        selectsRange
        monthsShown={monthsShown}
        openToDate={viewAnchor}
        customInput={<CustomInput value={formatDateRange()} />}
        showPopperArrow={false}
        // Without an explicit placement, react-datepicker's floating-ui
        // positioning defaults to "bottom" (centered on the trigger), which
        // centers a wide two-month calendar over a much narrower trigger
        // button and pushes half of it off-screen to the left. Left-aligning
        // it to the trigger keeps it on-screen on both desktop and mobile.
        popperPlacement="bottom-start"
        calendarClassName="custom-datepicker"
        wrapperClassName="w-full"
        popperClassName="z-50"
        onCalendarOpen={() => {
          setIsOpen(true);
          setViewAnchor(tempStartDate || startDate || new Date());
          setRemountKey((k) => k + 1);
        }}
        onCalendarClose={() => setIsOpen(false)}
        dateFormat="MMM d, yyyy"
        showMonthDropdown={false}
        showYearDropdown={false}
        open={isOpen}
        onClickOutside={() => setIsOpen(false)}
        dayClassName={getDayClassNames}
        renderCustomHeader={({ decreaseMonth, increaseMonth, prevMonthButtonDisabled, nextMonthButtonDisabled, monthDate, customHeaderCount }) => {
          // Only show the prev button on the leftmost month and the next
          // button on the rightmost one, so scrolling advances the whole
          // window rather than each month independently. Derived from
          // monthsShown rather than hardcoded indices so this still works
          // when only one month is shown on narrow viewports.
          const isFirstMonth = customHeaderCount === 0;
          const isLastMonth = customHeaderCount === monthsShown - 1;

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

              {isLastMonth && (
                <button
                  onClick={increaseMonth}
                  disabled={nextMonthButtonDisabled}
                  className="custom-next-button"
                  type="button"
                >
                  {">"}
                </button>
              )}
              {!isLastMonth && <div className="w-8"></div>}
            </div>
          );
        }}
        shouldCloseOnSelect={false}
        calendarContainer={renderCalendarContainer}
      />
    </div>
  );
} 