import React, { useState } from 'react';
import { X, Ban, AlertTriangle, FileText } from 'lucide-react';
import type { SalesOrder } from '../types/api';
import { api, APIClientError } from '../api/client';
import { formatCurrencyIDR } from '../utils/formatters';

interface OrderDetailModalProps {
  order: SalesOrder;
  onClose: () => void;
  onOrderCancelled: (cancelledOrder: SalesOrder) => void;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  order: initialOrder,
  onClose,
  onOrderCancelled,
}) => {
  const [order, setOrder] = useState<SalesOrder>(initialOrder);
  const [isConfirmingCancel, setIsConfirmingCancel] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCancelOrder = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const updated = await api.cancelOrder(order.id);
      setOrder(updated);
      setIsConfirmingCancel(false);
      onOrderCancelled(updated);
    } catch (err: unknown) {
      if (err instanceof APIClientError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Gagal membatalkan pesanan.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCancelled = order.status === 'CANCELLED';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`flex items-center justify-center w-9 h-9 rounded-xl ${
                isCancelled ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {isCancelled ? <Ban className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Pesanan Penjualan #{order.id}</h3>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                    isCancelled
                      ? 'bg-rose-100 text-rose-800 border border-rose-200'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  {isCancelled ? 'DIBATALKAN (CANCELLED)' : 'SUKSES (CREATED)'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Customer: {order.customer}</p>
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

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 grow">
          {/* Metadata Card */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
            <div>
              <span className="text-slate-400 font-medium block">Waktu Dibuat</span>
              <span className="text-slate-700 font-semibold mt-0.5 block">
                {new Date(order.created_at).toLocaleString('id-ID')}
              </span>
            </div>
            {order.cancelled_at && (
              <div>
                <span className="text-rose-400 font-medium block">Waktu Pembatalan</span>
                <span className="text-rose-700 font-semibold mt-0.5 block">
                  {new Date(order.cancelled_at).toLocaleString('id-ID')}
                </span>
              </div>
            )}
          </div>

          {/* Items Table */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Daftar Barang (Order Items)
            </h4>
            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
              <div className="bg-slate-50 px-4 py-2 flex items-center justify-between text-xs font-semibold text-slate-600">
                <span>SKU & Kuantitas</span>
                <span>Harga Satuan / Subtotal</span>
              </div>
              {order.items.map((it) => (
                <div key={it.id} className="px-4 py-3 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-mono font-bold text-slate-900 block">{it.sku}</span>
                    <span className="text-xs text-slate-500">{it.qty} unit</span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-slate-900 block">
                      {formatCurrencyIDR(it.unit_price * it.qty)}
                    </span>
                    <span className="text-xs text-slate-500">
                      @{formatCurrencyIDR(it.unit_price)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Server-Computed Total Card */}
          <div className="p-4 rounded-xl bg-slate-900 text-white flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 font-medium block">Total Pembayaran</span>
              <span className="text-xs text-emerald-400">Dihitung otomatis oleh server Go</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-white">
              {formatCurrencyIDR(order.total)}
            </span>
          </div>

          {/* Cancellation Confirmation Box */}
          {isConfirmingCancel && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 animate-in fade-in duration-150">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-2 text-xs">
                  <p className="font-bold text-amber-950">Konfirmasi Pembatalan Pesanan</p>
                  <p className="text-amber-800">
                    Apakah Anda yakin ingin membatalkan pesanan #{order.id}? Seluruh stok barang
                    akan langsung dipulihkan secara otomatis ke inventaris gudang. Tindakan ini tidak dapat diurungkan.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleCancelOrder}
                      disabled={isSubmitting}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors disabled:opacity-50"
                    >
                      {isSubmitting ? 'Membatalkan...' : 'Ya, Batalkan Pesanan'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsConfirmingCancel(false)}
                      disabled={isSubmitting}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-amber-100 transition-colors"
                    >
                      Kembali
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error Message Alert */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              {errorMessage}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0">
          {!isCancelled && !isConfirmingCancel ? (
            <button
              type="button"
              onClick={() => setIsConfirmingCancel(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-700 hover:text-rose-800 hover:bg-rose-50 border border-rose-200 transition-colors"
            >
              <Ban className="w-3.5 h-3.5" />
              <span>Batalkan Pesanan</span>
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
