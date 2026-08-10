import { useState, createElement, type ReactElement } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

export type SortDirection = 'asc' | 'desc';

interface UseSortOptions {
  defaultColumn: string;
  defaultDirection?: SortDirection;
}

export interface UseSortReturn {
  sortColumn: string;
  sortDirection: SortDirection;
  toggleSort: (column: string) => void;
  SortIcon: (props: { column: string }) => ReactElement;
}

export function useSort({
  defaultColumn,
  defaultDirection = 'desc',
}: UseSortOptions): UseSortReturn {
  const [sortColumn, setSortColumn] = useState(defaultColumn);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultDirection);

  const toggleSort = (column: string) => {
    if (column === sortColumn) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ column }: { column: string }): ReactElement => {
    const cls = 'w-3 h-3 shrink-0';
    if (column !== sortColumn) {
      return createElement(ChevronsUpDown, { className: `${cls} opacity-40` });
    }
    return sortDirection === 'asc'
      ? createElement(ChevronUp, { className: cls })
      : createElement(ChevronDown, { className: cls });
  };

  return { sortColumn, sortDirection, toggleSort, SortIcon };
}
