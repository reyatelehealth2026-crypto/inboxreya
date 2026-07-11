-- Adds AI promotion draft workflow for approval-gated LINE broadcasts.

CREATE TABLE `ai_promo_drafts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `line_account_id` INTEGER NOT NULL,
    `prompt` TEXT NOT NULL,
    `campaign_type` VARCHAR(40) NOT NULL DEFAULT 'promotion',
    `selected_products` JSON NOT NULL,
    `generated_copy` TEXT NOT NULL,
    `flex_json` JSON NOT NULL,
    `proposed_scheduled_at` DATETIME(0) NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'draft',
    `error_message` TEXT NULL,
    `review_notes` TEXT NULL,
    `edited_by` INTEGER NULL,
    `approved_by` INTEGER NULL,
    `approved_at` DATETIME(0) NULL,
    `created_broadcast_id` INTEGER NULL,
    `source` VARCHAR(40) NOT NULL DEFAULT 'manual',
    `product_source_url` TEXT NULL,
    `created_by` INTEGER NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    INDEX `idx_ai_promo_drafts_account_status`(`line_account_id`, `status`),
    INDEX `idx_ai_promo_drafts_schedule`(`proposed_scheduled_at`),
    INDEX `idx_ai_promo_drafts_broadcast`(`created_broadcast_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ai_promo_rules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `line_account_id` INTEGER NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `campaign_type` VARCHAR(40) NOT NULL DEFAULT 'promotion',
    `schedule` VARCHAR(120) NOT NULL,
    `product_filters` JSON NULL,
    `max_products` INTEGER NOT NULL DEFAULT 6,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `last_generated_at` DATETIME(0) NULL,
    `created_by` INTEGER NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    INDEX `idx_ai_promo_rules_account_enabled`(`line_account_id`, `enabled`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
