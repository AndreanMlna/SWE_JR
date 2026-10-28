-- Migration 000002: Seed realistic mini ERP data for StockFlow
-- Minimal 15 produk realistis, mutasi stok awal, dan 2 contoh sales orders

-- 1. Insert 15 Realistic Products
INSERT INTO products (sku, name, price, stock, is_active, created_at) VALUES
('LOGI-MXM3S', 'Logitech MX Master 3S Wireless Mouse', 1699000, 45, TRUE, now() - INTERVAL '10 days'),
('KEY-K2PRO', 'Keychron K2 Pro Mechanical Keyboard', 1450000, 18, TRUE, now() - INTERVAL '9 days'),
('DELL-U2723QE', 'Dell UltraSharp 27 4K USB-C Hub Monitor', 9850000, 8, TRUE, now() - INTERVAL '8 days'), -- Low stock
('SONY-WH1000XM5', 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones', 4999000, 12, TRUE, now() - INTERVAL '8 days'),
('UGREEN-HUB6', 'UGREEN 6-in-1 USB-C Multiport Hub Adapter', 389000, 65, TRUE, now() - INTERVAL '7 days'),
('ANKER-737', 'Anker 737 Power Bank (PowerCore 24K 140W)', 1890000, 5, TRUE, now() - INTERVAL '7 days'), -- Low stock
('SAM-T7SHIELD-1TB', 'Samsung T7 Shield 1TB Portable Rugged SSD', 1750000, 24, TRUE, now() - INTERVAL '6 days'),
('BASEUS-BLADE-100W', 'Baseus Blade 100W Ultra-Thin Fast Charge Power Bank', 890000, 3, TRUE, now() - INTERVAL '6 days'), -- Low stock
('LOGI-C920PRO', 'Logitech C920 Pro HD 1080p Webcam', 1150000, 30, TRUE, now() - INTERVAL '5 days'),
('BENQ-SCREENBAR', 'BenQ ScreenBar Halo LED Monitor Light Bar', 2750000, 14, TRUE, now() - INTERVAL '5 days'),
('APPLE-MBA-M3', 'Apple MacBook Air 13-inch M3 Chip 16GB 512GB', 21499000, 4, TRUE, now() - INTERVAL '4 days'), -- Low stock
('ERGO-DESK-PRO', 'Ergowork Pro Dual Motor Electric Standing Desk', 4200000, 7, TRUE, now() - INTERVAL '3 days'), -- Low stock
('KBD-CLEAN-KIT', '7-in-1 Multi-Function Electronics Cleaning Brush Kit', 65000, 120, TRUE, now() - INTERVAL '3 days'),
('GENERIC-HDMI-V1', 'Generic HDMI 1.4 Cable 1.5m (Discontinued EOL)', 25000, 0, FALSE, now() - INTERVAL '20 days'), -- Inactive & 0 stock
('OLD-OPTICAL-MOUSE', 'Classic PS/2 Wired Optical Mouse (Legacy Stock)', 45000, 15, FALSE, now() - INTERVAL '15 days') -- Inactive
ON CONFLICT (sku) DO NOTHING;

-- 2. Insert Initial Stock Inbound Movements (Audit Trail)
INSERT INTO stock_movements (product_id, type, qty, note, created_at)
SELECT id, 'in', stock, 'Initial warehouse inventory intake', created_at + INTERVAL '1 hour'
FROM products
WHERE stock > 0;

-- 3. Insert Sample Sales Order 1 (Status: CREATED)
INSERT INTO sales_orders (id, customer, status, total, created_at)
VALUES (1, 'PT Solusi Teknologi Nusantara', 'CREATED', 4848000, now() - INTERVAL '2 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO sales_order_items (order_id, sku, qty, unit_price)
VALUES 
(1, 'LOGI-MXM3S', 2, 1699000),
(1, 'KEY-K2PRO', 1, 1450000)
ON CONFLICT DO NOTHING;

-- Audit movement for Order 1
INSERT INTO stock_movements (product_id, type, qty, note, created_at)
SELECT id, 'out', 2, 'Sales Order #1 fulfillment', now() - INTERVAL '2 days'
FROM products WHERE sku = 'LOGI-MXM3S';

INSERT INTO stock_movements (product_id, type, qty, note, created_at)
SELECT id, 'out', 1, 'Sales Order #1 fulfillment', now() - INTERVAL '2 days'
FROM products WHERE sku = 'KEY-K2PRO';

-- 4. Insert Sample Sales Order 2 (Status: CANCELLED)
INSERT INTO sales_orders (id, customer, status, total, created_at, cancelled_at)
VALUES (2, 'CV Mandiri Perkasa', 'CANCELLED', 1890000, now() - INTERVAL '1 day', now() - INTERVAL '12 hours')
ON CONFLICT (id) DO NOTHING;

INSERT INTO sales_order_items (order_id, sku, qty, unit_price)
VALUES 
(2, 'ANKER-737', 1, 1890000)
ON CONFLICT DO NOTHING;

-- Audit movement for Order 2 (cancelled -> stock restored)
INSERT INTO stock_movements (product_id, type, qty, note, created_at)
SELECT id, 'out', 1, 'Sales Order #2 initial reservation', now() - INTERVAL '1 day'
FROM products WHERE sku = 'ANKER-737';

INSERT INTO stock_movements (product_id, type, qty, note, created_at)
SELECT id, 'in', 1, 'Sales Order #2 cancellation stock restoration', now() - INTERVAL '12 hours'
FROM products WHERE sku = 'ANKER-737';

-- Adjust sequence values to prevent duplicate key errors on future inserts
SELECT setval('products_id_seq', (SELECT MAX(id) FROM products));
SELECT setval('stock_movements_id_seq', (SELECT MAX(id) FROM stock_movements));
SELECT setval('sales_orders_id_seq', (SELECT MAX(id) FROM sales_orders));
SELECT setval('sales_order_items_id_seq', (SELECT MAX(id) FROM sales_order_items));
