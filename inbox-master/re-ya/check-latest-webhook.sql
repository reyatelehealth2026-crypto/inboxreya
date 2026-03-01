-- ตรวจสอบ webhook ล่าสุดที่เพิ่งเข้ามา

-- 1. Webhook ล่าสุด 10 รายการ
SELECT 
    id,
    delivery_id,
    event_type,
    status,
    processed_at,
    order_id,
    JSON_UNQUOTE(JSON_EXTRACT(payload, '$.order_name')) as order_name,
    JSON_UNQUOTE(JSON_EXTRACT(payload, '$.customer.name')) as customer_name,
    line_user_id
FROM odoo_webhooks_log
ORDER BY processed_at DESC
LIMIT 10;

-- 2. นับ webhooks วันนี้
SELECT 
    'วันนี้' as period,
    COUNT(*) as total,
    COUNT(CASE WHEN status = 'success' THEN 1 END) as success,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
    MAX(processed_at) as latest
FROM odoo_webhooks_log
WHERE DATE(processed_at) = CURDATE();

-- 3. Webhook ที่เข้ามาใน 5 นาทีล่าสุด
SELECT 
    id,
    delivery_id,
    event_type,
    status,
    processed_at,
    TIMESTAMPDIFF(SECOND, processed_at, NOW()) as seconds_ago
FROM odoo_webhooks_log
WHERE processed_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
ORDER BY processed_at DESC;

-- 4. ตรวจสอบ delivery_id ที่เพิ่งเข้ามา
SELECT 
    delivery_id,
    event_type,
    status,
    processed_at
FROM odoo_webhooks_log
WHERE delivery_id = 'wh_8f52248570cb4efc';
