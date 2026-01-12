-- GoogleSheetConfig 테이블 생성 (구글 시트 연동 설정)
-- TR-20260112-003: 구글 시트 연동 기능 추가 (발주서 동기화)
-- IF NOT EXISTS: db push로 이미 생성된 경우 충돌 방지

CREATE TABLE IF NOT EXISTS `google_sheet_config` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `service_account_json` LONGTEXT NOT NULL,
  `spreadsheet_id` VARCHAR(255) NOT NULL,
  `sheet_name` VARCHAR(100) NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `last_synced_at` TIMESTAMP(0) NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

  PRIMARY KEY (`id`),
  UNIQUE INDEX `google_sheet_config_user_id_key`(`user_id`),
  INDEX `google_sheet_config_user_id_idx`(`user_id`),
  INDEX `google_sheet_config_is_active_idx`(`is_active`),

  CONSTRAINT `google_sheet_config_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `user`(`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);
