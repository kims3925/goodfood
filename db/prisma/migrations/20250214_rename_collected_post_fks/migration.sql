-- 외래키 컬럼명을 collected_post_id로 일관화합니다.
-- MySQL 8.x 기준. 실제 제약조건명은 DB 상태에 따라 다를 수 있으니 필요시 SHOW CREATE TABLE 결과에 맞춰 조정하세요.

ALTER TABLE `collected_post_image`
  DROP FOREIGN KEY `collected_post_image_post_id_fkey`,
  CHANGE COLUMN `post_id` `collected_post_id` INT NOT NULL,
  ADD CONSTRAINT `collected_post_image_collected_post_id_fkey`
    FOREIGN KEY (`collected_post_id`) REFERENCES `collected_post`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `collected_post_comment`
  DROP FOREIGN KEY `collected_post_comment_post_id_fkey`,
  CHANGE COLUMN `post_id` `collected_post_id` INT NOT NULL,
  ADD CONSTRAINT `collected_post_comment_collected_post_id_fkey`
    FOREIGN KEY (`collected_post_id`) REFERENCES `collected_post`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `collected_product`
  DROP FOREIGN KEY `collected_product_post_id_fkey`,
  CHANGE COLUMN `post_id` `collected_post_id` INT NOT NULL,
  ADD CONSTRAINT `collected_product_collected_post_id_fkey`
    FOREIGN KEY (`collected_post_id`) REFERENCES `collected_post`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
