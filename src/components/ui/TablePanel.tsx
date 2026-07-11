'use client';

import { cn } from '@/lib/utils';
import { TablePagination } from '@/components/ui/TablePagination';
import type { ClientPaginationState } from '@/lib/hooks/useClientPagination';

interface TablePanelProps {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
  pagination?: ClientPaginationState;
}

export function TablePanel({ children, className, padded = true, pagination }: TablePanelProps) {
  return (
    <div className={cn('table-panel', className)}>
      <div className={cn('table-panel__scroll', padded && 'table-panel__scroll--padded')}>
        {children}
      </div>
      {pagination && <TablePagination {...pagination} />}
    </div>
  );
}
