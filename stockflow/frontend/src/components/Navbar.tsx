import React from 'react';
import { Package, Plus, ShoppingCart, RefreshCw } from 'lucide-react';

interface NavbarProps {
  onOpenCreateProduct: () => void;
  onOpenCreateOrder: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenCreateProduct,
  onOpenCreateOrder,
  onRefresh,
  isRefreshing,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand Identity */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-900 text-white shadow-sm ring-1 ring-slate-900/10">
              <Package className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-slate-900 tracking-tight">StockFlow</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Mini ERP
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Inventory & Sales Management</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Perbarui Data Inventaris"
              className="inline-flex items-center justify-center p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
            </button>

            <button
              onClick={onOpenCreateOrder}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 shadow-xs hover:border-slate-400 transition-all active:scale-[0.98]"
            >
              <ShoppingCart className="w-4 h-4 text-emerald-600" />
              <span>Buat Order</span>
            </button>

            <button
              onClick={onOpenCreateProduct}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 shadow-sm transition-all active:scale-[0.98]"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>Tambah Produk</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
