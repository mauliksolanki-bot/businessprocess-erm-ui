"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DataTablePaginationProps {
  page: number;           // 0-based
  size: number;
  totalElements: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onSizeChange: (size: number) => void;
  className?: string;
}

const PAGE_SIZES = [25, 50, 100];

export function DataTablePagination({
  page,
  size,
  totalElements,
  totalPages,
  onPageChange,
  onSizeChange,
  className,
}: DataTablePaginationProps) {
  const from = totalElements === 0 ? 0 : page * size + 1;
  const to = Math.min(page * size + size, totalElements);

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-50/60 px-4 py-3 sm:flex-row",
        className
      )}
    >
      {/* Rows info + page size */}
      <div className="flex items-center gap-3 text-sm text-zinc-600">
        <span>
          {totalElements === 0
            ? "No records"
            : `Showing ${from}–${to} of ${totalElements.toLocaleString()} records`}
        </span>
        <span className="hidden text-zinc-300 sm:inline">|</span>
        <div className="flex items-center gap-1.5">
          <label className="hidden text-xs text-zinc-500 sm:inline" htmlFor="page-size-select">
            Rows per page:
          </label>
          <select
            id="page-size-select"
            value={size}
            onChange={(e) => {
              onSizeChange(Number(e.target.value));
            }}
            className="h-8 rounded-lg border border-zinc-300 bg-white px-2 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Page navigation */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 rounded-lg p-0 border-zinc-300 disabled:opacity-40"
          onClick={() => onPageChange(0)}
          disabled={page === 0}
          aria-label="First page"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 rounded-lg p-0 border-zinc-300 disabled:opacity-40"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 0}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-1 px-1">
          {getPageNumbers(page, totalPages).map((p, idx) =>
            p === "..." ? (
              <span key={`ellipsis-${idx}`} className="px-1 text-xs text-zinc-400">
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p as number)}
                className={cn(
                  "flex h-8 min-w-[2rem] items-center justify-center rounded-lg px-2 text-xs font-medium transition-colors",
                  p === page
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm"
                    : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
                )}
              >
                {(p as number) + 1}
              </button>
            )
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 rounded-lg p-0 border-zinc-300 disabled:opacity-40"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages - 1}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 rounded-lg p-0 border-zinc-300 disabled:opacity-40"
          onClick={() => onPageChange(totalPages - 1)}
          disabled={page >= totalPages - 1}
          aria-label="Last page"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i);
  }
  const pages: (number | "...")[] = [];
  if (current <= 3) {
    pages.push(0, 1, 2, 3, 4, "...", total - 1);
  } else if (current >= total - 4) {
    pages.push(0, "...", total - 5, total - 4, total - 3, total - 2, total - 1);
  } else {
    pages.push(0, "...", current - 1, current, current + 1, "...", total - 1);
  }
  return pages;
}
