"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, type CustomComponents } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "relative flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-3",
        month_caption:
          "flex justify-center items-center pb-3 mb-2 border-b border-border/60",
        caption_label: "text-sm font-semibold tracking-tight",
        nav: "absolute inset-x-0 top-0 flex items-center justify-between",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "h-8 w-8 rounded-full bg-transparent p-0 text-muted-foreground border-border/60 transition-colors hover:bg-accent hover:text-foreground hover:border-border absolute left-0"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "h-8 w-8 rounded-full bg-transparent p-0 text-muted-foreground border-border/60 transition-colors hover:bg-accent hover:text-foreground hover:border-border absolute right-0"
        ),
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex",
        weekday:
          "text-muted-foreground rounded-md w-9 font-medium text-[0.7rem] uppercase tracking-wider",
        week: "flex w-full mt-2",
        // react-day-picker puts the selected/today/outside/range_middle
        // modifier classes on this cell (a <td>), not on the day_button
        // inside it - and the ghost button variant sets its own explicit
        // text-foreground, which shadows whatever color this cell would
        // otherwise pass down by inheritance. So each state below is
        // pushed onto the button via the cell's own data attribute
        // (data-selected/data-today/data-outside, set by react-day-picker)
        // or, for range_middle - which gets no data attribute, only a
        // plain class - via that class name directly.
        day: cn(
          "relative h-9 w-9 p-0 text-center text-sm first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
          "[&[data-selected=true]>button]:bg-primary [&[data-selected=true]>button]:text-primary-foreground [&[data-selected=true]>button]:hover:bg-primary [&[data-selected=true]>button]:hover:text-primary-foreground [&[data-selected=true]>button]:focus:bg-primary [&[data-selected=true]>button]:focus:text-primary-foreground",
          // A ring rather than a filled background, since a fill reads the
          // same as the ghost button's own hover state (bg-accent) and
          // "today" would only be visible while the mouse isn't over it.
          // Suppressed once the day is also selected - the selected fill
          // already marks it clearly enough without a competing outline.
          "[&[data-today=true]:not([data-selected=true])>button]:border [&[data-today=true]:not([data-selected=true])>button]:border-primary/50 [&[data-today=true]:not([data-selected=true])>button]:text-primary [&[data-today=true]:not([data-selected=true])>button]:font-semibold",
          "[&[data-outside=true]>button]:text-muted-foreground [&[data-outside=true]>button]:opacity-50",
          "[&.day-range-middle>button]:bg-accent [&.day-range-middle>button]:text-accent-foreground"
        ),
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal"
        ),
        range_middle: "day-range-middle",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClassName, ...chevronProps }) =>
          orientation === "left" ? (
            <ChevronLeft className={cn("h-4 w-4", chevronClassName)} {...chevronProps} />
          ) : (
            <ChevronRight className={cn("h-4 w-4", chevronClassName)} {...chevronProps} />
          ),
      } as Partial<CustomComponents>}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }