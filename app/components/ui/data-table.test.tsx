// @vitest-environment jsdom
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ColumnDef } from '@tanstack/react-table';
import { LanguageProvider } from '@/app/contexts/LanguageContext';
import { DataTable, type DataTableFeatures } from './data-table';

afterEach(() => {
  cleanup();
});

type Person = { name: string; age: number };

const people: Person[] = [
  { name: 'Charlie', age: 25 },
  { name: 'Alice', age: 40 },
  { name: 'Bob', age: 30 },
];

const columns: ColumnDef<DataTableFeatures, Person>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'age', header: 'Age' },
];

function renderTable(props: Partial<ComponentProps<typeof DataTable<Person>>> = {}) {
  return render(
    <LanguageProvider>
      <DataTable columns={columns} data={people} {...props} />
    </LanguageProvider>,
  );
}

describe('DataTable', () => {
  it('renders every row and cell value', () => {
    renderTable();

    for (const person of people) {
      expect(screen.getByText(person.name)).toBeTruthy();
      expect(screen.getByText(String(person.age))).toBeTruthy();
    }
  });

  it('filters rows via the search column', () => {
    renderTable({ searchColumn: 'name' });

    fireEvent.change(screen.getByPlaceholderText('Search...'), {
      target: { value: 'ali' },
    });

    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.queryByText('Bob')).toBeNull();
    expect(screen.queryByText('Charlie')).toBeNull();
  });

  it('sorts rows when a sortable header is clicked', () => {
    renderTable();

    const getNameCells = () =>
      screen.getAllByRole('row').slice(1).map((row) => row.querySelectorAll('td')[0]?.textContent);

    expect(getNameCells()).toEqual(['Charlie', 'Alice', 'Bob']);

    fireEvent.click(screen.getByRole('button', { name: 'Name' }));
    expect(getNameCells()).toEqual(['Alice', 'Bob', 'Charlie']);

    fireEvent.click(screen.getByRole('button', { name: 'Name' }));
    expect(getNameCells()).toEqual(['Charlie', 'Bob', 'Alice']);
  });

  it('shows the empty message when there is no data', () => {
    renderTable({ data: [], emptyMessage: 'Nothing here' });
    expect(screen.getByText('Nothing here')).toBeTruthy();
  });
});
