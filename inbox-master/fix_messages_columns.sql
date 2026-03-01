-- Definitive Fix for Messages table schema mismatches causing 500 errors
-- This script ensures quote_token, reply_to_id, and is_read exist with correct types

SET @dbname = DATABASE();
SET @tablename = "messages";

-- 1. Add quote_token
SET @columnname = "quote_token";
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = @tablename AND table_schema = @dbname AND column_name = @columnname) > 0,
  "SELECT 1",
  "ALTER TABLE messages ADD COLUMN quote_token VARCHAR(255) DEFAULT NULL AFTER message_type"
));
PREPARE alterIfNoQuoteToken FROM @preparedStatement;
EXECUTE alterIfNoQuoteToken;
DEALLOCATE PREPARE alterIfNoQuoteToken;

-- 2. Add reply_to_id
SET @columnname = "reply_to_id";
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = @tablename AND table_schema = @dbname AND column_name = @columnname) > 0,
  "SELECT 1",
  "ALTER TABLE messages ADD COLUMN reply_to_id INT DEFAULT NULL AFTER quote_token"
));
PREPARE alterIfNoReplyToId FROM @preparedStatement;
EXECUTE alterIfNoReplyToId;
DEALLOCATE PREPARE alterIfNoReplyToId;

-- 3. Add is_read
SET @columnname = "is_read";
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = @tablename AND table_schema = @dbname AND column_name = @columnname) > 0,
  "SELECT 1",
  "ALTER TABLE messages ADD COLUMN is_read TINYINT(1) DEFAULT 0 AFTER reply_token"
));
PREPARE alterIfNoIsRead FROM @preparedStatement;
EXECUTE alterIfNoIsRead;
DEALLOCATE PREPARE alterIfNoIsRead;

-- 4. Add index for is_read if not exists
SET @query = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE table_name = @tablename AND table_schema = @dbname AND index_name = 'idx_is_read') > 0,
    "SELECT 1",
    "ALTER TABLE messages ADD INDEX idx_is_read (is_read)"
));
PREPARE addIndexIfRead FROM @query;
EXECUTE addIndexIfRead;
DEALLOCATE PREPARE addIndexIfRead;

-- Verify
SELECT "Schema update complete. Please check the columns in 'messages' table." as Status;
SHOW COLUMNS FROM messages;
