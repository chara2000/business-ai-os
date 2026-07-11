import { useEffect, useMemo, useState } from 'react';

export interface ClientPaginationState {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function useClientPagination<T>(
  items: T[],
  pageSize = 10,
  resetDeps: unknown[] = [],
) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, resetDeps);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const paginated = useMemo(
    () => items.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [items, currentPage, pageSize],
  );

  const pagination: ClientPaginationState = {
    currentPage,
    totalPages,
    totalItems: items.length,
    pageSize,
    onPageChange: setPage,
  };

  return { paginated, pagination, setPage, currentPage, totalPages };
}
