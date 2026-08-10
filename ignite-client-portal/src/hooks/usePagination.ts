import { useState, useEffect, useCallback } from 'react';

interface UsePaginationOptions {
  totalCount: number;
  pageSize?: number;
  /** Change this value to reset to page 1 (e.g. pass sort key or filter key). */
  resetKey?: unknown;
}

export interface UsePaginationReturn {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  offset: number;
  goToPage: (n: number) => void;
  nextPage: () => void;
  prevPage: () => void;
}

export function usePagination({
  totalCount,
  pageSize = 50,
  resetKey,
}: UsePaginationOptions): UsePaginationReturn {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Reset to page 1 whenever resetKey changes (e.g. sort or filter changed).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setCurrentPage(1); }, [resetKey]);

  // Clamp currentPage if totalPages shrinks below it.
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1);
  }, [totalPages, currentPage]);

  const goToPage = useCallback(
    (n: number) => setCurrentPage(Math.max(1, Math.min(n, totalPages))),
    [totalPages],
  );

  const nextPage = useCallback(
    () => setCurrentPage((p) => Math.min(p + 1, totalPages)),
    [totalPages],
  );

  const prevPage = useCallback(
    () => setCurrentPage((p) => Math.max(p - 1, 1)),
    [],
  );

  const offset = (currentPage - 1) * pageSize;

  return { currentPage, totalPages, pageSize, offset, goToPage, nextPage, prevPage };
}
