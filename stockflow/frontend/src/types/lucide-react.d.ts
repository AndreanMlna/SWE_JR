declare module 'lucide-react' {
  import type { FC, SVGProps } from 'react';

  export type IconProps = SVGProps<SVGSVGElement> & {
    size?: number | string;
    color?: string;
    strokeWidth?: number | string;
    className?: string;
  };
  export type Icon = FC<IconProps>;

  export const Package: Icon;
  export const Plus: Icon;
  export const ShoppingCart: Icon;
  export const RefreshCw: Icon;
  export const CheckCircle2: Icon;
  export const TrendingUp: Icon;
  export const AlertTriangle: Icon;
  export const X: Icon;
  export const ArrowDownLeft: Icon;
  export const ArrowUpRight: Icon;
  export const AlertCircle: Icon;
  export const History: Icon;
  export const Clock: Icon;
  export const Trash2: Icon;
  export const ShoppingBag: Icon;
  export const Ban: Icon;
  export const FileText: Icon;
  export const PackagePlus: Icon;
  export const Edit3: Icon;
  export const Search: Icon;
  export const SlidersHorizontal: Icon;
  export const Edit2: Icon;
  export const RefreshCcw: Icon;
  export const XCircle: Icon;
  export const Layers: Icon;
  export const CheckCircle: Icon;
  export const ChevronLeft: Icon;
  export const ChevronRight: Icon;

  const icons: { [key: string]: Icon };
  export default icons;
}
