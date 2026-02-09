-- Migration: Inbox Feature Parity Upgrade
-- Description: Add tables for auto-reply rules, quick reply templates, customer segments, 
--              broadcast messages, rich menus, ghost drafts, image analysis, scheduled messages, and SLA tracking
-- Date: 2025-01-26

-- Quick Reply Templates (Note: auto_reply_rules already exists in schema)
CREATE TABLE IF NOT EXISTS quick_reply_templates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  line_account_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(100),
  shortcuts JSON,
  variables JSON,
  usage_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_line_account (line_account_id),
  INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Customer Segments
CREATE TABLE IF NOT EXISTS customer_segments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  line_account_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  criteria JSON NOT NULL,
  customer_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_line_account (line_account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Broadcast Messages (Note: broadcast_messages table already exists, but with different schema)
-- We'll create a new table for the upgraded version
CREATE TABLE IF NOT EXISTS broadcast_messages_v2 (
  id INT PRIMARY KEY AUTO_INCREMENT,
  line_account_id INT NOT NULL,
  content TEXT NOT NULL,
  media_url VARCHAR(500),
  target_segment_id INT,
  scheduled_at TIMESTAMP NULL,
  sent_at TIMESTAMP NULL,
  total_recipients INT DEFAULT 0,
  delivered_count INT DEFAULT 0,
  read_count INT DEFAULT 0,
  status ENUM('draft', 'scheduled', 'sending', 'sent', 'failed') DEFAULT 'draft',
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_line_account (line_account_id),
  INDEX idx_status (status),
  INDEX idx_scheduled (scheduled_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rich Menus
CREATE TABLE IF NOT EXISTS rich_menus (
  id INT PRIMARY KEY AUTO_INCREMENT,
  line_account_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  rich_menu_id VARCHAR(255),
  layout JSON NOT NULL,
  image_url VARCHAR(500),
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_line_account (line_account_id),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Note: conversation_assignments table already exists in schema with different structure
-- We'll create conversation_assignees for multi-assignee support
CREATE TABLE IF NOT EXISTS conversation_assignees (
  id INT PRIMARY KEY AUTO_INCREMENT,
  conversation_id INT NOT NULL,
  assignee_id INT NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  assigned_by INT,
  UNIQUE KEY unique_assignment (conversation_id, assignee_id),
  INDEX idx_conversation (conversation_id),
  INDEX idx_assignee (assignee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ghost Drafts
CREATE TABLE IF NOT EXISTS ghost_drafts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  conversation_id INT NOT NULL,
  content TEXT NOT NULL,
  tone VARCHAR(50),
  confidence DECIMAL(3,2),
  context JSON,
  was_accepted BOOLEAN DEFAULT FALSE,
  was_edited BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_conversation (conversation_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Image Analysis Results
CREATE TABLE IF NOT EXISTS image_analysis_results (
  id INT PRIMARY KEY AUTO_INCREMENT,
  message_id INT NOT NULL,
  analysis_type ENUM('symptom', 'drug', 'prescription') NOT NULL,
  results JSON NOT NULL,
  confidence DECIMAL(3,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_message (message_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Scheduled Messages
CREATE TABLE IF NOT EXISTS scheduled_messages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  conversation_id INT NOT NULL,
  content TEXT NOT NULL,
  scheduled_at TIMESTAMP NOT NULL,
  sent_at TIMESTAMP NULL,
  status ENUM('pending', 'sent', 'cancelled', 'failed') DEFAULT 'pending',
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_conversation (conversation_id),
  INDEX idx_scheduled (scheduled_at),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- SLA Tracking
CREATE TABLE IF NOT EXISTS sla_tracking (
  id INT PRIMARY KEY AUTO_INCREMENT,
  conversation_id INT NOT NULL,
  sla_threshold_minutes INT NOT NULL,
  started_at TIMESTAMP NOT NULL,
  deadline_at TIMESTAMP NOT NULL,
  responded_at TIMESTAMP NULL,
  is_breached BOOLEAN DEFAULT FALSE,
  INDEX idx_conversation (conversation_id),
  INDEX idx_deadline (deadline_at),
  INDEX idx_breached (is_breached)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
