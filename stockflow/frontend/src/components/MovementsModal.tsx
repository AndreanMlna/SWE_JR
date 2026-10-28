import React, { useEffect, useState } from 'react';
import { X, History, ArrowDownLeft, ArrowUpRight, Clock } from 'lucide-react';
import type { Product, StockMovement } from '../types/api';
import { api } from '../api/client';
import { formatRelativeTime } from '../utils/formatters';

interface MovementsModalProps {
  product: Product;
  onClose: () => void;
}

export const MovementsModal: React.FC<MovementsModalProps> = ({ product, onClose }) => {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchMovements = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await api.getProductMovements(product.id);
        if (isMounted) {
          setMovements(res.data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Gagal memuat riwayat mutasi stok.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchMovements();
    return () => {
      isMounted = false;
    };
  }, [product.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-100 text-slate-700">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Riwayat Mutasi Stok (Audit Trail)</h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">{product.sku} — {product.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto grow">
          {isLoading ? (
            <div className="space-y-3 py-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 animate-pulse flex items-center justify-between">
                  <div className="w-32 h-4 bg-slate-200 rounded"></div>
                  <div className="w-20 h-4 bg-slate-200 rounded"></div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              {error}
            </div>
          ) : movements.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <History className="w-10 h-10 mx-auto text-slate-300 mb-2 stroke-1" />
              <p className="text-sm font-medium text-slate-600">Belum Ada Riwayat Mutasi</p>
              <p className="text-xs text-slate-400 mt-1">Seluruh pergerakan stok masuk dan keluar akan tercatat secara permanen di sini.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              {movements.map((m) => {
                const isIn = m.type === 'in';
                return (
                  <div key={m.id} className="p-4 flex items-center justify-between hover:bg-slate-50/70 transition-colors">
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${
                          isIn ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                        }`}
                      >
                        {isIn ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                              isIn ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {isIn ? 'Masuk (+)' : 'Keluar (-)'}
                          </span>
                          <span className="text-sm font-semibold text-slate-900">
                            {isIn ? '+' : '-'}{m.qty.toLocaleString('id-ID')} unit
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {m.note || <span className="italic text-slate-400">Tanpa catatan</span>}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-1 text-xs text-slate-500 justify-end">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{formatRelativeTime(m.created_at)}</span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">
                        {new Date(m.created_at).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-100 bg-slate-50 shrink-0">
          <button
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
