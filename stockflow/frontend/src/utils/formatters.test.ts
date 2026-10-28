import { describe, it, expect } from 'vitest';
import { formatCurrencyIDR, formatRelativeTime, calculateSummaryMetrics } from './formatters';
import { Product } from '../types/api';

describe('formatters utility unit tests', () => {
  describe('formatCurrencyIDR', () => {
    it('harus memformat angka menjadi format rupiah tanpa pecahan sen', () => {
      const formatted = formatCurrencyIDR(1234567);
      // Format id-ID menghasilkan "Rp 1.234.567" atau "Rp\u00a01.234.567"
      expect(formatted).toMatch(/Rp\s?1\.234\.567/);
    });

    it('harus menangani angka 0 dengan benar', () => {
      const formatted = formatCurrencyIDR(0);
      expect(formatted).toMatch(/Rp\s?0/);
    });
  });

  describe('formatRelativeTime', () => {
    it('harus mengembalikan "Belum pernah" jika nilai null atau undefined', () => {
      expect(formatRelativeTime(null)).toBe('Belum pernah');
      expect(formatRelativeTime(undefined)).toBe('Belum pernah');
    });

    it('harus mengembalikan "Baru saja" untuk waktu kurang dari 60 detik yang lalu', () => {
      const justNow = new Date(Date.now() - 10 * 1000).toISOString();
      expect(formatRelativeTime(justNow)).toBe('Baru saja');
    });
  });

  describe('calculateSummaryMetrics', () => {
    it('harus menghitung total produk, produk aktif, total nilai inventaris, dan produk stok rendah', () => {
      const mockProducts: Product[] = [
        {
          id: 1,
          sku: 'SKU-01',
          name: 'Keyboard',
          price: 100000,
          stock: 5, // low stock (<= 10) & active
          is_active: true,
          created_at: new Date().toISOString(),
          last_movement_at: null,
        },
        {
          id: 2,
          sku: 'SKU-02',
          name: 'Mouse',
          price: 50000,
          stock: 20, // normal stock & active
          is_active: true,
          created_at: new Date().toISOString(),
          last_movement_at: null,
        },
        {
          id: 3,
          sku: 'SKU-03',
          name: 'Cable',
          price: 20000,
          stock: 0, // inactive, shouldn't be counted in lowStockCount or activeProducts
          is_active: false,
          created_at: new Date().toISOString(),
          last_movement_at: null,
        },
      ];

      const metrics = calculateSummaryMetrics(mockProducts);

      expect(metrics.totalProducts).toBe(3);
      expect(metrics.activeProducts).toBe(2);
      expect(metrics.totalStockValue).toBe(100000 * 5 + 50000 * 20 + 20000 * 0); // 500.000 + 1.000.000 = 1.500.000
      expect(metrics.lowStockCount).toBe(1); // Hanya SKU-01 yang aktif dan stock <= 10
    });
  });
});
