import { Product, SummaryMetrics } from '../types/api';

/**
 * Format nominal integer ke mata uang Rupiah standar Indonesia
 * Contoh: 1234567 -> "Rp 1.234.567"
 */
export function formatCurrencyIDR(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return 'Rp 0';
  }
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Mengonversi ISO date string ke relative time bahasa Indonesia
 * Contoh: "2 jam yang lalu", "5 menit yang lalu", "3 hari yang lalu"
 */
export function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) {
    return 'Belum pernah';
  }

  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return '-';
  }

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'Baru saja';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} menit yang lalu`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} jam yang lalu`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) {
    return `${diffInDays} hari yang lalu`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths} bulan yang lalu`;
  }

  const diffInYears = Math.floor(diffInDays / 365);
  return `${diffInYears} tahun yang lalu`;
}

/**
 * Menghitung ringkasan metrik inventaris dari daftar produk
 */
export function calculateSummaryMetrics(products: Product[]): SummaryMetrics {
  let totalProducts = products.length;
  let activeProducts = 0;
  let totalStockValue = 0;
  let lowStockCount = 0;

  for (const p of products) {
    if (p.is_active) {
      activeProducts++;
    }
    totalStockValue += p.price * p.stock;
    if (p.stock <= 10 && p.is_active) {
      lowStockCount++;
    }
  }

  return {
    totalProducts,
    activeProducts,
    totalStockValue,
    lowStockCount,
  };
}
