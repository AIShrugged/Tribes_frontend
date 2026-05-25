'use client';

import clsx from 'clsx';

import { InfiniteScrollStatus } from '@/shared/ui/layout/infinite-scroll-status';
import SpinLoader from '@/shared/ui/layout/spin-loader';

import type { TableColumn } from './types';
import type React from 'react';

interface DataTableProps<T> {
  columns: TableColumn<T>[];
  items: T[];
  keyExtractor: (row: T) => string | number;

  // Infinite scroll — all three required together when infinite scroll is used
  isLoading?: boolean;
  hasMore?: boolean;
  sentinelRef?: React.RefObject<HTMLDivElement | null>;

  // Row behaviour
  onRowClick?: (row: T) => void;
  getRowClassName?: (row: T) => string;

  // Mobile fallback — if omitted, table renders without md: breakpoint prefix
  renderMobileCard?: (row: T) => React.ReactNode;

  // Accessibility — required for WCAG compliance
  caption: string;
  captionSrOnly?: boolean;

  // Empty state — shown when items.length === 0 and !isLoading
  emptyState?: React.ReactNode;

  // Layout
  tableMinWidth?: string;
  tableFixed?: boolean;
  className?: string;
}

/**
 * DataTable — generic responsive data table with optional infinite scroll.
 * Columns are defined via TableColumn<T>[] with typed renderCell functions.
 * Mobile card fallback is provided via the renderMobileCard render prop.
 */
export function DataTable<T>({
  columns,
  items,
  keyExtractor,
  isLoading,
  hasMore,
  sentinelRef,
  onRowClick,
  getRowClassName,
  renderMobileCard,
  caption,
  captionSrOnly,
  emptyState,
  tableMinWidth,
  tableFixed,
  className,
}: DataTableProps<T>) {
  const showEmpty =
    !isLoading && items.length === 0 && emptyState !== undefined;

  return (
    <>
      {/* Mobile card list — display:none on md+ removes from accessibility tree */}
      {renderMobileCard && (
        <div className='flex flex-col gap-3 md:hidden'>
          {items.map((row) => {
            return <div key={keyExtractor(row)}>{renderMobileCard(row)}</div>;
          })}
          {items.length === 0 && !isLoading && emptyState}
          {isLoading && (
            <div className='flex justify-center py-4'>
              <SpinLoader />
            </div>
          )}
          {hasMore && sentinelRef && (
            <div ref={sentinelRef} className='h-2' aria-hidden='true' />
          )}
          {!hasMore && items.length > 0 && (
            <InfiniteScrollStatus itemCount={items.length} />
          )}
        </div>
      )}

      {/* Desktop table — hidden below md when mobile cards are provided */}
      <div
        className={clsx(
          'overflow-x-auto',
          renderMobileCard && 'hidden md:block',
          className,
        )}
      >
        {/* sr-only live region for load state announcements */}
        <div
          role='status'
          aria-live='polite'
          aria-atomic='true'
          className='sr-only'
        >
          {isLoading ? 'Loading data…' : ''}
        </div>

        {showEmpty ? (
          emptyState
        ) : (
          <table
            className={clsx(
              'w-full text-sm',
              tableFixed && 'table-fixed',
              tableMinWidth,
            )}
            aria-rowcount={hasMore ? -1 : items.length}
          >
            <caption className={clsx(captionSrOnly && 'sr-only')}>
              {caption}
            </caption>

            <thead className='bg-[var(--surface-2)] text-left text-[var(--muted-foreground)]'>
              <tr>
                {columns.map((col) => {
                  return (
                    <th
                      key={col.id}
                      scope='col'
                      className='px-[var(--sp-5)] py-[var(--sp-4)] text-[length:var(--fs-xs)] font-medium uppercase tracking-[0.04em]'
                    >
                      {col.header}
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {items.map((row, rowIndex) => {
                return (
                  <tr
                    key={keyExtractor(row)}
                    aria-rowindex={rowIndex + 1}
                    className={clsx(
                      'border-b border-[var(--border)] align-top text-[var(--foreground)]',
                      onRowClick &&
                        'cursor-pointer hover:bg-[var(--surface-2)]',
                      getRowClassName?.(row),
                    )}
                    onClick={
                      onRowClick
                        ? () => {
                            return onRowClick(row);
                          }
                        : undefined
                    }
                    onKeyDown={
                      onRowClick
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ')
                              onRowClick(row);
                          }
                        : undefined
                    }
                    tabIndex={onRowClick ? 0 : undefined}
                    role={onRowClick ? 'button' : undefined}
                  >
                    {columns.map((col) => {
                      return (
                        <td
                          key={col.id}
                          className={clsx(
                            'px-[var(--sp-5)] py-[var(--sp-4)]',
                            col.cellClassName,
                          )}
                        >
                          {col.renderCell(row)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Desktop loading / sentinel */}
        {isLoading && (
          <div className='flex justify-center py-4'>
            <SpinLoader />
          </div>
        )}
        {!hasMore && items.length > 0 && (
          <div className='py-4'>
            <InfiniteScrollStatus itemCount={items.length} />
          </div>
        )}
        {hasMore && sentinelRef && (
          <div ref={sentinelRef} className='h-10' aria-hidden='true' />
        )}
      </div>
    </>
  );
}
