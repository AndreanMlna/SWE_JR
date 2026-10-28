// Centralized API Client Module with Strict Unified Error Envelope Parsing
import type {
  Product,
  ProductListResponse,
  StockMovementsResponse,
  SalesOrder,
  CreateProductPayload,
  UpdateProductPayload,
  AdjustStockPayload,
  CreateOrderPayload,
  APIErrorEnvelope,
  APIErrorDetail,
} from '../types/api';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export class APIClientError extends Error {
  public statusCode: number;
  public detail: APIErrorDetail;

  constructor(statusCode: number, detail: APIErrorDetail) {
    super(detail.message || `API Error with status code ${statusCode}`);
    this.name = 'APIClientError';
    this.statusCode = statusCode;
    this.detail = detail;
  }

  get code(): string {
    return this.detail.code;
  }

  get sku(): string | undefined {
    return this.detail.sku;
  }

  get available(): number | undefined {
    return this.detail.available;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...options.headers,
  };

  let response: Response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (err) {
    throw new APIClientError(0, {
      code: 'NETWORK_ERROR',
      message: 'Gagal terhubung ke server backend Go. Pastikan server aktif.',
    });
  }

  // Jika response 204 No Content (misal DELETE sukses)
  if (response.status === 204) {
    return null as T;
  }

  let jsonBody: Record<string, unknown> | null = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      jsonBody = await response.json();
    } catch {
      // Empty or invalid json
    }
  }

  if (!response.ok) {
    if (jsonBody && typeof jsonBody === 'object' && 'error' in jsonBody) {
      const errEnvelope = jsonBody as unknown as APIErrorEnvelope;
      throw new APIClientError(response.status, errEnvelope.error);
    }

    throw new APIClientError(response.status, {
      code: 'HTTP_ERROR',
      message: `Permintaan gagal dengan status ${response.status}`,
    });
  }

  return jsonBody as T;
}

export const api = {
  // Products
  async getProducts(params?: { search?: string; page?: number; limit?: number }): Promise<ProductListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set('search', params.search);
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());

    const queryString = searchParams.toString();
    const endpoint = queryString ? `/products?${queryString}` : '/products';
    return request<ProductListResponse>(endpoint, { method: 'GET' });
  },

  async getProductById(id: number): Promise<Product> {
    return request<Product>(`/products/${id}`, { method: 'GET' });
  },

  async createProduct(payload: CreateProductPayload): Promise<Product> {
    return request<Product>('/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateProduct(id: number, payload: UpdateProductPayload): Promise<Product> {
    return request<Product>(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteProduct(id: number): Promise<void> {
    return request<void>(`/products/${id}`, { method: 'DELETE' });
  },

  // Stock Adjustments & Movements
  async adjustStock(id: number, payload: AdjustStockPayload): Promise<Product> {
    return request<Product>(`/products/${id}/stock`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getProductMovements(id: number): Promise<StockMovementsResponse> {
    return request<StockMovementsResponse>(`/products/${id}/movements`, { method: 'GET' });
  },

  // Orders
  async createOrder(payload: CreateOrderPayload): Promise<SalesOrder> {
    return request<SalesOrder>('/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getOrderById(id: number): Promise<SalesOrder> {
    return request<SalesOrder>(`/orders/${id}`, { method: 'GET' });
  },

  async cancelOrder(id: number): Promise<SalesOrder> {
    return request<SalesOrder>(`/orders/${id}/cancel`, {
      method: 'POST',
    });
  },
};
