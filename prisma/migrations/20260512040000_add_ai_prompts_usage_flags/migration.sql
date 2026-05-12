-- Phase 2 of the inboxreya stability + AI plan
-- Adds three tables that drive the sales-admin AI assists:
--   ai_prompts     — versioned prompt rows (one active per key)
--   ai_usage_logs  — per-call telemetry (tokens, cost, latency)
--   feature_flags  — kill-switch + role/canary allowlist

CREATE TABLE `ai_prompts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(50) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `body` TEXT NOT NULL,
    `model` VARCHAR(50) NOT NULL DEFAULT 'gemini-flash-latest',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ai_prompts_key_version_key`(`key`, `version`),
    INDEX `ai_prompts_key_is_active_idx`(`key`, `is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ai_usage_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `admin_user_id` INTEGER NOT NULL,
    `feature` VARCHAR(40) NOT NULL,
    `model` VARCHAR(50) NOT NULL,
    `prompt_tokens` INTEGER NOT NULL,
    `output_tokens` INTEGER NOT NULL,
    `cost_usd` DECIMAL(10, 6) NOT NULL,
    `latency_ms` INTEGER NOT NULL,
    `success` BOOLEAN NOT NULL,
    `error_code` VARCHAR(80) NULL,
    `conversation_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ai_usage_logs_admin_user_id_created_at_idx`(`admin_user_id`, `created_at`),
    INDEX `ai_usage_logs_feature_created_at_idx`(`feature`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `feature_flags` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(60) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `enabled_for_roles` VARCHAR(255) NULL,
    `enabled_for_user_ids` TEXT NULL,
    `metadata` JSON NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `feature_flags_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
