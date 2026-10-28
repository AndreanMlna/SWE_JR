import React, { useState } from 'react';
import { X, CheckCircle2, AlertCircle, PackagePlus, Edit3 } from 'lucide-react';
import type { Product } from '../types/api';
import { api, APIClientError } from '../api/client';

interface ProductFormModalProps {
  product?: Product | null; // Jika ada, maka Edit Mode; jika null, Create Mode
  onClose: () => void;
  onSuccess: (savedProduct: Product) => void;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  product,
  onClose,
  onSuccess,
}) => {
  const isEdit = Boolean(product);

  const [sku, setSku] = useState<string>(product?.sku || '');
  const [name, setName] = useState<string>(product?.name || '');
  const [price, setPrice] = useState<number | ''>(product?.price || '');
  const [isActive, setIsActive] = useState<boolean>(product?.is_active ?? true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedSKU = sku.trim();
    const trimmedName = name.trim();
    const numericPrice = Number(price);

    if (!isEdit && !trimmedSKU) {
      setErrorMessage('SKU produk wajib diisi.');
      return;
    }

    if (!trimmedName) {
      setErrorMessage('Nama produk wajib diisi.');
      return;
    }

    if (price === '' || isNaN(numericPrice) || numericPrice < 0 || !Number.isInteger(numericPrice)) {
      setErrorMessage('Harga produk harus berupa bilangan bulat integer >= 0 (IDR).');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEdit && product) {
        const updated = await api.updateProduct(product.id, {
          name: trimmedName,
          price: numericPrice,
          is_active: isActive,
        });
        onSuccess(updated);
      } else {
        const created = await api.createProduct({
          sku: trimmedSKU,
          name: trimmedName,
          price: numericPrice,
        });
        onSuccess(created);
      }
      onClose();
    } catch (err: unknown) {
      if (err instanceof APIClientError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Gagal menyimpan data produk.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/80">
              {isEdit ? <Edit3 className="w-4 h-4 text-emerald-700" /> : <PackagePlus className="w-4 h-4 text-emerald-700" />}
            </div>
            <h3 className="text-base font-bold text-slate-900">
              {isEdit ? 'Perbarui Produk' : 'Tambah Produk Baru'}
            </h3>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* SKU Field (Read-only if edit mode) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Kode SKU <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value.toUpperCase())}
              disabled={isEdit}
              placeholder="Contoh: LOGI-MXM3S"
              required
              className={`w-full px-3.5 py-2.5 rounded-lg border text-sm font-mono transition-colors ${
                isEdit
                  ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                  : 'bg-white text-slate-900 border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500'
              }`}
            />
            {isEdit && (
              <p className="text-[11px] text-slate-400 mt-1">
                Kode SKU bersifat permanen dan tidak dapat diubah setelah terdaftar.
              </p>
            )}
          </div>

          {/* Name Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Nama Produk <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Logitech MX Master 3S Wireless Mouse"
              required
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Price Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Harga Satuan (IDR) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 text-sm font-semibold">
                Rp
              </span>
              <input
                type="number"
                min="0"
                step="1"
                value={price}
                onChange={(e) =>
                  setPrice(e.target.value === '' ? '' : parseInt(e.target.value, 10))
                }
                placeholder="0"
                required
                className="w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Nilai bulat integer tanpa desimal (no float money).</p>
          </div>

          {/* Is Active Status (Only in Edit Mode) */}
          {isEdit && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80">
              <div>
                <span className="text-xs font-semibold text-slate-800 block">Status Produk Aktif</span>
                <span className="text-[11px] text-slate-500">
                  Produk aktif dapat dipesan pada pembuatan order baru.
                </span>
              </div>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
              />
            </div>
          )}

          {/* Error Message Alert */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

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
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>{isEdit ? 'Simpan Perubahan' : 'Daftarkan Produk'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
