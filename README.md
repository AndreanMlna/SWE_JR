# StockFlow — Inventory & Sales (Mini ERP Module)

> **Enterprise Full-Stack Implementation**  
> Dibangun dengan **Go 1.22+** (Clean Architecture), **PostgreSQL 15+** (ACID & Pessimistic Concurrency Guard), dan **React 18 + Strict TypeScript** (Vite + Tailwind CSS).

---

## 1. Quickstart ($\le 5$ Menit)

Sistem dirancang untuk siap dijalankan secara lokal dalam waktu kurang dari 5 menit menggunakan Docker Compose.

### Prasyarat
- [Docker & Docker Compose](https://www.docker.com/)
- [Go 1.22+](https://go.dev/) (opsional jika menjalankan backend lokal)
- [Node.js v18+](https://nodejs.org/) (untuk menjalankan frontend Vite secara lokal)

### Opsi A: 1-Command End-to-End Stack (Bonus Deliverable)
Jalankan seluruh stack (Database, Backend Go, dan Frontend React) dalam satu perintah:
```bash
docker compose up -d --build
```
Sistem akan otomatis mengompilasi dan menjalankan:
1. **PostgreSQL 15** pada port `5433` (auto-migration skema DDL & seed 15 produk).
2. **Backend Go 1.22+** pada port `8080` (terhubung ke PostgreSQL dengan healthcheck).
3. **Frontend React + TypeScript** pada port `3000` (disajikan via Nginx dengan reverse proxy ke backend).

Buka browser di: **`http://localhost:3000`** atau akses API di **`http://localhost:8080/api/health`**.

---

### Opsi B: Local Development Workflow

#### Langkah 1: Jalankan Basis Data PostgreSQL (Migrasi & Seed Otomatis)
Dari direktori root repositori, jalankan:
```bash
docker compose up -d postgres
```
> **Catatan**: Container PostgreSQL dikonfigurasi pada port `5433` (`5433:5432`) untuk mencegah konflik dengan instansi PostgreSQL bawaan sistem host. Container akan otomatis mengeksekusi skema tabel DDL (`stockflow/migrations/000001_create_tables.up.sql`) dan memuat data awal realistis (`stockflow/migrations/000002_seed_data.up.sql`) berisi 15 produk mini ERP, mutasi stok awal, serta 2 contoh pesanan penjualan.

Periksa status container:
```bash
docker compose ps
```

---

#### Langkah 2: Jalankan Backend Service (Go)
Buka terminal baru:
```bash
cd stockflow/backend
go run cmd/server/main.go
```
> Konfigurasi default terhubung ke `postgres://postgres:postgres@localhost:5433/stockflow?sslmode=disable`.  
> Backend REST API akan aktif mendengarkan di: `http://localhost:8080`.  
> Cek health endpoint: `curl http://localhost:8080/api/health`

---

#### Langkah 3: Jalankan Frontend App (React + TypeScript)
Buka terminal baru:
```bash
cd stockflow/frontend
npm install
npm run dev
```
Buka peramban di: **`http://localhost:5173`**. Frontend sudah terkonfigurasi dengan Vite Proxy yang secara otomatis meneruskan seluruh panggilan `/api/*` ke backend Go di port `8080`.

---

## 2. Dokumentasi API & Contoh Perintah `curl`

Seluruh error bisnis dan validasi dikembalikan dalam format amplop terstandarisasi (*unified error envelope*):
```json
{
  "error": {
    "code": "ERROR_CODE_NAME",
    "message": "Penjelasan error yang dapat dibaca manusia",
    "sku": "SKU-OPTIONAL",
    "available": 0
  }
}
```

### A. Katalog Produk & Mutasi Stok

#### 1. Mengambil Daftar Produk (dengan Pencarian & Pagination)
```bash
curl -X GET "http://localhost:8080/api/products?search=logitech&page=1&limit=10"
```

#### 2. Menambah Produk Baru
```bash
curl -X POST http://localhost:8080/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "sku": "KEY-V1MAX",
    "name": "Keychron V1 Max Wireless Custom Mechanical Keyboard",
    "price": 1350000
  }'
```

#### 3. Memperbarui Data Produk
```bash
curl -X PUT http://localhost:8080/api/products/1 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Logitech MX Master 3S Wireless Mouse (Graphite Edition)",
    "price": 1750000,
    "is_active": true
  }'
```

#### 4. Menghapus Produk
```bash
curl -X DELETE http://localhost:8080/api/products/1
```
*Skenario Error 409 (Proteksi Audit Trail)*:
Jika produk sudah pernah memiliki riwayat mutasi stok, sistem menolak penghapusan dengan respons:
```json
{
  "error": {
    "code": "PRODUCT_HAS_HISTORY",
    "message": "Produk tidak dapat dihapus karena memiliki riwayat pergerakan stok (audit trail dilindungi)"
  }
}
```

#### 5. Penyesuaian Stok Manual (Adjust Stock)
- **Stok Masuk (Inbound)**:
```bash
curl -X POST http://localhost:8080/api/products/1/stock \
  -H "Content-Type: application/json" \
  -d '{
    "type": "in",
    "qty": 10,
    "note": "Restok dari supplier resmi"
  }'
```
- **Stok Keluar (Outbound)**:
```bash
curl -X POST http://localhost:8080/api/products/1/stock \
  -H "Content-Type: application/json" \
  -d '{
    "type": "out",
    "qty": 5,
    "note": "Pengambilan sampel promosi"
  }'
```

#### 6. Melihat Riwayat Mutasi Produk
```bash
curl -X GET http://localhost:8080/api/products/1/movements
```

---

### B. Transaksi Pesanan Penjualan (Sales Orders)

#### 1. Membuat Pesanan Baru (Happy Path & Dukungan Idempotency-Key)
```bash
curl -X POST http://localhost:8080/api/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: idem-order-20261028-001" \
  -d '{
    "customer": "PT Digital Pratama",
    "items": [
      { "sku": "LOGI-MXM3S", "qty": 2 },
      { "sku": "KEY-K2PRO", "qty": 1 }
    ]
  }'
```
> **Fitur Bonus Idempotency-Key**: Jika request diulang (*retry*) menggunakan `Idempotency-Key` yang sama (misal akibat koneksi jaringan terputus sebelum menerima respons), backend Go akan mendeteksi kunci tersebut dan mengembalikan record pesanan yang telah dibuat sebelumnya tanpa menduplikasi data atau memotong stok untuk kedua kalinya (*zero double-ordering guarantee*).


#### 2. Skenario Error Validasi Pre-flight (400 Bad Request)
- **SKU Tidak Dikenal**:
```bash
curl -X POST http://localhost:8080/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer": "Budi Santoso",
    "items": [{ "sku": "UNKNOWN-999", "qty": 1 }]
  }'
```
- **SKU Duplikat dalam Satu Order**:
```bash
curl -X POST http://localhost:8080/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer": "Budi Santoso",
    "items": [
      { "sku": "LOGI-MXM3S", "qty": 1 },
      { "sku": "LOGI-MXM3S", "qty": 2 }
    ]
  }'
```

#### 3. Skenario Error Stok Tidak Cukup (409 Conflict)
Ketika salah satu item meminta kuantitas melebihi stok fisik:
```bash
curl -X POST http://localhost:8080/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer": "PT Mega Sukses",
    "items": [
      { "sku": "BASEUS-BLADE-100W", "qty": 999 }
    ]
  }'
```
Respons backend:
```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Stok tidak mencukupi untuk SKU: BASEUS-BLADE-100W",
    "sku": "BASEUS-BLADE-100W",
    "available": 3
  }
}
```

#### 4. Mengambil Rincian Pesanan
```bash
curl -X GET http://localhost:8080/api/orders/1
```

#### 5. Membatalkan Pesanan (Cancel Order & Restorasi Stok)
```bash
curl -X POST http://localhost:8080/api/orders/1/cancel
```

---

### C. Laporan Rekapitulasi Penjualan Harian (Bonus Mini ERP)

#### Mengambil Ringkasan Penjualan Harian
```bash
curl -X GET "http://localhost:8080/api/reports/daily-sales?date=2026-10-28"
```
Respons backend:
```json
{
  "date": "2026-10-28",
  "total_orders": 12,
  "total_revenue": 750000,
  "total_items_sold": 20
}
```

---

## 3. Keputusan Desain Arsitektural & Trade-Offs

### A. Pencegahan Race Condition & Deadlock pada Pembuatan Order
- **Masalah**: Pola naif `SELECT stock` lalu `UPDATE stock = stock - qty` di kode aplikasi rentan terhadap *lost update* di bawah akses konkuren. Dua pesanan simultan yang masing-masing meminta sisa stok dapat mengakibatkan stok bernilai negatif (*overselling*).
- **Solusi yang Dipilih**: **Pessimistic Row Locking (`SELECT ... FOR UPDATE`) dengan Urutan Kunci Deterministik**.
  1. Seluruh SKU dalam permintaan diurutkan secara leksikografis (`sort.Strings(sortedSKUs)`) sebelum penguncian baris database dilakukan.
  2. Urutan konsisten ini memastikan dua transaksi paralel yang meminta pasangan produk yang sama (misal Transaksi A meminta [X, Y] dan Transaksi B meminta [Y, X]) tidak akan pernah mengalami saling tunggu melingkar (*circular wait / deadlock*).
  3. Pengurangan stok dilakukan dalam transaksi atomik yang sama. Ditambah lagi, database dilindungi oleh *hard safety net*: `CHECK (stock >= 0)`.

### B. Keputusan Penentuan `last_movement_at`
- **Pilihan Desain**: Diturunkan secara dinamis (*derived*) melalui `LEFT JOIN (SELECT product_id, MAX(created_at) AS last_movement_at FROM stock_movements GROUP BY product_id)` yang dioptimalkan dengan indeks komposit `idx_stock_movements_product_id` dan `idx_stock_movements_created_at`.
- **Rasionalisasi Trade-off**: Menjamin normalisasi basis data dan integritas data mutlak (*single source of truth*). Tidak ada risiko desinkronisasi data antara kolom tabel `products` dan riwayat riil tabel `stock_movements`.

### C. Integritas Finansial (Zero Float Money)
- Seluruh harga (`price`, `unit_price`, `total`) disimpan dalam bentuk bilangan bulat integer dalam mata uang Rupiah (`IDR`).
- Server memiliki kedaulatan mutlak (*server-side price authority*): klien dilarang mengirimkan harga satuan produk maupun total belanja untuk mencegah manipulasi harga dari sisi pengguna.

---

## 4. Pelaksanaan Pengujian Otomatis & Seeded Fault Proof

### Backend Test Suite (Go Concurrency & Atomicity)
```bash
cd stockflow/backend
go test -count=1 -v ./...
```
Hasil uji otomatis mencakup:
- `TestCreateOrder_HappyPath_Atomic`: Membuktikan kalkulasi harga server-side dan penulisan order items atomik.
- `TestCreateOrder_InsufficientStock_Rollback`: Membuktikan transaksi dibatalkan utuh (zero partial writes) saat 1 item overdraw.
- `TestCreateOrder_Concurrency_RaceCondition`: Simulasi 10 goroutine paralel berebut stok 5; tepat 5 sukses dan 5 menerima 409 `INSUFFICIENT_STOCK`, stok akhir tepat 0 (tidak pernah minus).
- `TestCancelOrder_RestoreStock_Atomic`: Membuktikan pengembalian stok saat pembatalan dan pencegahan double-cancellation.
- `TestCreateOrder_IdempotencyKey`: Membuktikan request ulang pesanan dengan kunci idempotensi tidak memotong stok ganda.
- `TestOrderHandler_GetDailySalesReport`: Membuktikan endpoint rekapitulasi penjualan harian mengembalikan status 200 dengan kalkulasi akurat.

### Frontend Test Suite (Vitest)
```bash
cd stockflow/frontend
npm test
```
**20 unit tests (100% PASS)** mencakup pemformatan mata uang IDR (`formatCurrencyIDR`), relative time (`formatRelativeTime`), metrik kalkulasi ERP (`calculateSummaryMetrics`), validasi formulir pencegahan SKU duplikat (`orderValidator`), penanganan pagination tabel (`pagination`), dan parser amplop error terstandarisasi (`client.test.ts`).

### Seeded Fault Test (Bukti Validitas Asersi)
Untuk membuktikan bahwa test suite tidak menghasilkan *false positive*, dilakukan uji kegagalan sengaja:
1. Melewatkan validasi arah mutasi stok di handler: suite test langsung mendeteksi kegagalan `FAIL: TestProductHandler_AdjustStock/Status_400_-_Type_mutasi_tidak_valid (expected 400, got 200)`.
2. Setelah guard validation diterapkan kembali, suite test kembali bernilai `PASS (ok, 100%)`. Hal ini membuktikan bahwa asersi pengujian benar-benar menguji logika bisnis secara nyata.

---

## 5. Fitur Bonus yang Telah Diimplementasikan & Rencana Masa Depan

### Fitur Bonus yang Telah Selesai:
1. **Dukungan Idempotency-Key pada `POST /api/orders`**: Memastikan network retries tidak pernah melakukan double-order dengan tabel `idempotency_keys` dalam transaksi atomik.
2. **Rekapitulasi Penjualan Harian (`GET /api/reports/daily-sales?date=`)**: Endpoint server-side report yang terhubung langsung dengan kartu metrik ke-5 di antarmuka Dasbor Mini ERP.
3. **Full Stack Multi-Container Docker Compose**: Menyediakan `backend/Dockerfile` dan `frontend/Dockerfile` + Nginx proxy untuk menjalankan seluruh sistem dengan satu perintah `docker compose up -d --build`.
4. **UX Craftsmanship & Anti-UI-Slop**: Skeleton loading placeholders, debounce pencarian 300ms, modal konfirmasi pencegah klik tidak sengaja, dan highlight visual merah pada SKU yang gagal saat 409.

### Rencana Peningkatan Masa Depan (*What Would You Do Next*):
1. **TTL Caching & Redis Integration**: Memindahkan penyimpanan token idempotensi ke Redis dengan masa kedaluwarsa 24 jam untuk beban transaksi yang lebih masif.
2. **Sistem Webhook Pemenuhan Gudang**: Mengirimkan event `order.created` dan `order.cancelled` secara asinkron ke sistem logistik pihak ketiga (3PL / WMS).
3. **Multi-Location Warehouse**: Memperluas skema data untuk mendukung manajemen inventaris multi-gudang (multi-warehouse rack & bin tracking).


---

## 6. Catatan Waktu Pengerjaan (*Honest Hours Spent*)

| Fase Pengerjaan | Waktu | Fokus Rekayasa |
| :--- | :--- | :--- |
| **Fase 1: Arsitektur & Database** | 1.0 jam | Analisis brief PDF, perancangan DDL skema, indeks, migrasi, dan seed data realistis. |
| **Fase 2: Backend Go & Concurrency** | 2.5 jam | Implementasi Clean Architecture, pessimistic row-locking, transaksi ACID, dan router REST API. |
| **Fase 3: Automated Testing & Race Proof** | 1.0 jam | Pengujian rollback atomik dan simulasi goroutine konkuren dengan `go test -race`. |
| **Fase 4: Frontend React + TypeScript** | 2.0 jam | Scaffolding Vite, client API dengan envelope parser, 5 alur layar, dan 6 status interaksi UI. |
| **Fase 5: Integrasi & Dokumentasi** | 0.5 jam | Docker Compose quickstart, curl verification, dan penyusunan README komprehensif. |
| **Total Waktu Terfokus** | **7.0 jam** | Sesuai batas rekomendasi penugasan (6–8 jam). |
