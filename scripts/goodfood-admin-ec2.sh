#!/bin/bash
# GoodShop admin (sourcing-app) on existing EC2, port 3004, Supabase DB.
# Run by GitHub Actions -> SSM (root). Does not touch the legacy bandauto stack.
set -euo pipefail
cd /home/ubuntu/goodfood

echo "=== [1/6] reuse API keys from legacy env ==="
OLD_ENV=""
for c in /home/ubuntu/bandauto/sourcing-app/.env /home/ubuntu/bandauto/sourcing-app/.env.local; do
  [ -f "$c" ] && OLD_ENV="$c" && break
done
getold() { [ -n "$OLD_ENV" ] && grep -m1 "^$1=" "$OLD_ENV" 2>/dev/null | cut -d= -f2- | tr -d '"' || true; }
echo "old env: ${OLD_ENV:-none}"

mkdir -p /home/ubuntu/goodfood-admin
ENVF=/home/ubuntu/goodfood-admin/.env
cat > "$ENVF" <<EOF
DATABASE_URL=postgresql://goodfood_app.sfxoxsbcaosuygljxfdd:c52946b87fc25b474aa7d5602c64e3c4@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?schema=goodfood
NEXTAUTH_URL=https://goodshop-admin.hublink.im
NEXT_PUBLIC_SHOP_BASE_URL=https://goodshop.hublink.im
NEXT_PUBLIC_SHOP_DOMAIN=goodshop.hublink.im
JWT_SECRET=bandauto-jwt-secret-dev-2024
NEXTAUTH_SECRET=FADgqW2panEGTy+Nl/ZBv7KxkwHAdnYbWZCxi2sZfIA=
INTERNAL_API_KEY=bandauto-internal-key-dev-2024
REDIS_URL=redis://172.17.0.1:6379
PRODUCT_IMAGE_STORAGE_PATH=/home/ubuntu/assets/images/product
POST_IMAGE_STORAGE_PATH=/home/ubuntu/assets/images/post
CHANNEL_IMAGE_STORAGE_PATH=/home/ubuntu/assets/images/channel
SHOP_IMAGE_STORAGE_PATH=/home/ubuntu/assets/images/shop
GEMINI_API_KEY=$(getold GEMINI_API_KEY)
OPENAI_API_KEY=$(getold OPENAI_API_KEY)
BAND_CLIENT_ID=$(getold BAND_CLIENT_ID)
BAND_CLIENT_SECRET=$(getold BAND_CLIENT_SECRET)
BAND_API_BASE_URL=https://openapi.band.us
NEXT_PUBLIC_BAND_EXTENSION_ID=$(getold NEXT_PUBLIC_BAND_EXTENSION_ID)
TZ=Asia/Seoul
EOF
echo "env written ($(grep -c . "$ENVF") lines)"

echo "=== [2/6] asset dirs ==="
mkdir -p /home/ubuntu/assets-goodfood/images/{product,post,channel,shop}

echo "=== [3/6] docker build ==="
docker build -f docker/Dockerfile.sourcing \
  --build-arg NEXT_PUBLIC_SHOP_BASE_URL=https://goodshop.hublink.im \
  --build-arg NEXT_PUBLIC_SHOP_DOMAIN=goodshop.hublink.im \
  -t goodfood-admin:latest . 2>&1 | tail -80

echo "=== [4/6] run container (3004 -> 3001) ==="
docker rm -f goodfood-admin 2>/dev/null || true
docker run -d --name goodfood-admin --restart unless-stopped \
  -p 3004:3001 \
  --env-file "$ENVF" \
  -v /home/ubuntu/assets-goodfood:/home/ubuntu/assets \
  goodfood-admin:latest

echo "=== [5/6] nginx + ssl ==="
if ! command -v nginx >/dev/null; then
  apt-get update -qq && apt-get install -y -qq nginx certbot python3-certbot-nginx
fi
cat > /etc/nginx/sites-available/goodshop-admin <<'NGINX'
server {
    listen 80;
    server_name goodshop-admin.hublink.im;
    client_max_body_size 50m;
    proxy_read_timeout 300s;
    location / {
        proxy_pass http://127.0.0.1:3004;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/goodshop-admin /etc/nginx/sites-enabled/goodshop-admin
nginx -t && systemctl reload nginx
certbot --nginx -d goodshop-admin.hublink.im --non-interactive --agree-tos -m skkim3925@gmail.com --redirect \
  || echo "WARN: certbot failed (may already exist)"

echo "=== [6/6] verify ==="
sleep 10
docker ps --filter name=goodfood-admin --format '{{.Names}} {{.Status}} {{.Ports}}'
echo "local /login:"
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3004/login || true
free -h
echo "DONE"
