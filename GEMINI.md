# Project Rules & Engineering Guidelines: STOCKFLOW — INVENTORY & SALES (MINI ERP MODULE)

> **Core Philosophy: Monozukuri & Principal Product Engineering Excellence**  
> Sistem ini dikembangkan untuk **Technical Test / Take-Home Practical Assignment: Software Engineer (Full-Stack)** dengan produk **StockFlow — Inventory & Sales (mini ERP module)**.  
> Standar rekayasa yang diwajibkan adalah **Product Engineer berstandar Staff/Principal**: mengutamakan **Data Safety under Concurrency** (integritas data mutlak tanpa race condition), **Cross-Stack Error Handling** yang transparan hingga ke antarmuka pengguna, arsitektur kode bersih (**Clean Architecture & Idiomatic Go**), **Strict TypeScript & Anti-UI-Slop** pada frontend, serta eksekusi pengujian otomatis yang terbukti kebenarannya (**Proven Correctness via `go test -race` & Vitest**).

---

## 1. Konteks Domain & Ekosistem Teknologi (System Landscape)

1. **Tech Stack & Arsitektur Sistem**:
   - **Backend (`backend/`)**: Golang (Go 1.22+), PostgreSQL 15+, database driver/toolkit (`pgx` atau `database/sql` + router idiomatic seperti `chi` atau `net/http`), pengujian konkuren bawaan (`go test -race`).
   - **Frontend (`frontend/`)**: React 18+, TypeScript (Strict Mode, `noImplicitAny`), Vite, Tailwind CSS, Lucide Icons, Vitest test runner.
   - **Infrastruktur (`docker-compose.yml`)**: PostgreSQL dengan migrasi skema dan seed data otomatis; runnable dalam waktu $\le 5$ menit.
   - **Aturan Mutlak Tanpa Kompromi**:
     - Frontend **WAJIB** mengonsumsi REST API Go yang nyata (*real API*).
     - **DILARANG KERAS** menggunakan data mock/stub pada produk akhir (*final deliverable*).
     - Tidak ada perhitungan uang bertipe float: seluruh harga dan nilai uang wajib berformat integer dalam mata uang Rupiah (`IDR`).

2. **Repository Layout Standar (Wajib)**:
   ```text
   stockflow/
   ├── backend/            # Go service (cmd/server/main.go, internal/handler, internal/service, internal/repository, internal/domain)
   ├── frontend/           # React + TypeScript (Vite: src/components, src/pages, src/api, src/types, src/hooks)
   ├── docker-compose.yml  # PostgreSQL container + migration + seed data (bonus: backend & frontend containerized)
   └── README.md           # Quickstart (<= 5 menit), curl examples, arsitektur, trade-offs, jam pengerjaan jujur
   ```

3. **5 Pilar Domain Immersion: Warehouse & Mini-ERP Operation**:
   - **The Product**: StockFlow — modul inventory & sales order real-time yang digunakan supervisor gudang untuk mengelola katalog produk, penyesuaian stok manual (in/out), dan pencatatan transaksi pesanan penjualan (*sales order*).
   - **The Core Value**: Kepastian ketersediaan stok fisik (*stock integrity*). Mencegah *overselling*, pesanan hantu (*phantom inventory*), dan ketidaksinkronan data ketika beberapa kasir/supervisor membuat order secara bersamaan.
   - **The Users**: Supervisor gudang dan staf operasional yang membutuhkan kecepatan input data, visibilitas stok rendah (*low-stock warning*), riwayat mutasi (*audit trail*), serta pesan error bisnis yang langsung dapat ditindaklanjuti.
   - **The Financial & Operational Risk**: Jika stok minus akibat race condition, pengiriman barang gagal, reputasi toko rusak, dan pembukuan finansial gudang menjadi tidak akuntabel.

---

## 2. Kontrak Data Model & REST API (API Contract Specification)

