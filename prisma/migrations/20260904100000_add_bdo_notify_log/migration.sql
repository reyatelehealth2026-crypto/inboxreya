-- BDO payment notifications, sent automatically instead of one rep click each.
-- Additive only. Applied by hand like the rest — never `prisma db push` here.

-- One row per BDO the sweep has decided on. The unique key on bdo_id is the
-- replay guard: a BDO can be notified once, no matter how often the sweep runs
-- or how many rows the webhook re-syncs.
--
-- `skipped` is a real outcome, not a failure: a BDO already notified by a rep
-- before this automation existed, or one outside the freshness window, is
-- recorded so the sweep never reconsiders it.
CREATE TABLE IF NOT EXISTS `bdo_notify_log` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `bdo_id` INT(11) NOT NULL,
  `bdo_name` VARCHAR(64) NULL,
  `partner_id` INT(11) NULL,
  `line_user_id` VARCHAR(64) NULL,
  `amount_total` DECIMAL(14,2) NULL,
  `status` ENUM('sent','failed','skipped') NOT NULL,
  `reason` VARCHAR(255) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_bdo` (`bdo_id`),
  KEY `idx_status_created` (`status`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The sweep looks up BDOs by created_at within a short window and by
-- payment_status; neither is covered by the existing single-column indexes.
CREATE INDEX `idx_bdo_status_created` ON `odoo_bdo_orders` (`payment_status`, `created_at`);
