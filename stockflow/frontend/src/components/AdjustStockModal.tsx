import React, { useState } from 'react';
import { X, ArrowDownLeft, ArrowUpRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { Product } from '../types/api';
import { api, APIClientError } from '../api/client';

interface AdjustStockModalProps {
  product: Product;
  onClose: () => void;
  onSuccess: (updatedProduct: Product) => void;
}

export const AdjustStockModal: React.FC<AdjustStockModalProps> = ({
  product,
  onClose,
  onSuccess,
}) => {
  const [type, setType] = useState<'in' | 'out'>('in');
  const [qty, setQty] = useState<number | ''>(1);
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [availableStock, setAvailableStock] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setAvailableStock(null);

    const numericQty = Number(qty);
    if (!qty || isNaN(numericQty) || numericQty <= 0 || !Number.isInteger(numericQty)) {
      setErrorMessage('Kuantitas penyesuaian harus berupa bilangan bulat lebih besar dari 0.');
      return;
    }

    setIsSubmitting(true);
    try {
      const updatedProduct = await api.adjustStock(product.id, {
        type,
        qty: numericQty,
        note: note.trim() || undefined,
      });
      onSuccess(updatedProduct);
      onClose();
    } catch (err: unknown) {
      if (err instanceof APIClientError) {
        setErrorMessage(err.message);
        if (err.available !== undefined) {
          setAvailableStock(err.available);
        }
      } else {
        setErrorMessage('Terjadi kesalahan saat memproses penyesuaian stok.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-slate-900">Penyesuaian Stok (Adjust Stock)</h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5">{product.sku} — {product.name}</p>
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
          {/* Current Stock Banner */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-100 border border-slate-200/80">
            <span className="text-xs font-semibold text-slate-600">Sisa Stok Fisik Saat Ini</span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-bold bg-white text-slate-900 shadow-2xs border border-slate-200">
              {product.stock.toLocaleString('id-ID')} unit
            </span>
          </div>

          {/* Direction Picker (In / Out) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Arah Pergerakan Stok
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType('in')}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-semibold transition-all ${
                  type === 'in'
                    ? 'border-emerald-600 bg-emerald-50/80 text-emerald-800 ring-2 ring-emerald-600/20 shadow-2xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                <span>Stok Masuk (In)</span>
              </button>

              <button
                type="button"
                onClick={() => setType('out')}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-semibold transition-all ${
                  type === 'out'
                    ? 'border-rose-600 bg-rose-50/80 text-rose-800 ring-2 ring-rose-600/20 shadow-2xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <ArrowUpRight className="w-4 h-4 text-rose-600" />
                <span>Stok Keluar (Out)</span>
              </button>
            </div>
          </div>

          {/* Quantity Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Kuantitas Perubahan <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={qty}
              onChange={(e) => setQty(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
              placeholder="Contoh: 10"
              required
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Note Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Catatan / Alasan Mutasi (Opsional)
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Contoh: Penerimaan barang dari PO #1024, retur pelanggan, dll."
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Cross-Stack 409 Error Alert Box (CRITICAL REQUIREMENT) */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 animate-in fade-in duration-150">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-semibold text-rose-900">{errorMessage}</p>
                  {availableStock !== null && (
                    <p className="text-rose-700 font-medium">
                      Jumlah stok yang tersedia di gudang saat ini:{' '}
                      <strong className="underline font-bold text-rose-900">
                        {availableStock} unit
                      </strong>
                      . Mohon sesuaikan jumlah mutasi keluar.
                    </p>
                  )}
                </div>
              </div>
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
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 shadow-sm transition-all disabled:opacity-50 active:scale-[0.98]"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Konfirmasi Mutasi</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