### A. Skema Basis Data PostgreSQL (Baseline Data Model)
```sql
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    price INTEGER NOT NULL CHECK (price >= 0), -- IDR, integer: no float money
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE stock_movements (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id),
    type TEXT NOT NULL CHECK (type IN ('in', 'out')),
    qty INTEGER NOT NULL CHECK (qty > 0),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sales_orders (
    id SERIAL PRIMARY KEY,
    customer TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED', 'CANCELLED')),
    total INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    cancelled_at TIMESTAMPTZ
);

CREATE TABLE sales_order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES sales_orders(id),
    sku TEXT NOT NULL REFERENCES products(sku),
    qty INTEGER NOT NULL CHECK (qty > 0),
    unit_price INTEGER NOT NULL
);
```

### B. Spesifikasi REST API & Format Error Envelope
Seluruh error bisnis dan validasi **WAJIB** dikembalikan dalam format amplop terstandarisasi (*unified error envelope*):
```json
{
  "error": {
    "code": "ERROR_CODE_NAME",
    "message": "Human readable explanation",
    "sku": "SKU-OPTIONAL",
    "available": 0
  }
}
```

| Method | Path | Status | Spesifikasi & Error Handling |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/products?search=&page=&limit=` | `200` | `{data: [...], page, limit, total}`. Filter pencarian case-insensitive pada `sku` atau `name`. Setiap objek produk menyertakan `last_movement_at` (ISO string atau null). |
| `POST` | `/api/products` | `201` | Validasi input: `sku` wajib & unik, `name` wajib, `price >= 0` integer. Format salah $\to$ `400`. Konflik SKU $\to$ `409 {"error":{"code":"SKU_EXISTS"}}`. |
| `PUT` | `/api/products/{id}` | `200` | Update nama, harga, status aktif. Jika ID tidak ditemukan $\to$ `404 {"error":{"code":"PRODUCT_NOT_FOUND"}}`. |
| `DELETE` | `/api/products/{id}` | `204` / `409` | Menghapus produk. Jika produk memiliki riwayat mutasi $\to$ `409 {"error":{"code":"PRODUCT_HAS_HISTORY"}}`. Riwayat audit mutasi **tidak boleh dihapus**. |
| `POST` | `/api/products/{id}/stock` | `200` / `201` | Body: `{"type":"in"\|"out", "qty": n, "note":"..."}`. Jika *overdraw* (qty > stock saat tipe `out`) $\to$ `409 {"error":{"code":"INSUFFICIENT_STOCK", "available": n}}`. Mutasi stok dan pergerakan tabel `stock_movements` wajib dieksekusi dalam satu transaksi atomik. |
| `GET` | `/api/products/{id}/movements` | `200` | Mengembalikan riwayat mutasi produk terurut dari yang terbaru (*newest first*): `{"data": [...]}`. |
| `POST` | `/api/orders` | `201` / `400` / `409` | Body: `{"customer":"...", "items":[{"sku":"...", "qty": n}]}`. Aturan ketat order creation berlaku (lihat Bagian 3). |
| `POST` | `/api/orders/{id}/cancel` | `200` / `409` | Membatalkan order dan mengembalikan (*restore*) stok seluruh item secara atomik. Jika order sudah berstatus `CANCELLED` $\to$ `409 {"error":{"code":"ORDER_ALREADY_CANCELLED"}}`. |
| `GET` | `/api/orders/{id}` | `200` / `404` | Mengembalikan detail order, item-item, status, unit price saat transaksi, dan total server-computed. |
| `GET` | `/api/reports/daily-sales?date=` | `200` | *(Bonus)* Rekapitulasi penjualan harian berdasarkan tanggal. |

---

## 3. Inti Rekayasa: Aturan Transaksi & Keamanan Konkurensi (Concurrency & Order Engine)

Aturan pembuatan pesanan (`POST /api/orders`) adalah pengujian terpenting (*the core of the test*):

1. **Validasi Komprehensif Pre-Flight (Status 400)**:
   - Validasi payload sebelum melakukan penulisan database: nama customer tidak boleh kosong, items tidak boleh kosong (`len(items) > 0`), kuantitas `qty <= 0` ditolak, SKU duplikat dalam satu order ditolak, dan SKU yang tidak terdaftar ditolak dengan pesan error deskriptif.
2. **Kedaulatan Finansial Server (Server-Side Price Authority)**:
   - `unit_price` dan `total` **wajib diambil dari tabel `products` saat transaksi berlangsung**. Klien dilarang mengirimkan harga satuan atau total belanja. Server mengkalkulasi total secara independen.
3. **Atomisitas Transaksional Transaksi Penuh (`ACID`)**:
   - Seluruh pengurangan stok dan penulisan order items dieksekusi dalam **satu database transaction (`tx.BeginTx`)**.
   - Jika satu item gagal atau stok tidak mencukupi, seluruh transaksi wajib di-`ROLLBACK` secara utuh. Tidak boleh ada mutasi atau order separuh jalan (*no partial writes*).
4. **Deteksi Insufficient Stock yang Presisi (Status 409)**:
   - Jika ada item yang stoknya kurang dari `qty` yang diminta $\to$ batalkan transaksi dan kirimkan respons:
     ```json
     {
       "error": {
         "code": "INSUFFICIENT_STOCK",
         "message": "Stock not sufficient for SKU: ABC-123",
         "sku": "ABC-123",
         "available": 5
       }
     }
     ```
5. **Perlindungan Anti-Race Condition di Bawah Beban Konkuren (Zero-Negative Stock Guarantee)**:
   - **DILARANG KERAS** menggunakan pola rentan `SELECT stock FROM products` lalu `UPDATE products SET stock = stock - qty` di kode aplikasi. Pola ini mengalami race condition (lost update).
   - **Strategi Wajib (Pilih salah satu atau gabungan)**:
     - **Opsi A (Pessimistic Row Locking)**: Lakukan `SELECT id, sku, price, stock FROM products WHERE sku IN (...) FOR UPDATE`. Agar tidak terjadi *deadlock* saat transaksi paralel, urutkan SKU secara konsisten (misal alfabetis atau urut ID) sebelum mengunci baris.
     - **Opsi B (Atomic Conditional UPDATE with Check)**:
       ```sql
       UPDATE products 
       SET stock = stock - $1 
       WHERE sku = $2 AND stock >= $1 
       RETURNING stock;
       ```
       Jika `rows affected == 0`, periksa ketersediaan saat itu dan lempar status 409.
   - Constraint database `CHECK (stock >= 0)` berfungsi sebagai dinding pertahanan lapis terakhir (*hard safety net*).

---

## 4. Alur Antarmuka Pengguna & Kualitas Frontend (Anti-UI-Slop & Craftsmanship)

Antarmuka dibangun dengan React + TypeScript (Vite) yang bersih, ergonomis, berfokus pada efisiensi kerja supervisor gudang:

1. **Daftar Halaman & Alur Pengguna (Prioritas Eksekusi)**:
   - **Products Page**: Tabel informasi lengkap (SKU, Nama, Harga terformat `Rp 1.234.567`, Stok, Status badge aktif/inaktif, Waktu mutasi terakhir misal *"2 jam yang lalu"* / relative time, dan Aksi).
     - Fitur Filter: Tabs/Dropdown (*All*, *Active*, *Inactive*, *Low stock $\le 10$*).
     - Pencarian real-time dengan debouncing (*useDebounce hook* minimal 300ms).
   - **Adjust Stock Modal**: Formulir arah mutasi (`Masuk` / `Keluar`), kuantitas (`integer > 0`), dan catatan (*note*).
     - Tombol submit wajib *disabled* saat mutasi sedang diproses.
     - **Krusial**: Jika backend mengembalikan 409 `INSUFFICIENT_STOCK`, antarmuka **WAJIB** menampilkan pesan error informatif beserta jumlah stok yang tersedia (`available: n`). Dilarang membiarkan error hanya tampak di console browser!
   - **Create Order Flow**: Dialog / form dinamis untuk memilih nama pelanggan dan memilih satu atau beberapa baris item (SKU & kuantitas).
     - Pada sukses: tampilkan pesanan yang berhasil beserta total harga kalkulasi server.
     - Pada status 409: beri sorotan visual merah (*highlight*) tepat pada baris SKU yang gagal dan tampilkan stok yang tersedia saat itu.
     - Pada status 400: tampilkan pesan validasi field yang jelas.
   - **Order Detail Page / Modal**: Menampilkan ringkasan pesanan, item, unit price, total, status (`CREATED` / `CANCELLED`), dan tombol Batalkan Pesanan (*Cancel Order*) dengan konfirmasi modal pencegah klik tak sengaja.
     - Setelah pesanan dibatalkan, stok pada daftar produk harus langsung diperbarui (*reactively refreshed*).
   - **Summary Cards (ERP Metrics)**:
     - 4 Kartu Metrik di bagian atas: Total Produk, Produk Aktif, Total Nilai Inventaris (IDR), dan Jumlah Produk Stok Rendah (*Low Stock $\le 10$*).
     - Metrik otomatis diperbarui setelah mutasi stok atau order baru dibuat.

2. **6 Kondisi Interaksi Wajib (The 6 Interaction States)**:
   - **Loading State**: Skeleton table rows dan animated placeholder yang nyaman di mata, bukan sekadar spinner polos.
   - **Empty State**: Ilustrasi/ikon ramah dengan ajakan bertindak (*"Belum ada produk terdaftar. Tambah produk pertama"* atau *"Tidak ada produk yang cocok dengan pencarian"*).
   - **Error State with Retry**: Tampilan humanis saat API backend terputus dengan tombol *"Coba Lagi"* (retry) yang benar-benar memicu re-fetch.
   - **Partial / Mutation State**: Indikator loading pada tombol aksi (*isSubmitting*) tanpa mengunci layar yang tidak perlu.
   - **Long Text / Extreme Value State**: Format rupiah standar Indonesia (`Intl.NumberFormat('id-ID', ...)`), penanganan nama produk panjang via truncation/tooltip.
   - **Responsive View**: Layout tabel adaptif dengan horizontal scroll rapi atau card-view untuk layar tablet/seluler.

3. **Standar Arsitektur Frontend**:
   - `src/api/client.ts`: Modul tunggal klien API yang mengelola `fetch`/`axios`, konfigurasi base URL, dan parsing seragam error envelope backend. Komponen dilarang keras merangkai URL HTTP secara ad-hoc.
   - `src/types/api.ts`: Sumber kebenaran tunggal (*single source of truth*) untuk tipe data domain (Product, StockMovement, Order, OrderItem, APIResponse, ErrorEnvelope). **Nol toleransi terhadap `any` pada data domain.**
   - Integrasi Backend: Pengaturan Vite Proxy (`vite.config.ts`) atau CORS middleware pada server Go terkonfigurasi dengan rapi.

---

## 5. Standar Rekayasa Pengujian (Testing Harness & Concurrency Proof)

Sistem wajib membuktikan kebenaran perilakunya (*proven correctness*) melalui pengujian otomatis:

1. **Backend Testing (Golang `testing` package)**:
   - **Test Insufficient Stock Rollback**: Uji skenario stok tidak cukup pada order multi-item; verifikasi bahwa transaksi dibatalkan, status 409 dikembalikan, dan **tidak ada satu baris pun data yang ditulis** ke tabel order maupun stock movement.
   - **Test Happy Path Atomic Transaction**: Verifikasi pembuatan order memotong stok dengan tepat, menulis detail order items, dan mencatat pergerakan stok.
   - **Test Concurrency (`go test -race`)**: Uji 10+ goroutine paralel yang berebut sisa stok terbatas (misal stok 5 diperebutkan 10 goroutine masing-masing meminta 1). Buktikan bahwa:
     - Tepat 5 goroutine berhasil dan 5 goroutine menerima 409 `INSUFFICIENT_STOCK`.
     - Stok akhir tepat 0 (tidak pernah minus).
     - Flag `-race` tidak mendeteksi data race apapun.
2. **Frontend Testing (Vitest)**:
   - Pengujian unit pada fungsi utilitas: kalkulasi ringkasan (*summary metrics*), pemformatan mata uang Rupiah, validasi formulir order (pencegahan SKU duplikat, kuantitas positif), dan parser amplop error API.
3. **Seeded Fault Test (Uji Validitas Asersi)**:
   - Lakukan pengujian kesalahan yang disengaja: ubah sementara logika guard stok (misal mengizinkan pemotongan tanpa pengecekan saldo), buktikan bahwa suite test gagal (*red*), lalu pulihkan kembali (*green*). Dokumentasikan momen ini dalam commit atau catatan teknis.

---

## 6. Prosedur Eksekusi & Quickstart ($\le 5$ Menit)

1. **Docker Compose & Database Initialization**:
   - Berkas `docker-compose.yml` harus siap pakai. Menjalankan perintah:
     ```bash
     docker compose up -d
     ```
     Wajib secara otomatis menginisialisasi container PostgreSQL, menjalankan migrasi DDL skema tabel, dan mengeksekusi seed data (minimal 12+ produk realistis dari berbagai kategori dan beberapa contoh pesanan).
2. **Local Run Scripts**:
   - Dokumentasikan instruksi jelas untuk menjalankan backend Go (`go run cmd/server/main.go`) dan frontend React (`npm install && npm run dev`).
   - *(Bonus)* Docker compose yang dapat mengangkat database, backend Go, dan frontend Vite sekaligus dalam satu perintah.
3. **Dokumentasi README.md**:
   - Langkah demi langkah instalasi dan verifikasi lokal.
   - Contoh perintah `curl` lengkap untuk seluruh endpoint API (termasuk skenario sukses dan skenario error 409).
   - Penjelasan keputusan desain arsitektural (misal alasan pemilihan strategi row-locking vs conditional update, dan keputusan pemilihan `last_movement_at`).
   - Area improvisasi masa depan (*what would you do next* jika memiliki waktu lebih banyak).
   - Catatan waktu pengerjaan yang jujur (*honest hours spent*).

---

## 7. Rubrik Evaluasi & Prioritas Penilaian

Sistem dievaluasi secara berjenjang berdasarkan hierarki berikut:

```text
[Prioritas 1: Kritis] Data Safety under Concurrency (Integritas Stok & Transaksi Atomik)
        │
        ▼
