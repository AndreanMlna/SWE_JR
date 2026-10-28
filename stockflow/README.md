# StockFlow — Inventory & Sales (Mini ERP Module)

> **Enterprise Full-Stack Implementation**  
> Dibangun dengan **Go 1.22+** (Clean Architecture), **PostgreSQL 15+** (ACID & Pessimistic Concurrency Guard), dan **React 18 + Strict TypeScript** (Vite + Tailwind CSS).

---

## 1. Quickstart ($\le 5$ Menit)

Sistem dirancang untuk siap dijalankan secara lokal dalam waktu kurang dari 5 menit menggunakan Docker Compose.

### Prasyarat
- [Docker & Docker Compose](https://www.docker.com/)
- [Go 1.22+](https://go.dev/) (opsional jika menjalankan backend lokal)
- [Node.js v18+](https://nodejs.org/) (untuk menjalankan frontend Vite)

### Langkah 1: Jalankan Basis Data PostgreSQL (Migrasi & Seed Otomatis)
Dari direktori `stockflow/` (atau root repositori), jalankan:
```bash
docker compose up -d
```
> **Catatan**: Container PostgreSQL akan otomatis mengeksekusi skema tabel DDL (`000001_create_tables.up.sql`) dan memuat data awal realistis (`000002_seed_data.up.sql`) berisi 15 produk mini ERP, mutasi stok awal, serta 2 contoh pesanan penjualan.

Periksa kesiapan database:
```bash
docker compose ps
```

---

### Langkah 2: Jalankan Backend Service (Go)
Buka terminal baru:
```bash
cd stockflow/backend
go run cmd/server/main.go
```
Backend REST API akan aktif mendengarkan di: `http://localhost:8080`.  
Cek health endpoint: `curl http://localhost:8080/api/health`

---

### Langkah 3: Jalankan Frontend App (React + TypeScript)
Buka terminal baru:
```bash
cd stockflow/frontend
npm install
npm run dev
```
Buka peramban di: `http://localhost:5173`. Frontend sudah terkonfigurasi dengan Vite Proxy yang secara otomatis meneruskan seluruh panggilan `/api/*` ke backend Go di port `8080`.

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
*Skenario Error 409 (SKU Konflik)*: Jika SKU sudah ada, mengembalikan:
```json
{
  "error": {
    "code": "SKU_EXISTS",
    "message": "SKU 'KEY-V1MAX' sudah terdaftar dalam sistem"
  }
}
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
*Skenario Error 409 (Stok Kurang)*: Jika `qty` melebihi stok yang ada saat tipe `out`:
```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Stok tidak mencukupi untuk penyesuaian keluar SKU 'LOGI-MXM3S'",
    "sku": "LOGI-MXM3S",
    "available": 45
  }
}
```

#### 6. Melihat Riwayat Mutasi Produk
```bash
curl -X GET http://localhost:8080/api/products/1/movements
```

---

### B. Transaksi Pesanan Penjualan (Sales Orders)

#### 1. Membuat Pesanan Baru (Happy Path)
```bash
curl -X POST http://localhost:8080/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer": "PT Digital Pratama",
    "items": [
      { "sku": "LOGI-MXM3S", "qty": 2 },
      { "sku": "KEY-K2PRO", "qty": 1 }
    ]
  }'
```

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
*Verifikasi Atomisitas*: **Tidak ada satu baris pun data** yang ditulis ke tabel `sales_orders` maupun `stock_movements`.

#### 4. Mengambil Rincian Pesanan
```bash
curl -X GET http://localhost:8080/api/orders/1
```

#### 5. Membatalkan Pesanan (Cancel Order & Restorasi Stok)
```bash
curl -X POST http://localhost:8080/api/orders/1/cancel
```
*Skenario Error 409 (Sudah Dibatalkan Sebelumnya)*:
```json
{
  "error": {
    "code": "ORDER_ALREADY_CANCELLED",
    "message": "Pesanan #1 sudah dibatalkan sebelumnya"
  }
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
- **Rasionalisasi Trade-off**:
  - *Kelebihan*: Menjamin normalisasi basis data dan integritas data mutlak (*single source of truth*). Tidak ada risiko desinkronisasi data antara kolom tabel `products` dan riwayat riil tabel `stock_movements`.
  - *Trade-off*: Beban komputasi agregasi saat kueri, yang telah dimitigasi secara penuh melalui pengindeksan b-tree pada foreign key dan pagination limit.

### C. Integritas Finansial (Zero Float Money)
- Seluruh harga (`price`, `unit_price`, `total`) disimpan dalam bentuk bilangan bulat integer dalam mata uang Rupiah (`IDR`).
- Server memiliki kedaulatan mutlak (*server-side price authority*): klien dilarang mengirimkan harga satuan produk maupun total belanja untuk mencegah manipulasi harga dari sisi pengguna.

---

## 4. Pelaksanaan Pengujian Otomatis

### Backend Test Suite (Go Concurrency & Atomicity)
Jalankan pengujian backend lengkap dengan deteksi race condition:
```bash
cd stockflow/backend
go test -v -race ./...
```

Pengujian mencakup:
1. **Rollback saat Stok Kurang**: Memverifikasi bahwa ketika salah satu item dalam multi-item order melebihi stok, seluruh transaksi di-rollback secara penuh dan tidak ada data parsial yang tersisa.
2. **Happy Path Atomic Order**: Memverifikasi pemotongan stok tepat, penulisan order items dengan harga satuan server, dan pembuatan audit trail mutasi.
3. **Extreme Concurrency Test**: Menguji 10+ goroutine paralel berebut sisa 5 stok produk secara simultan; membuktikan bahwa tepat 5 goroutine berhasil, 5 goroutine menerima 409 `INSUFFICIENT_STOCK`, stok akhir tepat 0 (tidak minus), dan flag `-race` bernilai bersih tanpa data race.

### Frontend Test Suite (Vitest)
Jalankan pengujian unit frontend:
```bash
cd stockflow/frontend
npm test
```
Memverifikasi:
- Ketepatan format Rupiah Indonesia (`formatCurrencyIDR`).
- Konversi relative time bahasa Indonesia (`formatRelativeTime`).
- Kalkulasi akurat 4 ringkasan metrik inventaris (`calculateSummaryMetrics`).

---

## 5. Rencana Peningkatan Masa Depan (*What Would You Do Next*)
1. **Idempotency-Key Engine**: Menyimpan token `Idempotency-Key` di Redis atau tabel PostgreSQL dengan masa kedaluwarsa 24 jam untuk menjamin keamanan pengulangan request jaringan (*network retries*).
2. **Sistem Webhook Pemenuhan Gudang**: Mengirimkan event `order.created` dan `order.cancelled` secara asinkron ke sistem logistik pihak ketiga.
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
