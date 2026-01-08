-- =============================================
-- 전체 스키마 마이그레이션
-- published_product -> shop_product 전환 및 불필요 컬럼 제거
--
-- 이 마이그레이션은 다음 변경사항을 포함합니다:
-- 1. shop_product 테이블 생성 (published_product 대체)
-- 2. channel_product 테이블 생성 (채널별 상품 발행 관리)
-- 3. workflow_step_log 테이블 생성 (자동화 파이프라인 단계별 추적)
-- 4. workflow_log에 current_step 컬럼 추가
-- 5. published_product 테이블 삭제
-- =============================================

-- =============================================
-- PART 1: 새 테이블 생성
-- =============================================

-- shop_product 테이블 생성
CREATE TABLE IF NOT EXISTS `shop_product` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `product_id` INT,
  `shop_id` INT NOT NULL,
  `published_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_product_id` (`product_id`),
  INDEX `idx_shop_id` (`shop_id`),
  UNIQUE KEY `uk_product_shop` (`product_id`, `shop_id`)
);

-- channel_product 테이블 생성
CREATE TABLE IF NOT EXISTS `channel_product` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `product_id` INT,
  `channel_id` INT NOT NULL,
  `post_key` VARCHAR(255),
  `is_active` BOOLEAN DEFAULT TRUE,
  `published_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_product_id` (`product_id`),
  INDEX `idx_channel_id` (`channel_id`),
  UNIQUE KEY `uk_product_channel` (`product_id`, `channel_id`)
);

-- workflow_step_log 테이블 생성 (자동화 파이프라인 단계별 추적)
CREATE TABLE IF NOT EXISTS `workflow_step_log` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `workflow_id` INT NOT NULL,
  `step_type` ENUM('COLLECTION', 'TRANSFORM', 'PRODUCT_CREATE', 'PUBLISH') NOT NULL,
  `step_order` INT NOT NULL,
  `status` ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
  `started_at` TIMESTAMP NULL,
  `completed_at` TIMESTAMP NULL,
  `total_items` INT NOT NULL DEFAULT 0,
  `processed_items` INT NOT NULL DEFAULT 0,
  `success_count` INT NOT NULL DEFAULT 0,
  `failed_count` INT NOT NULL DEFAULT 0,
  `details` LONGTEXT,
  `error_message` TEXT,
  INDEX `idx_workflow_id` (`workflow_id`),
  INDEX `idx_status` (`status`),
  UNIQUE KEY `uk_workflow_step` (`workflow_id`, `step_type`),
  CONSTRAINT `workflow_step_log_workflow_id_fkey` FOREIGN KEY (`workflow_id`) REFERENCES `workflow_log` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
);

-- =============================================
-- PART 2: 기존 테이블 수정
-- =============================================

-- workflow_log에 current_step 컬럼 추가 (이미 존재하면 무시)
SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'workflow_log' AND column_name = 'current_step');
SET @sql = IF(@col_exists = 0, "ALTER TABLE `workflow_log` ADD COLUMN `current_step` ENUM('COLLECTION', 'TRANSFORM', 'PRODUCT_CREATE', 'PUBLISH') NULL", 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =============================================
-- PART 3: 레거시 테이블 삭제
-- =============================================

DROP TABLE IF EXISTS `published_product`;
