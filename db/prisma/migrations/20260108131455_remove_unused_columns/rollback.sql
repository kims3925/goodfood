-- =============================================
-- 롤백 마이그레이션
-- published_product 테이블 복원 및 신규 테이블 삭제
--
-- 주의: 이 롤백을 실행하기 전 반드시 published_product 백업이 필요합니다.
-- 백업 명령어 예시:
-- mysqldump -u [user] -p [database] shop_product channel_product > backup_20260108.sql
-- =============================================

-- =============================================
-- PART 1: FK 체크 일시 비활성화
-- =============================================
SET FOREIGN_KEY_CHECKS = 0;

-- =============================================
-- PART 2: published_product 테이블 복원
-- (백업에서 복원하거나 새로 생성)
-- =============================================

-- published_product 테이블 재생성
CREATE TABLE IF NOT EXISTS `published_product` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `product_id` INT,
  `shop_id` INT,
  `channel_id` INT,
  `post_key` VARCHAR(255),
  `is_active` BOOLEAN DEFAULT TRUE,
  `published_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_product_id` (`product_id`),
  INDEX `idx_shop_id` (`shop_id`),
  INDEX `idx_channel_id` (`channel_id`)
);

-- =============================================
-- PART 3: shop_product, channel_product 데이터를 published_product로 복원
-- 각 테이블 존재 여부를 확인 후 데이터 복원 (테이블이 없으면 스킵)
-- =============================================

