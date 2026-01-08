-- =============================================
-- 전체 스키마 마이그레이션
-- published_product -> shop_product 전환 및 불필요 컬럼 제거
--
-- 이 마이그레이션은 다음 변경사항을 포함합니다:
-- 1. shop_product 테이블 생성 (published_product 대체)
-- 2. channel_product 테이블 생성 (채널별 상품 발행 관리)
-- 3. cart_item, order_item, guest_order_item, inquiry 테이블의
--    published_product_id -> shop_product_id 컬럼 변경
-- 4. 불필요한 컬럼 제거 (shipping_fee, wholesale_price 등)
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

-- =============================================
-- PART 2: 레거시 테이블 삭제
-- =============================================

DROP TABLE IF EXISTS `published_product`;
