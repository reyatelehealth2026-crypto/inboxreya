-- ตรวจสอบ Webhooks ที่ล้มเหลว (Failed)
-- รันใน phpMyAdmin หรือ MySQL client

-- 1. นับจำนวน webhooks ที่ล้มเหลวทั้งหมด
SELECT 
    'ทั้งหมด' as ช่วงเวลา,
    COUNT(*) as จำนวน_failed,
    COUNT(DISTINCT event_type) as จำนวน_event_types,
    COUNT(DISTINCT order_id) as จำนวน_orders_ที่มีปัญหา
FROM odoo_webhooks_log
WHERE status = 'failed';

-- 2. นับจำนวน webhooks ที่ล้มเหลววันนี้
SELECT 
    'วันนี้' as ช่วงเวลา,
    COUNT(*) as จำนวน_failed,
    COUNT(DISTINCT event_type) as จำนวน_event_types,
    COUNT(DISTINCT order_id) as จำนวน_orders_ที่มีปัญหา
FROM odoo_webhooks_log
WHERE status = 'failed'
  AND DATE(processed_at) = CURDATE();

-- 3. นับจำนวน webhooks ที่ล้มเหลว 7 วันล่าสุด
SELECT 
    '7 วันล่าสุด' as ช่วงเวลา,
    COUNT(*) as จำนวน_failed,
    COUNT(DISTINCT event_type) as จำนวน_event_types,
    COUNT(DISTINCT order_id) as จำนวน_orders_ที่มีปัญหา
FROM odoo_webhooks_log
WHERE status = 'failed'
  AND processed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY);

-- 4. รายละเอียด webhooks ที่ล้มเหลว (50 รายการล่าสุด)
SELECT 
    id,
    delivery_id,
    event_type,
    status,
    order_id,
    processed_at as เวลา,
    JSON_UNQUOTE(JSON_EXTRACT(payload, '$.order_name')) as order_name,
    JSON_UNQUOTE(JSON_EXTRACT(payload, '$.customer.name')) as customer_name,
    error_message
FROM odoo_webhooks_log
WHERE status = 'failed'
ORDER BY processed_at DESC
LIMIT 50;

-- 5. สรุปตาม event_type ที่ล้มเหลวบ่อย
SELECT 
    event_type,
    COUNT(*) as จำนวน_failed,
    GROUP_CONCAT(DISTINCT SUBSTRING(error_message, 1, 100) SEPARATOR ' | ') as ตัวอย่าง_error
FROM odoo_webhooks_log
WHERE status = 'failed'
GROUP BY event_type
ORDER BY จำนวน_failed DESC;

-- 6. สรุปตาม error_message ที่พบบ่อย
SELECT 
    SUBSTRING(error_message, 1, 200) as error_message_สั้น,
    COUNT(*) as จำนวน,
    GROUP_CONCAT(DISTINCT event_type SEPARATOR ', ') as event_types,
    MIN(processed_at) as เกิดครั้งแรก,
    MAX(processed_at) as เกิดล่าสุด
FROM odoo_webhooks_log
WHERE status = 'failed'
  AND error_message IS NOT NULL
  AND error_message != ''
GROUP BY SUBSTRING(error_message, 1, 200)
ORDER BY จำนวน DESC
LIMIT 20;

-- 7. ตรวจสอบ webhooks ที่ล้มเหลววันที่ 15-16 ก.พ. 2026
SELECT 
    DATE(processed_at) as วัน,
    COUNT(*) as จำนวน_failed,
    COUNT(DISTINCT event_type) as จำนวน_event_types,
    COUNT(DISTINCT order_id) as จำนวน_orders
FROM odoo_webhooks_log
WHERE status = 'failed'
  AND DATE(processed_at) BETWEEN '2026-02-15' AND '2026-02-16'
GROUP BY วัน;

-- 8. รายละเอียด webhooks ที่ล้มเหลววันที่ 15-16 ก.พ. 2026
SELECT 
    id,
    delivery_id,
    event_type,
    status,
    order_id,
    processed_at as เวลา,
    JSON_UNQUOTE(JSON_EXTRACT(payload, '$.order_name')) as order_name,
    JSON_UNQUOTE(JSON_EXTRACT(payload, '$.customer.name')) as customer_name,
    error_message
FROM odoo_webhooks_log
WHERE status = 'failed'
  AND DATE(processed_at) BETWEEN '2026-02-15' AND '2026-02-16'
ORDER BY processed_at DESC;

-- 9. สรุป Success Rate ทั้งหมด
SELECT 
    COUNT(*) as total_webhooks,
    COUNT(CASE WHEN status = 'success' THEN 1 END) as success,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
    ROUND(COUNT(CASE WHEN status = 'success' THEN 1 END) * 100.0 / COUNT(*), 2) as success_rate_percent
FROM odoo_webhooks_log;

-- 10. สรุปตามวัน (7 วันล่าสุด)
SELECT 
    DATE(processed_at) as วัน,
    COUNT(*) as total,
    COUNT(CASE WHEN status = 'success' THEN 1 END) as success,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
    ROUND(COUNT(CASE WHEN status = 'success' THEN 1 END) * 100.0 / COUNT(*), 2) as success_rate
FROM odoo_webhooks_log
WHERE processed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY วัน
ORDER BY วัน DESC;
