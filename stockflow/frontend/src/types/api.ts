// Domain Data Types & API Contracts for StockFlow (Strict TypeScript - No Any)

export interface Product {
  id: number;
  sku: string;
  name: string;
  price: number; // IDR integer: no float money
  stock: number;
  is_active: boolean;
  created_at: string;
  last_movement_at: string | null;
}

export interface StockMovement {
  id: number;
  product_id: number;
  type: 'in' | 'out';
  qty: number;
  note: string | null;
  created_at: string;
}

export interface SalesOrderItem {
  id: number;
  order_id: number;
  sku: string;
  qty: number;
  unit_price: number;
}

export interface SalesOrder {
  id: number;
  customer: string;
  status: 'CREATED' | 'CANCELLED';
  total: number;
  created_at: string;
  cancelled_at?: string | null;
  items: SalesOrderItem[];
}

export interface ProductListResponse {
  data: Product[];
  page: number;
  limit: number;
  total: number;
}

export interface StockMovementsResponse {
  data: StockMovement[];
}

// Unified Error Envelope dari Go backend
export interface APIErrorDetail {
  code: string;
  message: string;
  sku?: string;
  available?: number;
}

export interface APIErrorEnvelope {
  error: APIErrorDetail;
}

// Request Payloads
export interface CreateProductPayload {
  sku: string;
  name: string;
  price: number;
}

export interface UpdateProductPayload {
  name?: string;
  price?: number;
  is_active?: boolean;
}

export interface AdjustStockPayload {
  type: 'in' | 'out';
  qty: number;
  note?: string;
}

export interface CreateOrderItemPayload {
  sku: string;
  qty: number;
}

export interface CreateOrderPayload {
  customer: string;
  items: CreateOrderItemPayload[];
}

// UI & Filter States
export type ProductFilterTab = 'all' | 'active' | 'inactive' | 'low_stock';

export interface SummaryMetrics {
  totalProducts: number;
  activeProducts: number;
  totalStockValue: number;
  lowStockCount: number;
}
