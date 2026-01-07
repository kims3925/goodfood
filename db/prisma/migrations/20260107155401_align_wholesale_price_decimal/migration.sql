-- Align monetary fields to DECIMAL(12,2) for fractional prices
ALTER TABLE `order_item`
  MODIFY COLUMN `unit_price` DECIMAL(12,2) NOT NULL,
  MODIFY COLUMN `wholesale_price` DECIMAL(12,2) NULL;

ALTER TABLE `guest_order_item`
  MODIFY COLUMN `unit_price` DECIMAL(12,2) NOT NULL,
  MODIFY COLUMN `wholesale_price` DECIMAL(12,2) NULL;

ALTER TABLE `product`
  MODIFY COLUMN `wholesale_price` DECIMAL(12,2) NULL;

ALTER TABLE `product_variant`
  MODIFY COLUMN `wholesale_price` DECIMAL(12,2) NULL;