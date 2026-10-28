import { describe, it, expect } from 'vitest';
import { validateOrderForm } from './orderValidator';

describe('orderValidator utility tests', () => {
  it('harus memvalidasi formulir yang valid dengan benar', () => {
    const result = validateOrderForm('PT Sumber Berkah', [
      { sku: 'SKU-001', qty: 2 },
      { sku: 'SKU-002', qty: 5 },
    ]);
    expect(result.isValid).toBe(true);
    expect(result.errors.customer).toBeUndefined();
    expect(result.errors.items).toBeUndefined();
  });

  it('harus menolak nama customer yang kosong atau hanya spasi', () => {
    const result = validateOrderForm('   ', [{ sku: 'SKU-001', qty: 1 }]);
    expect(result.isValid).toBe(false);
    expect(result.errors.customer).toBe('Nama pelanggan wajib diisi');
  });

  it('harus menolak pesanan tanpa item', () => {
    const result = validateOrderForm('PT Sumber Berkah', []);
    expect(result.isValid).toBe(false);
    expect(result.errors.items).toBe('Pesanan wajib memiliki minimal 1 item produk');
  });

  it('harus menolak kuantitas non-positif atau pecahan', () => {
    const result = validateOrderForm('PT Sumber Berkah', [
      { sku: 'SKU-001', qty: 0 },
      { sku: 'SKU-002', qty: -3 },
    ]);
    expect(result.isValid).toBe(false);
    expect(result.errors.itemRowErrors?.[0]).toContain('harus berupa bilangan bulat > 0');
    expect(result.errors.itemRowErrors?.[1]).toContain('harus berupa bilangan bulat > 0');
  });

  it('harus mendeteksi dan menolak SKU duplikat dalam satu order', () => {
    const result = validateOrderForm('PT Sumber Berkah', [
      { sku: 'SKU-001', qty: 3 },
      { sku: 'SKU-001', qty: 2 },
    ]);
    expect(result.isValid).toBe(false);
    expect(result.errors.itemRowErrors?.[1]).toContain('terduplikasi');
  });
});
