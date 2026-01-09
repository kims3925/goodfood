-- Rollback: shop_product 테이블에서 is_active 컬럼 제거

ALTER TABLE `shop_product` DROP COLUMN `is_active`;
