-- Payment chase: turns the daily "ไล่ยอดชำระ" chat work into a reviewable queue.
-- Additive only. This DB is shared with the PHP app, so these are plain CREATE
-- TABLEs applied by hand (see prisma/migrations/README.md) — never `db push`.

-- One approved send. The drain cron walks queue rows belonging to a run and
-- stops/pauses the moment `status` changes, so pause is effective within a tick.
CREATE TABLE IF NOT EXISTS `payment_chase_runs` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `created_by` VARCHAR(100) NULL,
  `status` ENUM('running','paused','stopped','done') NOT NULL DEFAULT 'running',
  `total` INT(11) NOT NULL DEFAULT 0,
  `sent` INT(11) NOT NULL DEFAULT 0,
  `failed` INT(11) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `finished_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row per (order, round). The unique key is the replay guard: a bill can
-- never be chased twice in the same round even if the generator runs again.
CREATE TABLE IF NOT EXISTS `payment_chase_queue` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `run_id` INT(11) NULL,
  `order_id` INT(10) UNSIGNED NOT NULL,
  `order_name` VARCHAR(100) NULL,
  `chase_round` TINYINT(4) NOT NULL,
  `user_id` INT(11) NULL,
  `line_user_id` VARCHAR(100) NULL,
  `salesperson_name` VARCHAR(200) NULL,
  `order_date` DATETIME NULL,
  `amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `message` TEXT NOT NULL,
  `status` ENUM('draft','queued','sent','failed','skipped') NOT NULL DEFAULT 'draft',
  `error` VARCHAR(500) NULL,
  `sent_at` DATETIME NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_order_round` (`order_id`, `chase_round`),
  KEY `idx_status` (`status`),
  KEY `idx_run` (`run_id`, `status`),
  KEY `idx_salesperson` (`salesperson_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Customers a rep never wants chased (credit terms, handled offline, VIP).
-- Keyed on the CRM user id because that is what the send path addresses.
CREATE TABLE IF NOT EXISTS `payment_chase_exclusions` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `user_id` INT(11) NOT NULL,
  `reason` VARCHAR(255) NULL,
  `created_by` VARCHAR(100) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
