import type { CreateOrderItemPayload } from '../types/api';

export interface OrderFormValidationResult {
  isValid: boolean;
  errors: {
    customer?: string;
    items?: string;
    itemRowErrors?: { [index: number]: string };
  };
}

/**
 * Memvalidasi form input pembuatan pesanan penjualan (Sales Order):
 * - Nama customer tidak boleh kosong
 * - Minimal harus ada 1 baris item
 * - Setiap baris item harus memiliki SKU yang dipilih dan kuantitas > 0
 * - Tidak boleh ada SKU duplikat dalam satu order
 */
export function validateOrderForm(
  customer: string,
  items: CreateOrderItemPayload[]
): OrderFormValidationResult {
  const errors: OrderFormValidationResult['errors'] = {};
  const itemRowErrors: { [index: number]: string } = {};

  if (!customer || !customer.trim()) {
    errors.customer = 'Nama pelanggan wajib diisi';
  }

  if (!items || items.length === 0) {
    errors.items = 'Pesanan wajib memiliki minimal 1 item produk';
  } else {
    const seenSKUs = new Set<string>();

    items.forEach((item, index) => {
      const trimmedSKU = (item.sku || '').trim();
      if (!trimmedSKU) {
        itemRowErrors[index] = 'Pilih produk untuk baris ini';
        return;
      }

      if (!item.qty || item.qty <= 0 || !Number.isInteger(item.qty)) {
        itemRowErrors[index] = 'Kuantitas harus berupa bilangan bulat > 0';
        return;
      }

      if (seenSKUs.has(trimmedSKU)) {
        itemRowErrors[index] = `SKU "${trimmedSKU}" terduplikasi. Gabungkan kuantitas ke satu baris.`;
        return;
      }

      seenSKUs.add(trimmedSKU);
    });

    if (Object.keys(itemRowErrors).length > 0) {
      errors.itemRowErrors = itemRowErrors;
      errors.items = 'Terdapat kesalahan pada beberapa baris item';
    }
  }

  const isValid = !errors.customer && !errors.items && !errors.itemRowErrors;
  return { isValid, errors };
}
