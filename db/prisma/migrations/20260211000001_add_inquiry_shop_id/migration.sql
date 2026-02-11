-- Inquiry 테이블에 shop_id 컬럼 추가 (문의가 접수된 쇼핑몰 식별)
-- MariaDB: ADD COLUMN IF NOT EXISTS 네이티브 지원

ALTER TABLE `inquiry` ADD COLUMN IF NOT EXISTS `shop_id` INT NULL;

ALTER TABLE `inquiry` ADD INDEX IF NOT EXISTS `inquiry_shop_id_idx`(`shop_id`);

ALTER TABLE `inquiry` ADD CONSTRAINT IF NOT EXISTS `inquiry_shop_id_fkey`
    FOREIGN KEY (`shop_id`) REFERENCES `shop`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- 기존 데이터 backfill: shopProductId가 있는 문의의 shop_id를 채움
UPDATE `inquiry` i
    INNER JOIN `shop_product` sp ON i.`shop_product_id` = sp.`id`
    SET i.`shop_id` = sp.`shop_id`
    WHERE i.`shop_id` IS NULL AND i.`shop_product_id` IS NOT NULL;
