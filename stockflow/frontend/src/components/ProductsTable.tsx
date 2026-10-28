import React from 'react';
import {
  Search,
  SlidersHorizontal,
  Clock,
  History,
  Edit2,
  Trash2,
  AlertCircle,
  RefreshCcw,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import type { Product, ProductFilterTab } from '../types/api';
import { formatCurrencyIDR, formatRelativeTime } from '../utils/formatters';

interface ProductsTableProps {
  products: Product[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  filterTab: ProductFilterTab;
  onFilterChange: (tab: ProductFilterTab) => void;
  onAdjustStock: (product: Product) => void;
  onViewMovements: (product: Product) => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (product: Product) => void;
}

export const ProductsTable: React.FC<ProductsTableProps> = ({
  products,
  isLoading,
  error,
  onRetry,
  searchQuery,
  onSearchChange,
  filterTab,
  onFilterChange,
  onAdjustStock,
  onViewMovements,
  onEditProduct,
  onDeleteProduct,
}) => {
  // Filter lokal tambahan berdasarkan tab
  const filteredProducts = products.filter((p) => {
    if (filterTab === 'active') return p.is_active;
    if (filterTab === 'inactive') return !p.is_active;
    if (filterTab === 'low_stock') return p.stock <= 10 && p.is_active;
    return true; // 'all'
  });

  const lowStockCount = products.filter((p) => p.stock <= 10 && p.is_active).length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Control Bar: Search & Filter Tabs */}
      <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-slate-50/50">
        {/* Search Bar with Debounce indicator */}
        <div className="relative grow max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cari berdasarkan SKU atau nama produk..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full w-4 h-4 flex items-center justify-center"
            >
              ×
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-200/60 self-start md:self-auto overflow-x-auto max-w-full">
          <button
            onClick={() => onFilterChange('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              filterTab === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Semua ({products.length})
          </button>

          <button
            onClick={() => onFilterChange('active')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              filterTab === 'active'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Aktif ({products.filter((p) => p.is_active).length})
          </button>

          <button
            onClick={() => onFilterChange('inactive')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              filterTab === 'inactive'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Inaktif ({products.filter((p) => !p.is_active).length})
          </button>

          <button
            onClick={() => onFilterChange('low_stock')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              filterTab === 'low_stock'
                ? 'bg-white text-amber-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Stok Rendah</span>
            {lowStockCount > 0 && (
              <span className="inline-flex items-center justify-center px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                {lowStockCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* State 1: ERROR STATE WITH RETRY (MANDATORY REQUIREMENT) */}
      {error ? (
        <div className="py-16 px-4 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 mb-3 border border-rose-100">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">Gagal Memuat Data Produk</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">{error}</p>
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 shadow-sm transition-colors"
          >
            <RefreshCcw className="w-3.5 h-3.5" />
            <span>Coba Lagi (Retry)</span>
          </button>
        </div>
      ) : isLoading ? (
        /* State 2: LOADING SKELETON STATE (MANDATORY REQUIREMENT) */
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">SKU</th>
                <th className="py-3 px-4">Nama Produk</th>
                <th className="py-3 px-4">Harga Satuan</th>
                <th className="py-3 px-4">Stok</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Mutasi Terakhir</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...Array(6)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="py-4 px-4"><div className="w-20 h-4 bg-slate-200 rounded"></div></td>
                  <td className="py-4 px-4"><div className="w-48 h-4 bg-slate-200 rounded"></div></td>
                  <td className="py-4 px-4"><div className="w-24 h-4 bg-slate-200 rounded"></div></td>
                  <td className="py-4 px-4"><div className="w-12 h-5 bg-slate-200 rounded-md"></div></td>
                  <td className="py-4 px-4"><div className="w-16 h-5 bg-slate-200 rounded-full"></div></td>
                  <td className="py-4 px-4"><div className="w-28 h-4 bg-slate-200 rounded"></div></td>
                  <td className="py-4 px-4 text-right"><div className="w-20 h-8 bg-slate-100 rounded ml-auto"></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : filteredProducts.length === 0 ? (
        /* State 3: EMPTY STATE (MANDATORY REQUIREMENT) */
        <div className="py-16 px-4 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mb-3 border border-slate-200">
            <SlidersHorizontal className="w-6 h-6 stroke-1" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">Tidak Ada Produk Ditemukan</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
            {searchQuery
              ? `Tidak ditemukan produk dengan kata kunci "${searchQuery}". Coba kata kunci lain atau bersihkan pencarian.`
              : 'Tidak ada produk pada kategori filter ini.'}
          </p>
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="text-xs font-semibold text-emerald-700 hover:underline"
            >
              Bersihkan Filter Pencarian
            </button>
          )}
        </div>
      ) : (
        /* Data Table View */
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">SKU</th>
                <th className="py-3 px-4">Nama Produk</th>
                <th className="py-3 px-4">Harga Satuan</th>
                <th className="py-3 px-4">Stok Fisik</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Mutasi Terakhir</th>
                <th className="py-3 px-4 text-right">Aksi Inventaris</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredProducts.map((p) => {
                const isLowStock = p.stock <= 10 && p.is_active;

                return (
                  <tr
                    key={p.id}
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    {/* SKU */}
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 text-xs">
                      {p.sku}
                    </td>

                    {/* Name */}
                    <td className="py-3.5 px-4 font-medium text-slate-800 max-w-xs truncate" title={p.name}>
                      {p.name}
                    </td>

                    {/* Price */}
                    <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                      {formatCurrencyIDR(p.price)}
                    </td>

                    {/* Stock */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold ${
                            p.stock === 0
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : isLowStock
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-slate-100 text-slate-800 border border-slate-200'
                          }`}
                        >
                          {p.stock.toLocaleString('id-ID')} unit
                        </span>
                        {isLowStock && (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-200">
                            Low
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {p.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span>Aktif</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                          <XCircle className="w-3 h-3 text-slate-400" />
                          <span>Inaktif</span>
                        </span>
                      )}
                    </td>

                    {/* Last Movement */}
                    <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{formatRelativeTime(p.last_movement_at)}</span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => onAdjustStock(p)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100/70 border border-emerald-200 transition-colors"
                          title="Sesuaikan stok manual"
                        >
                          Adjust Stok
                        </button>

                        <button
                          onClick={() => onViewMovements(p)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                          title="Lihat riwayat mutasi produk"
                        >
                          <History className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => onEditProduct(p)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                          title="Edit produk"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => onDeleteProduct(p)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Hapus produk"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
