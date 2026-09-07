// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ModernDateRangePicker } from './modern-date-range-picker';

beforeAll(() => {
  // react-datepicker's floating-ui positioning uses ResizeObserver, which
  // jsdom doesn't implement.
  if (!('ResizeObserver' in globalThis)) {
    (globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

afterEach(() => {
  cleanup();
});

function openPicker() {
  fireEvent.click(screen.getByRole('button', { name: /select date range/i }));
}

function getMonthTitles(container: HTMLElement) {
  return Array.from(container.querySelectorAll('.custom-month-year')).map((el) => el.textContent);
}

// paneIndex 0 = the left/first visible month, 1 = the right/second one.
function clickDay(container: HTMLElement, day: string, paneIndex: number) {
  const panes = container.querySelectorAll('.react-datepicker__month-container');
  const pane = panes[paneIndex];
  const match = Array.from(pane.querySelectorAll('.react-datepicker__day')).find(
    (el) => el.textContent === day && !el.classList.contains('react-datepicker__day--outside-month')
  );
  if (!match) throw new Error(`day ${day} not found in pane ${paneIndex}`);
  fireEvent.click(match);
}

describe('ModernDateRangePicker', () => {
  it('shows the placeholder when no range is selected', () => {
    render(<ModernDateRangePicker value={undefined} onChange={vi.fn()} placeholder="Pick a range" />);
    expect(screen.getByRole('button', { name: /pick a range/i })).toBeTruthy();
  });

  it('keeps the start month visible when the end date is picked in the second pane', () => {
    const { container } = render(<ModernDateRangePicker value={undefined} onChange={vi.fn()} />);
    openPicker();

    const [firstMonth, secondMonth] = getMonthTitles(container);
    expect(firstMonth).toBeTruthy();
    expect(secondMonth).toBeTruthy();

    // Pick a start day in the first (left) pane - should not move anything.
    clickDay(container, '14', 0);
    expect(getMonthTitles(container)).toEqual([firstMonth, secondMonth]);

    // Pick an end day in the second (right) pane - this used to slide the
    // whole two-month view forward a month, hiding the start month.
    clickDay(container, '19', 1);
    expect(getMonthTitles(container)).toEqual([firstMonth, secondMonth]);
  });

  it('commits the selected range on Apply and reopens anchored to the start month', () => {
    const onChange = vi.fn();
    const { container } = render(<ModernDateRangePicker value={undefined} onChange={onChange} />);
    openPicker();

    const [firstMonth] = getMonthTitles(container);
    clickDay(container, '14', 0);
    clickDay(container, '19', 1);
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const [range] = onChange.mock.calls[0];
    expect(range.from.getDate()).toBe(14);
    expect(range.to.getDate()).toBe(19);

    // Reopening should anchor back to the committed start month, not
    // wherever the calendar was left after the last click.
    fireEvent.click(screen.getByRole('button', { name: /14.*-.*19/ }));
    expect(getMonthTitles(container)[0]).toBe(firstMonth);
  });

  it('discards in-progress selection on Cancel', () => {
    const onChange = vi.fn();
    const { container } = render(<ModernDateRangePicker value={undefined} onChange={onChange} />);
    openPicker();
    clickDay(container, '14', 0);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /select date range/i })).toBeTruthy();
  });
});
