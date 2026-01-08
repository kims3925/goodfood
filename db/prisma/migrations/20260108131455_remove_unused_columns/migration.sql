-- =============================================
-- 전체 스키마 마이그레이션
-- published_product -> shop_product/channel_product 전환
--
-- 이 마이그레이션은 다음 변경사항을 포함합니다:
-- 1. shop_product 테이블 생성 (published_product 대체)
-- 2. channel_product 테이블 생성 (채널별 상품 발행 관리)
-- 3. workflow_step_log 테이블 생성 (자동화 파이프라인 단계별 추적)
-- 4. workflow_log에 current_step 컬럼 추가
-- 5. published_product 데이터를 shop_product/channel_product로 마이그레이션
-- 6. published_product 참조 FK 삭제 후 테이블 삭제
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
  UNIQUE KEY `uk_product_shop` (`product_id`, `shop_id`),
  CONSTRAINT `fk_shop_product_product_id` FOREIGN KEY (`product_id`) REFERENCES `product` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_shop_product_shop_id` FOREIGN KEY (`shop_id`) REFERENCES `shop` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
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
  UNIQUE KEY `uk_product_channel` (`product_id`, `channel_id`),
  CONSTRAINT `fk_channel_product_product_id` FOREIGN KEY (`product_id`) REFERENCES `product` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_channel_product_channel_id` FOREIGN KEY (`channel_id`) REFERENCES `channel` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
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
-- PART 2.5: published_product 데이터 마이그레이션
-- shop_product 및 channel_product로 데이터 이전
--
-- 주의: 트랜잭션으로 데이터 마이그레이션을 보호합니다.
-- 실패 시 전체 롤백되어 데이터 일관성을 유지합니다.
-- =============================================

-- 데이터 마이그레이션 트랜잭션 시작
START TRANSACTION;

-- FK 체크 일시 비활성화 (데이터 마이그레이션 중 참조 무결성 문제 방지)
SET FOREIGN_KEY_CHECKS = 0;

-- shop_product로 데이터 이전 (shop_id가 있는 레코드)
-- ON DUPLICATE KEY UPDATE로 이미 존재하는 경우 updated_at 갱신
INSERT INTO `shop_product` (`id`, `user_id`, `product_id`, `shop_id`, `published_at`, `created_at`, `updated_at`)
SELECT
  `id`,
  `user_id`,
  `product_id`,
  `shop_id`,
  `published_at`,
  `created_at`,
  `updated_at`
FROM `published_product`
WHERE `shop_id` IS NOT NULL
ON DUPLICATE KEY UPDATE
  `updated_at` = VALUES(`updated_at`);

-- channel_product로 데이터 이전 (channel_id가 있는 레코드)
-- ON DUPLICATE KEY UPDATE로 이미 존재하는 경우 updated_at 갱신
INSERT INTO `channel_product` (`user_id`, `product_id`, `channel_id`, `post_key`, `is_active`, `published_at`, `created_at`, `updated_at`)
SELECT
  `user_id`,
  `product_id`,
  `channel_id`,
  `post_key`,
  `is_active`,
  `published_at`,
  `created_at`,
  `updated_at`
FROM `published_product`
WHERE `channel_id` IS NOT NULL
ON DUPLICATE KEY UPDATE
  `post_key` = VALUES(`post_key`),
  `is_active` = VALUES(`is_active`),
  `published_at` = VALUES(`published_at`),
  `updated_at` = VALUES(`updated_at`);

-- FK 체크 다시 활성화
SET FOREIGN_KEY_CHECKS = 1;

-- 데이터 마이그레이션 커밋 (실패 시 자동 롤백)
COMMIT;

-- =============================================
-- PART 3: 레거시 테이블 삭제
-- published_product 참조하는 FK 먼저 삭제 후 테이블 삭제
-- =============================================

-- cart_item FK 삭제 (존재하는 경우에만)
SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
  AND TABLE_NAME = 'cart_item'
  AND CONSTRAINT_NAME = 'cart_item_published_product_id_fkey');
SET @sql = IF(@fk_exists > 0, 'ALTER TABLE `cart_item` DROP FOREIGN KEY `cart_item_published_product_id_fkey`', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- order_item FK 삭제 (존재하는 경우에만)
SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
  AND TABLE_NAME = 'order_item'
  AND CONSTRAINT_NAME = 'order_item_published_product_id_fkey');
SET @sql = IF(@fk_exists > 0, 'ALTER TABLE `order_item` DROP FOREIGN KEY `order_item_published_product_id_fkey`', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- guest_order_item FK 삭제 (존재하는 경우에만)
SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
  AND TABLE_NAME = 'guest_order_item'
  AND CONSTRAINT_NAME = 'guest_order_item_published_product_id_fkey');
SET @sql = IF(@fk_exists > 0, 'ALTER TABLE `guest_order_item` DROP FOREIGN KEY `guest_order_item_published_product_id_fkey`', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- inquiry FK 삭제 (존재하는 경우에만)
SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
  AND TABLE_NAME = 'inquiry'
  AND CONSTRAINT_NAME = 'inquiry_published_product_id_fkey');
SET @sql = IF(@fk_exists > 0, 'ALTER TABLE `inquiry` DROP FOREIGN KEY `inquiry_published_product_id_fkey`', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- published_product 테이블 삭제
DROP TABLE IF EXISTS `published_product`;
