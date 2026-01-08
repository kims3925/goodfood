-- =============================================
-- 롤백 마이그레이션
-- published_product 테이블 복원 및 신규 테이블 삭제
--
-- 주의: 이 롤백을 실행하기 전 반드시 백업이 필요합니다.
-- 백업 명령어 예시:
-- mysqldump -u [user] -p [database] shop_product channel_product > backup_20260108.sql
--
-- 이 롤백은 다음을 처리합니다:
-- 1. ID 충돌 감지 및 로깅 (shop_product와 channel_product 간)
-- 2. legacy_published_product_id가 NULL인 경우 새 ID 매핑 및 FK 업데이트
-- 3. shop_id와 channel_id가 한 행에 공존하지 않도록 분리
-- =============================================

-- 트랜잭션 시작
START TRANSACTION;

-- =============================================
-- PART 1: FK 체크 일시 비활성화
-- =============================================
SET FOREIGN_KEY_CHECKS = 0;

-- =============================================
-- PART 2: published_product 테이블 복원
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
  `deleted_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_product_id` (`product_id`),
  INDEX `idx_shop_id` (`shop_id`),
  INDEX `idx_channel_id` (`channel_id`),
  INDEX `idx_deleted_at` (`deleted_at`)
);

-- =============================================
-- PART 3: ID 매핑 테이블 생성
-- channel_product에서 새로 생성된 레코드(legacy_published_product_id IS NULL)의
-- 새 published_product ID를 추적하기 위한 임시 테이블
-- =============================================

CREATE TEMPORARY TABLE IF NOT EXISTS `_rollback_id_mapping` (
  `source_table` VARCHAR(50) NOT NULL,
  `source_id` INT NOT NULL,
  `new_published_product_id` INT NOT NULL,
  PRIMARY KEY (`source_table`, `source_id`)
);

-- ID 충돌 로그 테이블 (롤백 후 검토용)
CREATE TABLE IF NOT EXISTS `_rollback_conflict_log` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `conflict_type` VARCHAR(100) NOT NULL,
  `shop_product_id` INT,
  `channel_product_id` INT,
  `legacy_published_product_id` INT,
  `resolution` VARCHAR(255),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- PART 4: shop_product 데이터 복원 (우선순위 1)
-- shop_product는 원본 ID를 그대로 사용
-- =============================================

