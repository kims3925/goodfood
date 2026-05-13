#!/bin/bash
# DB 마이그레이션 스크립트
# deploy.yml 및 db-migrate.yml에서 공통으로 사용
set -e

cd /home/ubuntu/bandauto
set -a && source .env && set +a

docker compose exec -T mariadb mysql \
  -u"${DB_USER:-banduser}" \
  -p"${DB_PASSWORD}" \
  "${DB_NAME:-sourcing_db}" << 'SQL'
ALTER TABLE guest_order_item ADD COLUMN IF NOT EXISTS is_custom_item TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE guest_order_item MODIFY COLUMN shop_product_id INT NULL;
ALTER TABLE automation_config ADD COLUMN IF NOT EXISTS collection_limit_by_channel LONGTEXT NULL;
ALTER TABLE automation_config ADD COLUMN IF NOT EXISTS auto_publish_limit INT NOT NULL DEFAULT 20;
ALTER TABLE automation_config ADD COLUMN IF NOT EXISTS auto_publish_limit_by_shop LONGTEXT NULL;
ALTER TABLE automation_config ADD COLUMN IF NOT EXISTS auto_publish_limit_by_channel LONGTEXT NULL;
ALTER TABLE product_image ADD COLUMN IF NOT EXISTS is_price_banner TINYINT(1) NULL;
-- GBand SaaS (2026-05-13): 매니저-스태프 / postType / tierRules / 주문 출처
ALTER TABLE user ADD COLUMN IF NOT EXISTS manager_id INT NULL;
ALTER TABLE channel ADD COLUMN IF NOT EXISTS post_type ENUM('SELF','OUTSOURCE','SHARED') NULL;
ALTER TABLE pricing_policy ADD COLUMN IF NOT EXISTS tier_rules LONGTEXT NULL;
ALTER TABLE `order` ADD COLUMN IF NOT EXISTS source ENUM('SHOP','CHAT','KAKAO','MANUAL') NOT NULL DEFAULT 'SHOP';

-- GBand SaaS Phase 4 (2026-05-13): 외부주문 + AI 챗 자동주문 + 은행통장 연결
ALTER TABLE `order` ADD COLUMN IF NOT EXISTS external_kind VARCHAR(20) NULL;
ALTER TABLE `order` ADD COLUMN IF NOT EXISTS external_memo TEXT NULL;
ALTER TABLE guest_order ADD COLUMN IF NOT EXISTS source ENUM('SHOP','CHAT','KAKAO','MANUAL') NOT NULL DEFAULT 'SHOP';
ALTER TABLE guest_order ADD COLUMN IF NOT EXISTS external_kind VARCHAR(20) NULL;
ALTER TABLE guest_order ADD COLUMN IF NOT EXISTS external_memo TEXT NULL;
ALTER TABLE guest_order ADD COLUMN IF NOT EXISTS inbox_message_id INT NULL;

CREATE TABLE IF NOT EXISTS bank_account (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT NOT NULL,
  bank_name       VARCHAR(50) NOT NULL,
  account_number  VARCHAR(50) NOT NULL,
  account_holder  VARCHAR(100) NOT NULL,
  api_provider    VARCHAR(20) NOT NULL DEFAULT 'NONE',
  api_credentials JSON NULL,
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  last_synced_at  TIMESTAMP NULL,
  deleted_at      TIMESTAMP NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_bank_account_user (user_id),
  INDEX idx_bank_account_active (user_id, is_active)
);

CREATE TABLE IF NOT EXISTS bank_transaction (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  bank_account_id   INT NOT NULL,
  transaction_date  TIMESTAMP NOT NULL,
  amount            DECIMAL(12,2) NOT NULL,
  sender_name       VARCHAR(100) NULL,
  description       VARCHAR(500) NULL,
  matched_order_id  INT NULL,
  matched_at        TIMESTAMP NULL,
  raw               JSON NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_bank_tx_account (bank_account_id),
  INDEX idx_bank_tx_date (transaction_date),
  INDEX idx_bank_tx_matched_order (matched_order_id),
  INDEX idx_bank_tx_sender (sender_name),
  CONSTRAINT fk_bank_tx_account FOREIGN KEY (bank_account_id) REFERENCES bank_account(id) ON DELETE CASCADE
);
SQL

echo "Migration completed at $(date '+%Y-%m-%d %H:%M:%S %Z')"
