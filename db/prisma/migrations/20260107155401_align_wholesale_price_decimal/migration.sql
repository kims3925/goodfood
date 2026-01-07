-- Align monetary fields to DECIMAL(10,2) for fractional prices
SET @add_order_item_wholesale := IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'order_item'
      AND COLUMN_NAME = 'wholesale_price') = 0,
  'ALTER TABLE `order_item` ADD COLUMN `wholesale_price` DECIMAL(10,2) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @add_order_item_wholesale;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE `order_item`
  MODIFY COLUMN `unit_price` DECIMAL(10,2) NOT NULL,
  MODIFY COLUMN `wholesale_price` DECIMAL(10,2) NULL;

SET @add_guest_order_item_wholesale := IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'guest_order_item'
      AND COLUMN_NAME = 'wholesale_price') = 0,
  'ALTER TABLE `guest_order_item` ADD COLUMN `wholesale_price` DECIMAL(10,2) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @add_guest_order_item_wholesale;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE `guest_order_item`
  MODIFY COLUMN `unit_price` DECIMAL(10,2) NOT NULL,
  MODIFY COLUMN `wholesale_price` DECIMAL(10,2) NULL;

SET @add_product_wholesale := IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'product'
      AND COLUMN_NAME = 'wholesale_price') = 0,
  'ALTER TABLE `product` ADD COLUMN `wholesale_price` DECIMAL(10,2) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @add_product_wholesale;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE `product`
  MODIFY COLUMN `wholesale_price` DECIMAL(10,2) NULL;

SET @add_product_variant_wholesale := IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'product_variant'
      AND COLUMN_NAME = 'wholesale_price') = 0,
  'ALTER TABLE `product_variant` ADD COLUMN `wholesale_price` DECIMAL(10,2) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @add_product_variant_wholesale;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE `product_variant`
  MODIFY COLUMN `wholesale_price` DECIMAL(10,2) NULL;