[Prioritas 2: Esensial] Cross-Stack Correctness (Error Envelope 409 Muncul di UI)
        │
        ▼
[Prioritas 3: Standar] Engineering Practices (Test Race Condition, Docker Compose, Git Commits, README)
        │
        ▼
[Prioritas 4: Nilai Tambah] Product Polish & Bonus Features (Idempotency, Daily Sales, Skeleton UX)
```

- **Data Safety Under Concurrency**: Apakah stok bisa menjadi negatif saat pesanan datang simultan? Jika ya, penugasan dianggap gagal pada kriteria inti.
- **Cross-Stack Correctness**: Apakah pesan kesalahan dari database diproses oleh Go dan disajikan secara jelas di layar React kepada user?
- **Engineering Practices**: Keberadaan tes otomatis, kebersihan arsitektur Go, tipe data TypeScript yang presisi, riwayat commit git berkala (*meaningful incremental commits* sepanjang pengerjaan, bukan 1 single dump commit).

---

## 8. Pelanggaran Fatal yang Mengakibatkan Diskualifikasi (Non-Negotiable Disqualifiers)

1. **Mengabaikan Concurrency Safety**: Melakukan transaksi stok dengan pola `SELECT lalu UPDATE` yang rentan race condition dan menghasilkan stok negatif.
2. **Menyembunyikan Error di Console**: Error 409 dari backend hanya dicetak melalui `console.error` atau `console.log` tanpa ditampilkan kepada pengguna di antarmuka.
3. **Menggunakan Data Mock/Stub pada Deliverable Akhir**: Frontend tidak terhubung secara riil dengan backend Go.
4. **Single Commit Dump**: Melakukan seluruh pengerjaan dalam satu commit raksasa di akhir waktu pengumpulan.
5. **Kualitas UI/UX Slop**: Antarmuka berantakan, tombol aksi tidak berfungsi, angka tanpa format mata uang, dan tidak ada penanganan loading/error state.
6. **Floating-Point Currency**: Menggunakan tipe data `float` atau `double` untuk nominal uang Rupiah.

---

## 9. Pemetaan Wajib Seluruh Skill yang Relevan (Skill Catalog Execution)

Dalam setiap fase implementasi dan analisis kode, asisten AI **WAJIB** secara proaktif menggunakan prinsip dan peran dari skill-skill berikut:

| Nama Skill | Peran & Ruang Lingkup Eksekusi Spesifik StockFlow |
| :--- | :--- |
| **`anti-ui-slop`** | Menghilangkan elemen visual dekoratif palsu, mencegah duplikasi tombol aksi (*action clutter*), memastikan pesan error 409 tampil terintegrasi di modal dan form order. |
| **`high-end-visual-design`** | Menghasilkan estetika mini-ERP modern bernuansa profesional, tipografi rapi (Inter / Plus Jakarta Sans), palet warna netral fungsional dengan aksen semantik (sukses, bahaya, peringatan stok rendah). |
| **`uiux-designer`** | Merancang alur pemilihan produk pada order form yang intuitif, visual highlight pada SKU yang gagal saat 409, tombol cancel order dengan konfirmasi modal, dan penanganan 6 status interaksi. |
| **`clean-code` & `clean-code-guard`** | Menjaga prinsip Clean Architecture pada Go (pemisahan handler, service/usecase, repository), penanganan error eksplisit (`if err != nil`), idiomatic context passing (`ctx context.Context`), dan struktur TypeScript tanpa `any`. |
| **`frontend-expert` & `frontend-ui-engineering`** | Membangun komponen modular React 18, TypeScript strict, isolasi modul API client (`client.ts`), debounced search hook (`useDebounce`), dan validasi input sisi klien sebelum submit. |
| **`api-builder`** | Merancang RESTful Go endpoints sesuai kontrak spesifikasi dokumen, status HTTP presisi (200, 201, 204, 400, 404, 409), serta amplop respons error terstandarisasi. |
| **`database-migration` & `database-security`** | Menyusun DDL PostgreSQL yang aman, index performa pada SKU, integrasi check constraints (`CHECK (stock >= 0)`), transaksi atomik `BEGIN ... COMMIT / ROLLBACK`, dan strategi row-locking (`FOR UPDATE`) terhindar dari deadlock. |
| **`debugger` & `awt-e2e-testing`** | Menulis dan memverifikasi pengujian backend Go (`go test -v -race`), pengujian unit frontend dengan Vitest, dan eksekusi skenario konkurensi ekstrem. |

---

## 10. Verifikasi Faktual & Komitmen Eksekusi

- **Verifikasi Sebelum Asumsi**: Setiap perubahan kode wajib disesuaikan dengan kontrak API dokumen teknis `software-engineer-fullstack.pdf` dan diuji secara riil.
- **Bahasa & Nada**: Komunikasi teknis disampaikan dalam bahasa Indonesia yang profesional, lugas, presisi, berbasis bukti empiris (*deductive reasoning*), dan berorientasi pada standar rekayasa tingkat tinggi.
