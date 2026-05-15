# LegacyOrder ETL 실행 가이드

5년치 좋은친구도매방 주문장(xlsx 6파일) 을 `legacy_order` 테이블로 적재.

## 사전 준비

1. **DB 적용 완료 확인** — `legacy_order` 테이블 존재해야 함
   ```bash
   # 운영
   docker exec bandauto-mariadb mysql -ubanduser -p$PASS -D sourcing_db -e "SHOW TABLES LIKE 'legacy_order';"
   ```
   (운영은 이미 적용됨, 2026-05-15)

2. **xlsx 파일 위치** — 기본값: `C:/Users/kims3/SNS_AUTO/기존주문데이터/`
   ```
   좋은친구도매방-21년주문장-211220.xlsx
   좋은친구도매방-22년주문장-220126.xlsx
   좋은친구도매방-22년주문장-221221.xlsx
   좋은친구도매방-주문장-231214.xlsx
   좋은친구도매방-주문장-240521.xlsx
   좋은친구도매방-주문장-250912.xlsx
   ```

## 실행 (로컬 권장)

운영 서버에 5년치 xlsx 파일을 업로드하지 않고 로컬에서 실행해 운영 DB 에 직접 적재.

```bash
cd code/sourcing-app

# 1) 미리보기 (적재 X, 통계만 확인)
npx tsx scripts/etl-legacy-orders.ts --dry-run

# 2) 실제 적재
npx tsx scripts/etl-legacy-orders.ts

# 3) 다른 폴더 지정
npx tsx scripts/etl-legacy-orders.ts --folder="D:/orders"

# 4) 단일 파일
npx tsx scripts/etl-legacy-orders.ts --file=좋은친구도매방-주문장-250912.xlsx
```

### 환경변수

로컬 실행 시 `code/.env` 또는 `code/sourcing-app/.env` 에 운영 DB 접속 정보 필요:

```
DATABASE_URL="mysql://banduser:PASS@HOST:3306/sourcing_db"
```

⚠️ 운영 DB 접속 정보를 로컬 .env 에 둘 때 **버전 관리 제외**(`.env.local`/`.gitignore`).

## 기대 결과

- 6 파일 처리 — 총 시트 ~1,866개
- 신규 적재 ~20,000~40,000행 (2168일 × 10~20 orders/day 추정)
- 멱등성: 여러 번 실행해도 중복 적재 없음 (`@@unique([orderDate, rowIndex, channelName])` + `skipDuplicates`)
- 통계 로그: 파일별 읽음/적재/스킵 카운트, 최종 DB total + 기간

## 운영 적재 후 활성화 단계

1. **ETL 적재 완료 확인**:
   ```sql
   SELECT COUNT(*) FROM legacy_order;
   SELECT MIN(order_date), MAX(order_date) FROM legacy_order;
   ```

2. **BandNoticeConfig 활성화**:
   매니저 → 광고&마케팅 → 밴드공지 → 활성화 토글 ON + 공지 시간 + Top N 설정

3. **다음 cron 시각**(매 정시 11:00/13:00/17:00 ±5분) 에 자동 발화 시작
   - MarketingAgent 가 BandNoticeConfig.isEnabled=true 사용자 iterate
   - ProductManagerAgent 가 popularity.service.getPopularProducts 호출
   - 결과를 Gemini 로 문구 생성 후 RETAIL 채널에 중요공지 게시

## 점수 산식 (참고)

```
popularity_score = 30일 판매횟수(40%) + 마진률(30%) + 시즘성 지수(30%)
```

- 매칭: 상품명에서 의미있는 키워드 추출 → `LegacyOrder.productName LIKE '%키워드%'`
- 정규화: sales 0~100 (count×2 cap 50), margin 0~100, seasonal 0~100

자세한 알고리즘은 `src/modules/analytics/popularity.service.ts` 참조.

## 트러블슈팅

| 증상 | 원인 / 해결 |
|---|---|
| `Cannot find module '@bandauto/db'` | `cd code && npm install` (모노레포 루트에서 의존성 설치) |
| `Table 'legacy_order' doesn't exist` | DB push 누락 — `cd code/db && npx prisma db push --schema prisma` |
| 시트명 날짜 파싱 실패 (스킵 로그) | YYMMDD 또는 MMDD(요일) 외 포맷 — 시트명 확인 |
| 적재 0건 (모든 행 스킵) | 헤더 행 자동 탐지 실패 — `구분/상품명/판매가` 컬럼이 있는지 확인 |
