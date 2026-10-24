"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SegmentedOption<T extends string | number> = {
  value: T;
  label: ReactNode;
  /** Accessible name when `label` is not plain text (e.g. a count badge). */
  ariaLabel?: string;
};

// A row of mutually exclusive choices with no hidden menu. Used instead of a
// native <select> for short option lists, whose platform arrow sits wherever
// the browser puts it and never lines up with the rest of the toolbar.
export function SegmentedControl<T extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  size = "sm",
  className,
}: {
  label: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const select = (index: number) => {
    const option = options[index];
    if (!option) return;
    refs.current[index]?.focus();
    if (option.value !== value) onChange(option.value);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    select((index + step + options.length) % options.length);
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={cn("inline-flex max-w-full rounded-lg border bg-muted/60 p-0.5", className)}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={String(option.value)}
            ref={(node) => { refs.current[index] = node; }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.ariaLabel}
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            onClick={() => select(index)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "inline-flex min-w-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              size === "sm" ? "h-8 text-xs" : "h-9 text-sm",
              selected
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
