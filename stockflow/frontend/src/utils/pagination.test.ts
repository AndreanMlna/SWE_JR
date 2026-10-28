import { describe, it, expect } from 'vitest';
import {
  computePagination,
  paginateList,
  generatePageNumbers,
} from './pagination';

describe('pagination utility tests', () => {
  it('harus menghitung pagination state dengan benar pada data normal', () => {
    // 25 produk, halaman 1, 8 per halaman
    const res = computePagination(25, 1, 8);
    expect(res.totalItems).toBe(25);
    expect(res.totalPages).toBe(4); // ceil(25 / 8) = 4
    expect(res.currentPage).toBe(1);
    expect(res.startIndex).toBe(0);
    expect(res.endIndex).toBe(8);
  });

  it('harus menghitung halaman terakhir dengan batas endIndex yang tepat', () => {
    // Halaman ke-4 dari 25 produk (sisa 1 item: index 24 s.d. 25)
    const res = computePagination(25, 4, 8);
    expect(res.currentPage).toBe(4);
    expect(res.startIndex).toBe(24);
    expect(res.endIndex).toBe(25);
  });

  it('harus membatasi currentPage jika meminta halaman melebihi totalPages', () => {
    // Total 25 produk (4 halaman), tapi request page 99
    const res = computePagination(25, 99, 8);
    expect(res.currentPage).toBe(4);
    expect(res.startIndex).toBe(24);
    expect(res.endIndex).toBe(25);
  });

  it('harus menangani data kosong (0 items) tanpa crash', () => {
    const res = computePagination(0, 1, 8);
    expect(res.totalItems).toBe(0);
    expect(res.totalPages).toBe(1);
    expect(res.currentPage).toBe(1);
    expect(res.startIndex).toBe(0);
    expect(res.endIndex).toBe(0);
  });

  it('harus memotong list array secara akurat dengan paginateList', () => {
    const items = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
    const { paginatedItems, pagination } = paginateList(items, 2, 4);

    expect(pagination.totalPages).toBe(3);
    expect(pagination.currentPage).toBe(2);
    expect(paginatedItems).toEqual(['E', 'F', 'G', 'H']);
  });

  it('harus menghasilkan nomor halaman tanpa ellipsis jika totalPages <= 5', () => {
    expect(generatePageNumbers(1, 3)).toEqual([1, 2, 3]);
    expect(generatePageNumbers(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('harus menghasilkan nomor halaman dengan ellipsis jika totalPages > 5', () => {
    // Halaman 1 dari 10: [1, 2, '...', 10]
    expect(generatePageNumbers(1, 10)).toEqual([1, 2, '...', 10]);

    // Halaman 5 dari 10: [1, '...', 4, 5, 6, '...', 10]
    expect(generatePageNumbers(5, 10)).toEqual([1, '...', 4, 5, 6, '...', 10]);

    // Halaman 10 dari 10: [1, '...', 9, 10]
    expect(generatePageNumbers(10, 10)).toEqual([1, '...', 9, 10]);
  });
});
