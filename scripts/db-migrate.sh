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
SQL

echo "Migration completed at $(date '+%Y-%m-%d %H:%M:%S %Z')"
