-- ProductVariant에 Soft Delete 필드 추가
ALTER TABLE `product_variant` ADD COLUMN `deleted_at` TIMESTAMP NULL;

-- deleted_at 인덱스 추가
CREATE INDEX `product_variant_deleted_at_idx` ON `product_variant`(`deleted_at`);