-- shop_product 데이터 복원 (테이블이 존재하는 경우에만)
SET @tbl_exists = (SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'shop_product');
SET @sql = IF(@tbl_exists > 0,
  "INSERT INTO `published_product` (`id`, `user_id`, `product_id`, `shop_id`, `published_at`, `created_at`, `updated_at`)
   SELECT `id`, `user_id`, `product_id`, `shop_id`, `published_at`, `created_at`, `updated_at`
   FROM `shop_product`
   ON DUPLICATE KEY UPDATE
     `published_at` = VALUES(`published_at`),
     `updated_at` = VALUES(`updated_at`)",
  'SELECT "SKIPPED: shop_product table does not exist" AS rollback_info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- channel_product 데이터 복원 (legacy_published_product_id로 원본 ID 복원)
SET @tbl_exists = (SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'channel_product');

-- legacy_published_product_id가 있는 경우 원본 ID 사용
SET @sql = IF(@tbl_exists > 0,
  "INSERT INTO `published_product` (`id`, `user_id`, `product_id`, `channel_id`, `post_key`, `is_active`, `published_at`, `created_at`, `updated_at`)
   SELECT `legacy_published_product_id`, `user_id`, `product_id`, `channel_id`, `post_key`, `is_active`, `published_at`, `created_at`, `updated_at`
   FROM `channel_product`
   WHERE `legacy_published_product_id` IS NOT NULL
   ON DUPLICATE KEY UPDATE
     `channel_id` = VALUES(`channel_id`),
     `post_key` = VALUES(`post_key`),
     `is_active` = VALUES(`is_active`),
     `published_at` = VALUES(`published_at`),
     `updated_at` = VALUES(`updated_at`)",
  'SELECT "SKIPPED: channel_product table does not exist" AS rollback_info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- legacy_published_product_id가 없는 channel_product는 새 ID로 생성 (마이그레이션 이후 생성된 데이터)
SET @sql = IF(@tbl_exists > 0,
  "INSERT INTO `published_product` (`user_id`, `product_id`, `channel_id`, `post_key`, `is_active`, `published_at`, `created_at`, `updated_at`)
   SELECT `user_id`, `product_id`, `channel_id`, `post_key`, `is_active`, `published_at`, `created_at`, `updated_at`
   FROM `channel_product`
   WHERE `legacy_published_product_id` IS NULL",
  'SELECT "SKIPPED: channel_product table does not exist" AS rollback_info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =============================================
-- PART 4: published_product_id 컬럼 복원
-- FK 재생성 전에 컬럼이 먼저 존재해야 함
-- =============================================

-- cart_item.published_product_id 컬럼 복원 (존재하지 않는 경우에만)
SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'cart_item' AND column_name = 'published_product_id');
SET @sql = IF(@col_exists = 0,
  "ALTER TABLE `cart_item` ADD COLUMN `published_product_id` INT NULL",
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- order_item.published_product_id 컬럼 복원 (존재하지 않는 경우에만)
SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'order_item' AND column_name = 'published_product_id');
SET @sql = IF(@col_exists = 0,
  "ALTER TABLE `order_item` ADD COLUMN `published_product_id` INT NULL",
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- guest_order_item.published_product_id 컬럼 복원 (존재하지 않는 경우에만)
SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'guest_order_item' AND column_name = 'published_product_id');
SET @sql = IF(@col_exists = 0,
  "ALTER TABLE `guest_order_item` ADD COLUMN `published_product_id` INT NULL",
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- inquiry.published_product_id 컬럼 복원 (존재하지 않는 경우에만)
SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'inquiry' AND column_name = 'published_product_id');
SET @sql = IF(@col_exists = 0,
  "ALTER TABLE `inquiry` ADD COLUMN `published_product_id` INT NULL",
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =============================================
-- PART 5: FK 재생성
-- 컬럼 복원 후 FK 제약조건 추가
-- =============================================

-- cart_item FK 재생성 (컬럼이 존재하는 경우)
SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'cart_item' AND column_name = 'published_product_id');
SET @sql = IF(@col_exists > 0,
  "ALTER TABLE `cart_item` ADD CONSTRAINT `cart_item_published_product_id_fkey` FOREIGN KEY (`published_product_id`) REFERENCES `published_product` (`id`) ON DELETE SET NULL ON UPDATE CASCADE",
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- order_item FK 재생성 (컬럼이 존재하는 경우)
SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'order_item' AND column_name = 'published_product_id');
SET @sql = IF(@col_exists > 0,
  "ALTER TABLE `order_item` ADD CONSTRAINT `order_item_published_product_id_fkey` FOREIGN KEY (`published_product_id`) REFERENCES `published_product` (`id`) ON DELETE SET NULL ON UPDATE CASCADE",
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- guest_order_item FK 재생성 (컬럼이 존재하는 경우)
SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'guest_order_item' AND column_name = 'published_product_id');
SET @sql = IF(@col_exists > 0,
  "ALTER TABLE `guest_order_item` ADD CONSTRAINT `guest_order_item_published_product_id_fkey` FOREIGN KEY (`published_product_id`) REFERENCES `published_product` (`id`) ON DELETE SET NULL ON UPDATE CASCADE",
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- inquiry FK 재생성 (컬럼이 존재하는 경우)
SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'inquiry' AND column_name = 'published_product_id');
SET @sql = IF(@col_exists > 0,
  "ALTER TABLE `inquiry` ADD CONSTRAINT `inquiry_published_product_id_fkey` FOREIGN KEY (`published_product_id`) REFERENCES `published_product` (`id`) ON DELETE SET NULL ON UPDATE CASCADE",
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =============================================
-- PART 6: 신규 테이블 삭제
-- =============================================

DROP TABLE IF EXISTS `workflow_step_log`;
DROP TABLE IF EXISTS `channel_product`;
DROP TABLE IF EXISTS `shop_product`;

-- =============================================
-- PART 7: workflow_log.current_step 컬럼 제거
-- =============================================

SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'workflow_log' AND column_name = 'current_step');
SET @sql = IF(@col_exists > 0,
  "ALTER TABLE `workflow_log` DROP COLUMN `current_step`",
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =============================================
-- PART 8: FK 체크 재활성화
-- =============================================
SET FOREIGN_KEY_CHECKS = 1;

-- =============================================
-- 롤백 완료
-- =============================================
