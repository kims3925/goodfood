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
- **shop-app/**: 쇼핑몰 Next.js 앱 (포트 3000)
- **sourcing-app/**: 소싱 Next.js 앱

## Development Commands

```bash
# 쇼핑몰 앱 실행
cd shop-app && npm run dev

# 소싱 앱 실행
cd sourcing-app && npm run dev
```

## 커밋 메시지 규칙

**중요: 커밋 메시지는 아래 형식을 따릅니다.**

### 형식

```text
type(scope): 한 줄 요약
```

### type 종류

| type | 설명 |
|------|------|
| `feat` | 새로운 기능 추가 |
| `fix` | 버그 수정 |
| `refactor` | 리팩토링 (기능 변경 없음) |
| `perf` | 성능 개선 |
| `test` | 테스트 추가/수정 |
| `docs` | 문서 변경 |
| `chore` | 빌드, 설정 등 기타 변경 |

### scope 종류

| scope | 설명 |
|-------|------|
| `sourcing` | 소싱 앱 변경 |
| `shop` | 쇼핑몰 앱 변경 |
| `db` | 데이터베이스/Prisma 변경 |
| `ci/cd` | CI/CD 파이프라인 변경 |

### 예시

```text
feat(sourcing): 매니저 관리 페이지 추가
fix(shop): 장바구니 수량 계산 오류 수정
refactor(db): User 모델 필드명 정리
docs(sourcing): API 문서 업데이트
```

---

## 문서 업데이트 규칙

**중요: 기능 구현 완료 시 반드시 해당 앱의 docs 폴더 문서를 업데이트해야 합니다.**

### 문서 구조

각 앱(shop-app, sourcing-app)에는 다음 문서들이 있습니다:

| 문서 | 업데이트 시점 |
|------|-------------|
| `docs/STRUCTURE.md` | 폴더/파일 구조 변경 시 |
| `docs/API.md` | API 엔드포인트 추가/변경 시 |
| `docs/FRONTEND.md` | 페이지/컴포넌트 추가/변경 시 |
| `docs/BACKEND.md` | 서버 로직 변경 시 |
| `docs/DATABASE.md` | DB 스키마 변경 시 |
| `docs/tracking/CHANGELOG.md` | 모든 기능 구현 완료 시 |
| `docs/tracking/FLOW.md` | 비즈니스 흐름 변경 시 |

### 업데이트 체크리스트

기능 구현 완료 시 다음을 확인하세요:

- [ ] 새 페이지 추가 → `STRUCTURE.md`, `FRONTEND.md` 업데이트
- [ ] 새 API 추가 → `API.md` 업데이트
- [ ] DB 스키마 변경 → `DATABASE.md` 업데이트
- [ ] 모든 변경사항 → `tracking/CHANGELOG.md`에 기록
