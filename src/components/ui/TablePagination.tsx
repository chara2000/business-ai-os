'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

function getVisiblePages(currentPage: number, totalPages: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const visible: Array<number | string> = [1];
  const left = Math.max(2, currentPage - 1);
  const right = Math.min(totalPages - 1, currentPage + 1);

  if (left > 2) visible.push('…');
  for (let page = left; page <= right; page += 1) {
    visible.push(page);
  }
  if (right < totalPages - 1) visible.push('…');
  visible.push(totalPages);

  return visible;
}

export function TablePagination({ currentPage, totalPages, totalItems, pageSize, onPageChange }: TablePaginationProps) {
  if (totalItems === 0) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);
  const visiblePages = getVisiblePages(currentPage, totalPages);
  const showControls = totalPages > 1;

  return (
    <div className="table-pagination">
      <div className="table-pagination__info">
        Mostrando {startItem}-{endItem} de {totalItems}
      </div>

      {showControls && (
      <div className="table-pagination__controls">
        <button
          type="button"
          className="table-pagination__btn"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
        >
          <ChevronLeft size={14} />
          Anterior
        </button>

        {visiblePages.map((page, index) => {
          if (page === '…') {
            return <span key={`ellipsis-${index}`} className="table-pagination__ellipsis">…</span>;
          }

          const isActive = page === currentPage;
          return (
            <button
              key={page}
              type="button"
              className={`table-pagination__btn table-pagination__btn--number ${isActive ? 'is-active' : ''}`}
              onClick={() => onPageChange(Number(page))}
            >
              {page}
            </button>
          );
        })}

        <button
          type="button"
          className="table-pagination__btn"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
        >
          Siguiente
          <ChevronRight size={14} />
        </button>
      </div>
      )}
    </div>
  );
}
