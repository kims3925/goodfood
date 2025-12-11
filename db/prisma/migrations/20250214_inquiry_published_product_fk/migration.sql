-- inquiry.product_id -> published_product_id 로 컬럼 및 FK를 변경합니다.
-- 제약조건 이름이 환경마다 다를 수 있어 information_schema를 통해 동적으로 조회 후 삭제합니다.

-- Drop existing FK to product if present
SET @inquiry_fk :=
  (SELECT CONSTRAINT_NAME
   FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'inquiry'
     AND COLUMN_NAME = 'product_id'
     AND REFERENCED_TABLE_NAME IS NOT NULL
   LIMIT 1);

SET @drop_fk_sql := IF(
  @inquiry_fk IS NOT NULL,
  CONCAT('ALTER TABLE `inquiry` DROP FOREIGN KEY `', @inquiry_fk, '`;'),
  'SELECT 1;'
);

PREPARE drop_fk_stmt FROM @drop_fk_sql;
EXECUTE drop_fk_stmt;
DEALLOCATE PREPARE drop_fk_stmt;

-- Rename column to match published_product
ALTER TABLE `inquiry`
  CHANGE COLUMN `product_id` `published_product_id` INT NULL;

-- Add FK to published_product
ALTER TABLE `inquiry`
  ADD CONSTRAINT `inquiry_published_product_id_fkey`
    FOREIGN KEY (`published_product_id`) REFERENCES `published_product`(`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE;
