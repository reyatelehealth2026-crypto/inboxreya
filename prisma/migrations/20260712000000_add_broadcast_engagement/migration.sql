-- Adds broadcast engagement tracking (per-recipient opens/clicks/actions on a broadcast).
-- Matches model BroadcastEngagement in schema.prisma (was in schema with no migration).

CREATE TABLE `broadcast_engagement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `broadcast_id` INTEGER NOT NULL,
    `line_user_id` VARCHAR(50) NOT NULL,
    `line_user_pk_id` INTEGER NULL,
    `event_type` VARCHAR(40) NOT NULL,
    `action` VARCHAR(80) NULL,
    `payload` JSON NULL,
    `source` VARCHAR(20) NOT NULL,
    `user_agent` VARCHAR(255) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_bce_broadcast_event`(`broadcast_id`, `event_type`),
    INDEX `idx_bce_user_broadcast`(`line_user_id`, `broadcast_id`),
    INDEX `idx_bce_created`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