SET @tbl_exists = (SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'shop_product');
SET @sql = IF(@tbl_exists > 0,
  "INSERT INTO `published_product` (`id`, `user_id`, `product_id`, `shop_id`, `deleted_at`, `published_at`, `created_at`, `updated_at`)
   SELECT `id`, `user_id`, `product_id`, `shop_id`, `deleted_at`, `published_at`, `created_at`, `updated_at`
   FROM `shop_product`",
  'SELECT "SKIPPED: shop_product table does not exist" AS rollback_info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =============================================
-- PART 5: channel_product 데이터 복원 (충돌 감지 포함)
-- Case 1: legacy_published_product_id가 있고 shop_product와 충돌하지 않는 경우
-- Case 2: legacy_published_product_id가 있고 shop_product와 충돌하는 경우 (새 ID 생성)
-- Case 3: legacy_published_product_id가 없는 경우 (새 ID 생성 및 매핑)
-- =============================================

SET @tbl_exists = (SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'channel_product');

-- Case 1: legacy_published_product_id가 있고 published_product에 해당 ID가 없는 경우 (충돌 없음)
SET @sql = IF(@tbl_exists > 0,
  "INSERT INTO `published_product` (`id`, `user_id`, `product_id`, `channel_id`, `post_key`, `is_active`, `deleted_at`, `published_at`, `created_at`, `updated_at`)
   SELECT cp.`legacy_published_product_id`, cp.`user_id`, cp.`product_id`, cp.`channel_id`, cp.`post_key`, cp.`is_active`, cp.`deleted_at`, cp.`published_at`, cp.`created_at`, cp.`updated_at`
   FROM `channel_product` cp
   WHERE cp.`legacy_published_product_id` IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM `published_product` pp WHERE pp.id = cp.`legacy_published_product_id`)",
  'SELECT "SKIPPED: channel_product table does not exist" AS rollback_info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Case 2: legacy_published_product_id가 있지만 이미 published_product에 해당 ID가 존재하는 경우 (충돌)
-- 충돌 로그 기록 후 새 ID로 생성
SET @sql = IF(@tbl_exists > 0,
  "INSERT INTO `_rollback_conflict_log` (`conflict_type`, `shop_product_id`, `channel_product_id`, `legacy_published_product_id`, `resolution`)
   SELECT 'ID_COLLISION', pp.id, cp.id, cp.`legacy_published_product_id`, 'Created new ID for channel_product'
   FROM `channel_product` cp
   INNER JOIN `published_product` pp ON pp.id = cp.`legacy_published_product_id`
   WHERE cp.`legacy_published_product_id` IS NOT NULL",
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 충돌하는 channel_product는 새 ID로 생성
SET @sql = IF(@tbl_exists > 0,
  "INSERT INTO `published_product` (`user_id`, `product_id`, `channel_id`, `post_key`, `is_active`, `deleted_at`, `published_at`, `created_at`, `updated_at`)
   SELECT cp.`user_id`, cp.`product_id`, cp.`channel_id`, cp.`post_key`, cp.`is_active`, cp.`deleted_at`, cp.`published_at`, cp.`created_at`, cp.`updated_at`
   FROM `channel_product` cp
   WHERE cp.`legacy_published_product_id` IS NOT NULL
     AND EXISTS (SELECT 1 FROM `published_product` pp WHERE pp.id = cp.`legacy_published_product_id`)",
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 충돌로 새로 생성된 레코드의 ID 매핑 저장
SET @sql = IF(@tbl_exists > 0,
  "INSERT INTO `_rollback_id_mapping` (`source_table`, `source_id`, `new_published_product_id`)
   SELECT 'channel_product_conflict', cp.id, pp.id
   FROM `channel_product` cp
   INNER JOIN `published_product` pp
     ON pp.user_id = cp.user_id
     AND pp.product_id = cp.product_id
     AND pp.channel_id = cp.channel_id
   WHERE cp.`legacy_published_product_id` IS NOT NULL
     AND pp.id != cp.`legacy_published_product_id`",
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Case 3: legacy_published_product_id가 없는 경우 (마이그레이션 이후 생성된 데이터)
-- 새 ID로 생성
SET @sql = IF(@tbl_exists > 0,
  "INSERT INTO `published_product` (`user_id`, `product_id`, `channel_id`, `post_key`, `is_active`, `deleted_at`, `published_at`, `created_at`, `updated_at`)
   SELECT `user_id`, `product_id`, `channel_id`, `post_key`, `is_active`, `deleted_at`, `published_at`, `created_at`, `updated_at`
   FROM `channel_product`
   WHERE `legacy_published_product_id` IS NULL",
  'SELECT "SKIPPED: channel_product table does not exist" AS rollback_info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Case 3의 새로 생성된 레코드 ID 매핑 저장
SET @sql = IF(@tbl_exists > 0,
  "INSERT INTO `_rollback_id_mapping` (`source_table`, `source_id`, `new_published_product_id`)
   SELECT 'channel_product_new', cp.id, pp.id
   FROM `channel_product` cp
   INNER JOIN `published_product` pp
     ON pp.user_id = cp.user_id
     AND pp.product_id = cp.product_id
     AND pp.channel_id = cp.channel_id
   WHERE cp.`legacy_published_product_id` IS NULL",
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =============================================
-- PART 6: published_product_id 컬럼 복원
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
-- PART 7: FK 참조 테이블 업데이트
-- shop_product_id 또는 channel_product_id를 사용하는 테이블들의
-- published_product_id를 새로 생성된 ID로 업데이트
-- =============================================

-- cart_item: shop_product_id로 참조하는 경우 (shop_product.id = published_product.id)
SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'cart_item' AND column_name = 'shop_product_id');
SET @sql = IF(@col_exists > 0,
  "UPDATE `cart_item` ci
   INNER JOIN `shop_product` sp ON ci.shop_product_id = sp.id
   SET ci.published_product_id = sp.id
   WHERE ci.shop_product_id IS NOT NULL",
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- cart_item: channel_product_id로 참조하는 경우 (매핑 테이블 사용)
SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'cart_item' AND column_name = 'channel_product_id');
SET @sql = IF(@col_exists > 0,
  "UPDATE `cart_item` ci
   INNER JOIN `_rollback_id_mapping` m ON m.source_id = ci.channel_product_id AND m.source_table LIKE 'channel_product%'
   SET ci.published_product_id = m.new_published_product_id
   WHERE ci.channel_product_id IS NOT NULL AND ci.published_product_id IS NULL",
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- cart_item: legacy_published_product_id가 있는 channel_product (충돌 없는 경우)
SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'cart_item' AND column_name = 'channel_product_id');
SET @sql = IF(@col_exists > 0,
  "UPDATE `cart_item` ci
   INNER JOIN `channel_product` cp ON ci.channel_product_id = cp.id
   SET ci.published_product_id = cp.legacy_published_product_id
   WHERE ci.channel_product_id IS NOT NULL
     AND ci.published_product_id IS NULL
     AND cp.legacy_published_product_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM published_product pp WHERE pp.id = cp.legacy_published_product_id AND pp.channel_id IS NOT NULL)",
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- order_item: shop_product_id로 참조하는 경우
SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'order_item' AND column_name = 'shop_product_id');
SET @sql = IF(@col_exists > 0,
  "UPDATE `order_item` oi
   INNER JOIN `shop_product` sp ON oi.shop_product_id = sp.id
   SET oi.published_product_id = sp.id
   WHERE oi.shop_product_id IS NOT NULL",
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- order_item: channel_product_id로 참조하는 경우 (매핑 테이블 사용)
SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'order_item' AND column_name = 'channel_product_id');
SET @sql = IF(@col_exists > 0,
  "UPDATE `order_item` oi
   INNER JOIN `_rollback_id_mapping` m ON m.source_id = oi.channel_product_id AND m.source_table LIKE 'channel_product%'
   SET oi.published_product_id = m.new_published_product_id
   WHERE oi.channel_product_id IS NOT NULL AND oi.published_product_id IS NULL",
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- order_item: legacy_published_product_id가 있는 channel_product (충돌 없는 경우)
SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'order_item' AND column_name = 'channel_product_id');
SET @sql = IF(@col_exists > 0,
  "UPDATE `order_item` oi
   INNER JOIN `channel_product` cp ON oi.channel_product_id = cp.id
   SET oi.published_product_id = cp.legacy_published_product_id
   WHERE oi.channel_product_id IS NOT NULL
     AND oi.published_product_id IS NULL
     AND cp.legacy_published_product_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM published_product pp WHERE pp.id = cp.legacy_published_product_id AND pp.channel_id IS NOT NULL)",
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- guest_order_item: shop_product_id로 참조하는 경우
SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'guest_order_item' AND column_name = 'shop_product_id');
SET @sql = IF(@col_exists > 0,
  "UPDATE `guest_order_item` goi
   INNER JOIN `shop_product` sp ON goi.shop_product_id = sp.id
   SET goi.published_product_id = sp.id
   WHERE goi.shop_product_id IS NOT NULL",
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- guest_order_item: channel_product_id로 참조하는 경우 (매핑 테이블 사용)
SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'guest_order_item' AND column_name = 'channel_product_id');
SET @sql = IF(@col_exists > 0,
  "UPDATE `guest_order_item` goi
   INNER JOIN `_rollback_id_mapping` m ON m.source_id = goi.channel_product_id AND m.source_table LIKE 'channel_product%'
   SET goi.published_product_id = m.new_published_product_id
   WHERE goi.channel_product_id IS NOT NULL AND goi.published_product_id IS NULL",
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- guest_order_item: legacy_published_product_id가 있는 channel_product (충돌 없는 경우)
SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'guest_order_item' AND column_name = 'channel_product_id');
SET @sql = IF(@col_exists > 0,
  "UPDATE `guest_order_item` goi
   INNER JOIN `channel_product` cp ON goi.channel_product_id = cp.id
   SET goi.published_product_id = cp.legacy_published_product_id
   WHERE goi.channel_product_id IS NOT NULL
     AND goi.published_product_id IS NULL
     AND cp.legacy_published_product_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM published_product pp WHERE pp.id = cp.legacy_published_product_id AND pp.channel_id IS NOT NULL)",
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- inquiry: shop_product_id로 참조하는 경우
SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'inquiry' AND column_name = 'shop_product_id');
SET @sql = IF(@col_exists > 0,
  "UPDATE `inquiry` i
   INNER JOIN `shop_product` sp ON i.shop_product_id = sp.id
   SET i.published_product_id = sp.id
   WHERE i.shop_product_id IS NOT NULL",
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- inquiry: channel_product_id로 참조하는 경우 (매핑 테이블 사용)
SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'inquiry' AND column_name = 'channel_product_id');
SET @sql = IF(@col_exists > 0,
  "UPDATE `inquiry` i
   INNER JOIN `_rollback_id_mapping` m ON m.source_id = i.channel_product_id AND m.source_table LIKE 'channel_product%'
   SET i.published_product_id = m.new_published_product_id
   WHERE i.channel_product_id IS NOT NULL AND i.published_product_id IS NULL",
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- inquiry: legacy_published_product_id가 있는 channel_product (충돌 없는 경우)
SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'inquiry' AND column_name = 'channel_product_id');
SET @sql = IF(@col_exists > 0,
  "UPDATE `inquiry` i
   INNER JOIN `channel_product` cp ON i.channel_product_id = cp.id
   SET i.published_product_id = cp.legacy_published_product_id
   WHERE i.channel_product_id IS NOT NULL
     AND i.published_product_id IS NULL
     AND cp.legacy_published_product_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM published_product pp WHERE pp.id = cp.legacy_published_product_id AND pp.channel_id IS NOT NULL)",
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =============================================
-- PART 8: FK 재생성
-- 컬럼 복원 및 데이터 업데이트 후 FK 제약조건 추가
-- =============================================

-- cart_item FK 재생성 (컬럼이 존재하는 경우)
SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'cart_item' AND column_name = 'published_product_id');
SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'cart_item' AND CONSTRAINT_NAME = 'cart_item_published_product_id_fkey');
SET @sql = IF(@col_exists > 0 AND @fk_exists = 0,
  "ALTER TABLE `cart_item` ADD CONSTRAINT `cart_item_published_product_id_fkey` FOREIGN KEY (`published_product_id`) REFERENCES `published_product` (`id`) ON DELETE SET NULL ON UPDATE CASCADE",
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- order_item FK 재생성 (컬럼이 존재하는 경우)
SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'order_item' AND column_name = 'published_product_id');
SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'order_item' AND CONSTRAINT_NAME = 'order_item_published_product_id_fkey');
SET @sql = IF(@col_exists > 0 AND @fk_exists = 0,
  "ALTER TABLE `order_item` ADD CONSTRAINT `order_item_published_product_id_fkey` FOREIGN KEY (`published_product_id`) REFERENCES `published_product` (`id`) ON DELETE SET NULL ON UPDATE CASCADE",
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- guest_order_item FK 재생성 (컬럼이 존재하는 경우)
SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'guest_order_item' AND column_name = 'published_product_id');
SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'guest_order_item' AND CONSTRAINT_NAME = 'guest_order_item_published_product_id_fkey');
SET @sql = IF(@col_exists > 0 AND @fk_exists = 0,
  "ALTER TABLE `guest_order_item` ADD CONSTRAINT `guest_order_item_published_product_id_fkey` FOREIGN KEY (`published_product_id`) REFERENCES `published_product` (`id`) ON DELETE SET NULL ON UPDATE CASCADE",
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- inquiry FK 재생성 (컬럼이 존재하는 경우)
SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'inquiry' AND column_name = 'published_product_id');
SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'inquiry' AND CONSTRAINT_NAME = 'inquiry_published_product_id_fkey');
SET @sql = IF(@col_exists > 0 AND @fk_exists = 0,
  "ALTER TABLE `inquiry` ADD CONSTRAINT `inquiry_published_product_id_fkey` FOREIGN KEY (`published_product_id`) REFERENCES `published_product` (`id`) ON DELETE SET NULL ON UPDATE CASCADE",
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =============================================
-- PART 9: 신규 테이블 삭제
-- =============================================

DROP TABLE IF EXISTS `workflow_step_log`;
DROP TABLE IF EXISTS `channel_product`;
DROP TABLE IF EXISTS `shop_product`;

-- =============================================
-- PART 10: workflow_log.current_step 컬럼 제거
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
-- PART 11: FK 체크 재활성화
-- =============================================
SET FOREIGN_KEY_CHECKS = 1;

-- =============================================
-- PART 12: 데이터 무결성 검증
-- shop_id와 channel_id가 한 행에 공존하지 않는지 확인
-- =============================================

-- 무결성 위반 체크 (경고용 - 실제로는 발생하지 않아야 함)
INSERT INTO `_rollback_conflict_log` (`conflict_type`, `resolution`)
SELECT 'INTEGRITY_VIOLATION: shop_id and channel_id coexist', CONCAT('published_product.id = ', pp.id)
FROM `published_product` pp
WHERE pp.shop_id IS NOT NULL AND pp.channel_id IS NOT NULL;

-- =============================================
-- 트랜잭션 커밋
-- =============================================
COMMIT;

-- =============================================
-- 롤백 완료 안내
-- =============================================
-- 롤백 후 다음을 확인하세요:
-- 1. SELECT * FROM _rollback_conflict_log; -- ID 충돌 및 무결성 문제 확인
-- 2. SELECT COUNT(*) FROM published_product WHERE shop_id IS NOT NULL AND channel_id IS NOT NULL; -- 0이어야 함
-- 3. 문제가 없으면: DROP TABLE IF EXISTS _rollback_conflict_log;
-- =============================================
