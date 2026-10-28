/**
 * Utility functions for table pagination and navigation
 * Follows Clean Code & Strict TypeScript standards
 */

export interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
}

/**
 * Computes safe pagination boundaries and indices
 */
export function computePagination(
  totalItems: number,
  page: number,
  pageSize: number
): PaginationState {
  const safePageSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * safePageSize;
  const endIndex = Math.min(startIndex + safePageSize, totalItems);

  return {
    currentPage,
    pageSize: safePageSize,
    totalItems,
    totalPages,
    startIndex,
    endIndex,
  };
}

/**
 * Slices an array according to the specified page and page size
 */
export function paginateList<T>(
  items: T[],
  page: number,
  pageSize: number
): { paginatedItems: T[]; pagination: PaginationState } {
  const pagination = computePagination(items.length, page, pageSize);
  const paginatedItems = items.length === 0 ? [] : items.slice(pagination.startIndex, pagination.endIndex);
  return { paginatedItems, pagination };
}

/**
 * Generates an array of page numbers with ellipsis for pagination controls
 * Example for 10 pages when on page 5: [1, '...', 4, 5, 6, '...', 10]
 */
export function generatePageNumbers(currentPage: number, totalPages: number): (number | string)[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | string)[] = [1];

  if (currentPage > 3) {
    pages.push('...');
  }

  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (currentPage < totalPages - 2) {
    pages.push('...');
  }

  pages.push(totalPages);
  return pages;
}
