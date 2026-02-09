-- Migration: Add shortcuts and variables fields to quick_reply_templates
-- Description: Add shortcuts and variables columns for template variable substitution
-- Date: 2025-01-26

ALTER TABLE quick_reply_templates 
ADD COLUMN IF NOT EXISTS shortcuts TEXT AFTER category,
ADD COLUMN IF NOT EXISTS variables TEXT AFTER shortcuts;
