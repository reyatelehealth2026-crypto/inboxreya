-- ตรวจสอบข้อมูลทั้งหมดในตาราง odoo_webhooks_log
-- เพื่อดูว่ามีข้อมูลอะไรบ้าง

-- 1. นับจำนวน webhooks ทั้งหมด
SELECT 
    'ทั้งหมด' as ช่วงเวลา,
    COUNT(*) as จำนวน_webhooks,
    MIN(processed_at) as webhook_แรก,
    MAX(processed_at) as webhook_ล่าสุด
FROM odoo_webhooks_log;

-- 2. นับจำนวน webhooks แยกตามวัน (10 วันล่าสุด)
SELECT 
    DATE(processed_at) as วัน,
    COUNT(*) as จำนวน,
    COUNT(CASE WHEN status = 'success' THEN 1 END) as success,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
    COUNT(DISTINCT event_type) as event_types,
    COUNT(DISTINCT order_id) as orders
FROM odoo_webhooks_log
GROUP BY วัน
ORDER BY วัน DESC
LIMIT 10;

-- 3. แสดง webhooks 20 รายการล่าสุด
SELECT 
    id,
    processed_at,
    event_type,
    status,
    delivery_id,
    order_id,
    JSON_UNQUOTE(JSON_EXTRACT(payload, '$.order_name')) as order_name,
    JSON_UNQUOTE(JSON_EXTRACT(payload, '$.customer.name')) as customer_name
FROM odoo_webhooks_log
ORDER BY processed_at DESC
LIMIT 20;

-- 4. ตรวจสอบว่ามีข้อมูลในช่วงวันที่ 13-17 ก.พ. 2026 หรือไม่
SELECT 
    DATE(processed_at) as วัน,
    COUNT(*) as จำนวน
FROM odoo_webhooks_log
WHERE DATE(processed_at) BETWEEN '2026-02-13' AND '2026-02-17'
GROUP BY วัน
ORDER BY วัน;

-- 5. ตรวจสอบ event types ที่มี
SELECT 
    event_type,
    COUNT(*) as จำนวน,
    MIN(processed_at) as แรก,
    MAX(processed_at) as ล่าสุด
FROM odoo_webhooks_log
GROUP BY event_type
ORDER BY จำนวน DESC;
