-- Migration Script: Move user_notes to customer_notes
-- Created at: 2026-01-30
-- Description: Copies data from the legacy 'user_notes' table to the 'customer_notes' table.

-- 1. Insert data from user_notes to customer_notes
-- Mapping:
-- user_notes.user_id    -> customer_notes.user_id
-- user_notes.note       -> customer_notes.content (and customer_notes.note if needed, but likely content is the main one now)
-- user_notes.created_by -> customer_notes.created_by AND customer_notes.admin_id
-- user_notes.created_at -> customer_notes.created_at AND customer_notes.updated_at
-- Defaults: is_pinned = 0

INSERT INTO `customer_notes` (
    `user_id`, 
    `content`,       -- New content column
    `note`,          -- Legacy note column, populated for backward compatibility if it exists/is used
    `created_by`, 
    `admin_id`,      -- Assuming created_by refers to admin_id
    `created_at`, 
    `updated_at`, 
    `is_pinned`
)
SELECT 
    un.`user_id`, 
    un.`note`,       -- Map note to content
    un.`note`,       -- Map note to note (redundancy for safety)
    COALESCE(un.`created_by`, 1), -- Map created_by to created_by, default to 1 if NULL
    COALESCE(un.`created_by`, 1), -- Map created_by to admin_id, default to 1 if NULL
    COALESCE(un.`created_at`, NOW()), -- Default to NOW() if NULL
    COALESCE(un.`created_at`, NOW()), -- Set updated_at to created_at
    0                -- Default is_pinned to false (0)
FROM `user_notes` un;

-- 2. Verify migration (Optional)
-- SELECT COUNT(*) FROM customer_notes;
