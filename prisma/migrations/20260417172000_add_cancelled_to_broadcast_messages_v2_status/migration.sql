ALTER TABLE broadcast_messages_v2
  MODIFY COLUMN status ENUM('draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled')
  NOT NULL DEFAULT 'draft';
