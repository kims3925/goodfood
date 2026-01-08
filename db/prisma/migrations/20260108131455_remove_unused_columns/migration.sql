-- =============================================
-- 전체 스키마 마이그레이션
-- published_product -> shop_product/channel_product 전환
--
-- !중요!: 실행 전 데이터 백업을 권장합니다.
-- 롤백 스크립트: rollback_20260108131455.sql (별도 제공)
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
  `deleted_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_product_id` (`product_id`),
  INDEX `idx_shop_id` (`shop_id`),
  INDEX `idx_deleted_at` (`deleted_at`),
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
  `deleted_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `legacy_published_product_id` INT NULL COMMENT '롤백용 원본 published_product ID',
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_product_id` (`product_id`),
  INDEX `idx_channel_id` (`channel_id`),
  INDEX `idx_deleted_at` (`deleted_at`),
  INDEX `idx_legacy_id` (`legacy_published_product_id`),
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
  `deleted_at` TIMESTAMP NULL,
  INDEX `idx_workflow_id` (`workflow_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_deleted_at` (`deleted_at`),
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

-- =============================================
-- 마이그레이션 전 데이터 검증 (경고용)
-- 주의: shop_id와 channel_id가 모두 NULL인 레코드는 마이그레이션되지 않음
-- 비즈니스 로직상 발행된 상품은 반드시 shop_id 또는 channel_id가 있어야 함
-- =============================================

-- shop_product로 데이터 이전 (shop_id가 있는 레코드)
-- ON DUPLICATE KEY UPDATE로 이미 존재하는 경우 모든 관련 필드 갱신
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
  `published_at` = VALUES(`published_at`),
  `updated_at` = VALUES(`updated_at`);

-- channel_product로 데이터 이전 (channel_id가 있는 레코드)
-- legacy_published_product_id에 원본 ID 보존 (롤백용)
-- ON DUPLICATE KEY UPDATE로 이미 존재하는 경우 모든 관련 필드 갱신
INSERT INTO `channel_product` (`user_id`, `product_id`, `channel_id`, `post_key`, `is_active`, `published_at`, `created_at`, `updated_at`, `legacy_published_product_id`)
SELECT
  `user_id`,
  `product_id`,
  `channel_id`,
  `post_key`,
  `is_active`,
  `published_at`,
  `created_at`,
  `updated_at`,
  `id` as `legacy_published_product_id`
FROM `published_product`
WHERE `channel_id` IS NOT NULL
ON DUPLICATE KEY UPDATE
  `post_key` = VALUES(`post_key`),
  `is_active` = VALUES(`is_active`),
  `published_at` = VALUES(`published_at`),
  `updated_at` = VALUES(`updated_at`),
  `legacy_published_product_id` = VALUES(`legacy_published_product_id`);

-- 데이터 마이그레이션 명시적 커밋 (DDL 실행 전 저장)
COMMIT;

-- FK 체크 다시 활성화 (안전장치)
SET FOREIGN_KEY_CHECKS = 1;

-- =============================================
-- 마이그레이션 검증 쿼리 (수동 실행용)
-- 마이그레이션 후 아래 쿼리로 데이터 무결성 확인 권장
-- =============================================
-- SELECT COUNT(*) as shop_only FROM published_product WHERE shop_id IS NOT NULL AND channel_id IS NULL;
-- SELECT COUNT(*) as channel_only FROM published_product WHERE channel_id IS NOT NULL AND shop_id IS NULL;
-- SELECT COUNT(*) as both_fields FROM published_product WHERE shop_id IS NOT NULL AND channel_id IS NOT NULL;
-- SELECT COUNT(*) as orphaned FROM published_product WHERE shop_id IS NULL AND channel_id IS NULL;
-- SELECT (SELECT COUNT(*) FROM shop_product) as shop_product_count, (SELECT COUNT(*) FROM channel_product) as channel_product_count;

-- =============================================
-- PART 3: 레거시 테이블 삭제
-- published_product 참조하는 FK 먼저 삭제 후 테이블 삭제
-- 주의: DDL은 암시적으로 커밋을 수행합니다.
-- =============================================

-- FK 체크 일시 비활성화 (DDL 실행용)
SET FOREIGN_KEY_CHECKS = 0;

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

-- =============================================
-- PART 4: Orphaned 컬럼 정리
-- published_product 삭제 후 더 이상 필요 없는 FK 컬럼들 제거
-- =============================================

-- cart_item.published_product_id 컬럼 삭제 (존재하는 경우에만)
SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'cart_item' AND column_name = 'published_product_id');
SET @sql = IF(@col_exists > 0, 'ALTER TABLE `cart_item` DROP COLUMN `published_product_id`', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- order_item.published_product_id 컬럼 삭제 (존재하는 경우에만)
SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'order_item' AND column_name = 'published_product_id');
SET @sql = IF(@col_exists > 0, 'ALTER TABLE `order_item` DROP COLUMN `published_product_id`', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- guest_order_item.published_product_id 컬럼 삭제 (존재하는 경우에만)
SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'guest_order_item' AND column_name = 'published_product_id');
SET @sql = IF(@col_exists > 0, 'ALTER TABLE `guest_order_item` DROP COLUMN `published_product_id`', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- inquiry.published_product_id 컬럼 삭제 (존재하는 경우에만)
SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'inquiry' AND column_name = 'published_product_id');
SET @sql = IF(@col_exists > 0, 'ALTER TABLE `inquiry` DROP COLUMN `published_product_id`', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- FK 체크 다시 활성화
SET FOREIGN_KEY_CHECKS = 1;

-- DDL은 암시적 커밋을 수행하므로 별도의 COMMIT 문이 필요하지 않음