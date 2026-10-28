import React from 'react';
import { Package, CheckCircle2, TrendingUp, AlertTriangle } from 'lucide-react';
import type { SummaryMetrics } from '../types/api';
import { formatCurrencyIDR } from '../utils/formatters';

interface SummaryCardsProps {
  metrics: SummaryMetrics;
  isLoading: boolean;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ metrics, isLoading }) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs animate-pulse"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-20 h-4 bg-slate-200 rounded"></div>
              <div className="w-8 h-8 bg-slate-100 rounded-lg"></div>
            </div>
            <div className="w-28 h-7 bg-slate-200 rounded mb-1.5"></div>
            <div className="w-36 h-3.5 bg-slate-100 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: 'Total Produk',
      value: metrics.totalProducts.toLocaleString('id-ID'),
      subtitle: 'Katalog SKU terdaftar',
      icon: Package,
      iconBg: 'bg-slate-100 text-slate-700',
      borderAccent: 'hover:border-slate-300',
    },
    {
      title: 'Produk Aktif',
      value: metrics.activeProducts.toLocaleString('id-ID'),
      subtitle: `${((metrics.activeProducts / (metrics.totalProducts || 1)) * 100).toFixed(0)}% dari seluruh katalog`,
      icon: CheckCircle2,
      iconBg: 'bg-emerald-50 text-emerald-600',
      borderAccent: 'hover:border-emerald-300',
    },
    {
      title: 'Total Nilai Stok',
      value: formatCurrencyIDR(metrics.totalStockValue),
      subtitle: 'Estimasi nilai inventaris fisik',
      icon: TrendingUp,
      iconBg: 'bg-blue-50 text-blue-600',
      borderAccent: 'hover:border-blue-300',
    },
    {
      title: 'Stok Menipis (≤ 10)',
      value: metrics.lowStockCount.toLocaleString('id-ID'),
      subtitle: metrics.lowStockCount > 0 ? 'Perlu penambahan stok segera' : 'Seluruh stok dalam batas aman',
      icon: AlertTriangle,
      iconBg: metrics.lowStockCount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500',
      borderAccent: metrics.lowStockCount > 0 ? 'border-amber-200 hover:border-amber-300' : 'hover:border-slate-300',
      alert: metrics.lowStockCount > 0,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card, idx) => {
        const IconComponent = card.icon;
        return (
          <div
            key={idx}
            className={`p-5 rounded-xl bg-white border border-slate-200 shadow-xs transition-all duration-200 hover:shadow-sm ${card.borderAccent}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {card.title}
              </span>
              <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${card.iconBg}`}>
                <IconComponent className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-2xl font-bold tracking-tight text-slate-900">
                {card.value}
              </span>
              {card.alert && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800">
                  Perhatian
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500 font-normal">
              {card.subtitle}
            </p>
          </div>
        );
      })}
    </div>
  );
};
