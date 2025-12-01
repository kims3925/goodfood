-- 사용자 온보딩/동의 컬럼 추가 및 로그인 로그 테이블 생성

ALTER TABLE `user`
  ADD COLUMN `signup_completed_at` DATETIME NULL,
  ADD COLUMN `tos_agreed_at` DATETIME NULL,
  ADD COLUMN `privacy_agreed_at` DATETIME NULL,
  ADD COLUMN `marketing_agreed_at` DATETIME NULL;

CREATE TABLE `user_login_log` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NULL,
  `provider` VARCHAR(50) NOT NULL,
  `email` VARCHAR(255) NULL,
  `ip` VARCHAR(100) NULL,
  `user_agent` VARCHAR(500) NULL,
  `success` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`id`),
  INDEX `user_login_log_user_id_idx` (`user_id`),
  INDEX `user_login_log_provider_idx` (`provider`),
  INDEX `user_login_log_created_at_idx` (`created_at`),
  CONSTRAINT `user_login_log_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `user`(`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
);
