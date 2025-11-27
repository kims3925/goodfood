# Bandauto Project Guidelines

## Prisma CLI Commands

**중요: Prisma CLI 명령어 실행 시 반드시 `--schema prisma` 옵션을 사용해야 합니다.**

```bash
# db 폴더에서 실행
cd db

# Prisma 클라이언트 생성
npx prisma generate --schema prisma

# 데이터베이스 스키마 푸시
npx prisma db push --schema prisma

# 스키마 검증
npx prisma validate --schema prisma

# 데이터베이스에서 스키마 가져오기
npx prisma db pull --schema prisma

# Prisma Studio 실행
npx prisma studio --schema prisma
```

### Prisma 스키마 구조
```
db/prisma/
  schema.prisma      # generator, datasource, enum 정의
  models/
    band.prisma      # WholesaleBand, RetailBand
    cart.prisma      # SessionCart, SessionCartItem, CartItem
    order.prisma     # Order, OrderItem
    payment.prisma   # Payment
    product.prisma   # Product, ProductVariant, ProductOption
    publish.prisma   # ProductPublish, PublishHistory
    user.prisma      # User, SourcingApiConfig, AiApiConfig
    ...etc
```

- `--schema prisma` 옵션은 prisma/ 폴더와 하위 폴더(models/)의 모든 .prisma 파일을 자동으로 로드
- schema.prisma에 enum 정의, models/ 폴더에 model 정의 분리 구조 유지

## Project Structure

- **db/**: 공유 Prisma 데이터베이스 클라이언트 (@bandauto/db)
- **e-commerce-app/**: 쇼핑몰 Next.js 앱 (포트 3000)
- **sourcing-app/**: 소싱 Next.js 앱

## Development Commands

```bash
# 쇼핑몰 앱 실행
cd e-commerce-app && npm run dev

# 소싱 앱 실행
cd sourcing-app && npm run dev
```
