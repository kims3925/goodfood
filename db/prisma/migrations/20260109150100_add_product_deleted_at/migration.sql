-- Product에 Soft Delete 필드 추가
ALTER TABLE `product` ADD COLUMN `deleted_at` TIMESTAMP NULL;

-- deleted_at 인덱스 추가
CREATE INDEX `product_deleted_at_idx` ON `product`(`deleted_at`);
