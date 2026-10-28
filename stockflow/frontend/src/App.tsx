import { useState, useEffect, useCallback } from 'react';
import type { Product, SalesOrder, ProductFilterTab, DailySalesReport } from './types/api';
import { api, APIClientError } from './api/client';
import { calculateSummaryMetrics } from './utils/formatters';
import { useDebounce } from './hooks/useDebounce';

import { Navbar } from './components/Navbar';
import { SummaryCards } from './components/SummaryCards';
import { ProductsTable } from './components/ProductsTable';
import { AdjustStockModal } from './components/AdjustStockModal';
import { MovementsModal } from './components/MovementsModal';
import { CreateOrderModal } from './components/CreateOrderModal';
import { OrderDetailModal } from './components/OrderDetailModal';
import { ProductFormModal } from './components/ProductFormModal';

import { AlertTriangle, CheckCircle2, X } from 'lucide-react';

export function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [dailySales, setDailySales] = useState<DailySalesReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter Tabs
  const [searchQuery, setSearchQuery] = useState<string>('');
  const debouncedSearch = useDebounce<string>(searchQuery, 300);
  const [filterTab, setFilterTab] = useState<ProductFilterTab>('all');

  // Modals State
  const [adjustStockProduct, setAdjustStockProduct] = useState<Product | null>(null);
  const [movementsProduct, setMovementsProduct] = useState<Product | null>(null);
  const [isCreateOrderOpen, setIsCreateOrderOpen] = useState<boolean>(false);
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
  const [productFormProduct, setProductFormProduct] = useState<Product | null>(null);
  const [isProductFormOpen, setIsProductFormOpen] = useState<boolean>(false);

  // Delete Confirmation & Error State
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Fetch Products dari Real Go API
  const fetchProducts = useCallback(async (isBackground: boolean = false) => {
    if (!isBackground) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setError(null);

    try {
      const res = await api.getProducts({
        search: debouncedSearch.trim() || undefined,
        limit: 100, // Ambil katalog untuk tampilan mini ERP
      });
      setProducts(res.data);
    } catch (err: unknown) {
      if (err instanceof APIClientError) {
        setError(err.message);
      } else {
        setError('Gagal menghubungkan ke backend Go API. Pastikan server aktif di port 8080.');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [debouncedSearch]);

  const fetchDailySales = useCallback(async () => {
    try {
      const res = await api.getDailySalesReport();
      setDailySales(res);
    } catch {
      // Non-blocking background sync
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchDailySales();
  }, [fetchProducts, fetchDailySales]);

  // Handler Hapus Produk (Proteksi Audit Trail 409)
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError(null);

    try {
      await api.deleteProduct(deleteTarget.id);
      showToast(`Produk '${deleteTarget.name}' berhasil dihapus.`);
      setDeleteTarget(null);
      fetchProducts(true);
    } catch (err: unknown) {
      if (err instanceof APIClientError) {
        setDeleteError(err.message);
      } else {
        setDeleteError('Gagal menghapus produk.');
      }
    }
  };

  // Hitung metrik ringkasan inventaris
  const metrics = calculateSummaryMetrics(products);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Navbar */}
      <Navbar
        onOpenCreateProduct={() => {
          setProductFormProduct(null);
          setIsProductFormOpen(true);
        }}
        onOpenCreateOrder={() => setIsCreateOrderOpen(true)}
        onRefresh={() => fetchProducts(true)}
        isRefreshing={isRefreshing}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grow w-full">
        {/* Toast Alert */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-slate-900 text-white text-xs font-semibold shadow-lg animate-in slide-in-from-bottom duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Section Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Dasbor Inventaris & Penjualan
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Pantau ketersediaan fisik stok gudang, riwayat mutasi terintegrasi, dan transaksi pesanan real-time.
          </p>
        </div>

        {/* 1. Summary Cards (Priority 5) */}
        <SummaryCards metrics={metrics} dailySales={dailySales} isLoading={isLoading && products.length === 0} />

        {/* 2. Products Table (Priority 1) */}
        <ProductsTable
          products={products}
          isLoading={isLoading}
          error={error}
          onRetry={() => fetchProducts(false)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filterTab={filterTab}
          onFilterChange={setFilterTab}
          onAdjustStock={(p) => setAdjustStockProduct(p)}
          onViewMovements={(p) => setMovementsProduct(p)}
          onEditProduct={(p) => {
            setProductFormProduct(p);
            setIsProductFormOpen(true);
          }}
          onDeleteProduct={(p) => {
            setDeleteTarget(p);
            setDeleteError(null);
          }}
        />
      </main>

      {/* Modal Adjust Stock (Priority 2) */}
      {adjustStockProduct && (
        <AdjustStockModal
          product={adjustStockProduct}
          onClose={() => setAdjustStockProduct(null)}
          onSuccess={(updated) => {
            showToast(`Penyesuaian stok untuk '${updated.sku}' berhasil disimpan.`);
            fetchProducts(true);
          }}
        />
      )}

      {/* Modal View Movements (Audit Trail) */}
      {movementsProduct && (
        <MovementsModal
          product={movementsProduct}
          onClose={() => setMovementsProduct(null)}
        />
      )}

      {/* Modal Create Order (Priority 3) */}
      {isCreateOrderOpen && (
        <CreateOrderModal
          products={products}
          onClose={() => setIsCreateOrderOpen(false)}
          onSuccess={(created) => {
            showToast(`Pesanan #${created.id} untuk '${created.customer}' berhasil dibuat!`);
            fetchProducts(true); // Stok langsung ter-refresh setelah order dibuat
            fetchDailySales(); // Metrik penjualan harian ter-update
            setSelectedOrder(created); // Tampilkan detail pesanan yang baru berhasil dibuat
          }}
        />
      )}

      {/* Modal Order Detail & Cancel Confirmation (Priority 4) */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onOrderCancelled={(cancelled) => {
            showToast(`Pesanan #${cancelled.id} telah dibatalkan. Stok barang berhasil dipulihkan.`);
            fetchProducts(true); // Stok terlihat dipulihkan pada daftar produk!
            fetchDailySales(); // Metrik penjualan harian ter-update
          }}
        />
      )}

      {/* Modal Product Form (Create / Edit) */}
      {isProductFormOpen && (
        <ProductFormModal
          product={productFormProduct}
          onClose={() => {
            setIsProductFormOpen(false);
            setProductFormProduct(null);
          }}
          onSuccess={(saved) => {
            showToast(
              productFormProduct
                ? `Produk '${saved.name}' berhasil diperbarui.`
                : `Produk baru '${saved.name}' berhasil didaftarkan.`
            );
            fetchProducts(true);
          }}
        />
      )}

      {/* Modal Konfirmasi Hapus Produk (dengan Proteksi 409 Audit History) */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-rose-50 text-rose-600 shrink-0 border border-rose-100">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="grow">
                <h3 className="text-base font-bold text-slate-900">Konfirmasi Hapus Produk</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Yakin ingin menghapus produk <strong className="text-slate-900">{deleteTarget.name}</strong> ({deleteTarget.sku})?
                </p>
              </div>
              <button
                onClick={() => setDeleteTarget(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error 409 Alert saat produk memiliki history */}
            {deleteError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                <p className="font-bold text-rose-950 mb-0.5">Penghapusan Ditolak (409 Conflict)</p>
                <p>{deleteError}</p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors"
              >
                Ya, Hapus Produk
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
        <p>StockFlow &copy; 2026 &middot; Technical Test Full-Stack Practical Module &middot; Built with Go + PostgreSQL + React TypeScript</p>
      </footer>
    </div>
  );
}

export default App;
