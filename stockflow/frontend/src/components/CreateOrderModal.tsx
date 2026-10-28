import React, { useState } from 'react';
import { X, Plus, Trash2, ShoppingBag, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { Product, SalesOrder } from '../types/api';
import { api, APIClientError } from '../api/client';
import { formatCurrencyIDR } from '../utils/formatters';

interface CreateOrderModalProps {
  products: Product[];
  onClose: () => void;
  onSuccess: (createdOrder: SalesOrder) => void;
}

interface OrderRow {
  id: string;
  sku: string;
  qty: number;
}

export const CreateOrderModal: React.FC<CreateOrderModalProps> = ({
  products,
  onClose,
  onSuccess,
}) => {
  const activeProducts = products.filter((p) => p.is_active);

  const [customer, setCustomer] = useState<string>('');
  const [items, setItems] = useState<OrderRow[]>([
    { id: '1', sku: activeProducts[0]?.sku || '', qty: 1 },
  ]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failedSKU, setFailedSKU] = useState<string | null>(null);
  const [availableStock, setAvailableStock] = useState<number | null>(null);

  const handleAddItem = () => {
    // Cari SKU berikutnya yang belum terpilih
    const selectedSKUs = new Set(items.map((it) => it.sku));
    const nextProduct = activeProducts.find((p) => !selectedSKUs.has(p.sku)) || activeProducts[0];

    setItems([
      ...items,
      {
        id: Math.random().toString(36).substring(7),
        sku: nextProduct?.sku || '',
        qty: 1,
      },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) return;
    setItems(items.filter((it) => it.id !== id));
  };

  const handleUpdateItem = (id: string, field: 'sku' | 'qty', val: string | number) => {
    setItems(
      items.map((it) => {
        if (it.id === id) {
          return { ...it, [field]: val };
        }
        return it;
      })
    );
  };

  // Kalkulasi estimasi total untuk preview pengguna
  const estimatedTotal = items.reduce((sum, item) => {
    const prod = products.find((p) => p.sku === item.sku);
    const price = prod?.price || 0;
    return sum + price * (item.qty > 0 ? item.qty : 0);
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setFailedSKU(null);
    setAvailableStock(null);

    if (!customer.trim()) {
      setErrorMessage('Nama customer wajib diisi.');
      return;
    }

    if (items.length === 0) {
      setErrorMessage('Pesanan harus memiliki minimal 1 item produk.');
      return;
    }

    // Client-side pre-validation
    const skuMap = new Set<string>();
    for (const item of items) {
      if (!item.sku) {
        setErrorMessage('Terdapat baris item dengan SKU kosong.');
        return;
      }
      if (item.qty <= 0 || !Number.isInteger(item.qty)) {
        setErrorMessage(`Kuantitas untuk SKU ${item.sku} harus lebih besar dari 0.`);
        return;
      }
      if (skuMap.has(item.sku)) {
        setErrorMessage(`SKU '${item.sku}' dipilih lebih dari sekali. Gabungkan kuantitas pada satu baris.`);
        setFailedSKU(item.sku);
        return;
      }
      skuMap.add(item.sku);
    }

    setIsSubmitting(true);
    try {
      const createdOrder = await api.createOrder({
        customer: customer.trim(),
        items: items.map((it) => ({
          sku: it.sku,
          qty: it.qty,
        })),
      });

      onSuccess(createdOrder);
      onClose();
    } catch (err: unknown) {
      if (err instanceof APIClientError) {
        setErrorMessage(err.message);
        if (err.sku) {
          setFailedSKU(err.sku);
        }
        if (err.available !== undefined) {
          setAvailableStock(err.available);
        }
      } else {
        setErrorMessage('Gagal membuat pesanan penjualan.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/80">
              <ShoppingBag className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Buat Pesanan Penjualan Baru</h3>
              <p className="text-xs text-slate-500">Kalkulasi harga dan pemotongan stok otomatis oleh server</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 grow">
          {/* Customer Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Nama Pelanggan (Customer) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder="Contoh: PT Solusi Nusantara atau Budi Santoso"
              required
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Items Table / Row List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Daftar Item Pesanan <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100/70 px-2.5 py-1 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Baris</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {items.map((row) => {
                const prod = products.find((p) => p.sku === row.sku);
                const isHighlightedError = failedSKU === row.sku;

                return (
                  <div
                    key={row.id}
                    className={`p-3 rounded-xl border transition-all ${
                      isHighlightedError
                        ? 'border-rose-400 bg-rose-50/50 ring-2 ring-rose-400/20 shadow-xs'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* SKU Dropdown */}
                      <div className="grow">
                        <select
                          value={row.sku}
                          onChange={(e) => handleUpdateItem(row.id, 'sku', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        >
                          {activeProducts.map((p) => (
                            <option key={p.sku} value={p.sku}>
                              {p.sku} - {p.name} (Stok: {p.stock})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Quantity Input */}
                      <div className="w-24 shrink-0">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={row.qty}
                          onChange={(e) =>
                            handleUpdateItem(
                              row.id,
                              'qty',
                              e.target.value === '' ? '' : parseInt(e.target.value, 10)
                            )
                          }
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm text-center focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        />
                      </div>

                      {/* Price Preview */}
                      <div className="w-32 text-right shrink-0">
                        <span className="text-xs font-semibold text-slate-900 block">
                          {formatCurrencyIDR((prod?.price || 0) * (row.qty || 0))}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          @{formatCurrencyIDR(prod?.price || 0)}
                        </span>
                      </div>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(row.id)}
                        disabled={items.length <= 1}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors"
                        title="Hapus baris item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Highlighting Alert for this exact item */}
                    {isHighlightedError && (
                      <div className="mt-2 text-xs text-rose-700 font-semibold flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>
                          Stok SKU ini bermasalah!{' '}
                          {availableStock !== null && (
                            <span>
                              Sisa tersedia: <strong>{availableStock} unit</strong>
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cross-Stack 409 & 400 Error Banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 animate-in fade-in duration-150">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-rose-900">{errorMessage}</p>
                  {failedSKU && availableStock !== null && (
                    <p className="text-rose-700">
                      Item SKU <code className="bg-rose-100 px-1 py-0.5 rounded font-mono">{failedSKU}</code>{' '}
                      hanya memiliki sisa stok <strong>{availableStock} unit</strong> di gudang.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Summary Preview Box */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">Estimasi Total Belanja</span>
              <span className="text-xs text-slate-500">Harga satuan final diotorisasi mutlak oleh server Go</span>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold tracking-tight text-slate-900 block tabular-nums">
                {formatCurrencyIDR(estimatedTotal)}
              </span>
              <span className="text-xs text-slate-500 font-medium">{items.length} baris item barang</span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs transition-all disabled:opacity-50 active:scale-[0.98]"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Memproses Pesanan...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>Kirim Pesanan (Order)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
