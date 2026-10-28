import { describe, it, expect } from 'vitest';
import { APIClientError } from './client';
import type { APIErrorEnvelope } from '../types/api';

describe('API Client Error & Envelope Parsing', () => {
  it('harus memparsing amplop error 409 INSUFFICIENT_STOCK dengan benar', () => {
    const rawBackendEnvelope: APIErrorEnvelope = {
      error: {
        code: 'INSUFFICIENT_STOCK',
        message: 'Stok tidak mencukupi untuk SKU: SKU-123',
        sku: 'SKU-123',
        available: 4,
      },
    };

    const clientError = new APIClientError(409, rawBackendEnvelope.error);

    expect(clientError.statusCode).toBe(409);
    expect(clientError.code).toBe('INSUFFICIENT_STOCK');
    expect(clientError.message).toBe('Stok tidak mencukupi untuk SKU: SKU-123');
    expect(clientError.sku).toBe('SKU-123');
    expect(clientError.available).toBe(4);
  });

  it('harus memparsing amplop error 400 tanpa metadata opsional', () => {
    const rawBackendEnvelope: APIErrorEnvelope = {
      error: {
        code: 'SKU_EXISTS',
        message: 'Produk dengan SKU tersebut sudah terdaftar',
      },
    };

    const clientError = new APIClientError(400, rawBackendEnvelope.error);

    expect(clientError.statusCode).toBe(400);
    expect(clientError.code).toBe('SKU_EXISTS');
    expect(clientError.sku).toBeUndefined();
    expect(clientError.available).toBeUndefined();
  });

  it('harus menangani status code dan custom fallback message', () => {
    const error = new APIClientError(500, {
      code: 'INTERNAL_ERROR',
      message: 'Terjadi kesalahan sistem internal',
    });

    expect(error.name).toBe('APIClientError');
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.message).toBe('Terjadi kesalahan sistem internal');
  });
});
