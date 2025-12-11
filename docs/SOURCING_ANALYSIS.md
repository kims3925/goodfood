# Band → Channel 리팩토링 설계  
## 단계 2: 상품 관련 리팩토링(CollectedProduct / Product / PublishedProduct) 완료 이후 진행

당신은 TypeScript / Next.js / Prisma 환경의 리팩토링을 수행하는 AI 개발자입니다.  
이 문서는 **기존 WholesaleBand / RetailBand 스키마를 “Channel”로 통합**하여,  
향후 Band 외의 소싱처/판매처(알리, 스마트스토어, 자체몰 등)를 유연하게 붙일 수 있도록 리팩토링하는 단계별 가이드입니다.

---

## 0. 선행 조건 / 현재 상태 정리

### 0-1. 선행 조건 (이미 끝난 상태로 가정)

이 문서는 다음 작업이 **이미 완료된 상태**를 전제로 합니다.

1. **상품 관련 리팩토링 완료**
   - `CollectedProduct` / `Product` / `PublishedProduct` 구조로 분리
   - `ProductPublish` → `PublishedProduct` 로 모델 이름 변경  
     (`@@map("product_publish")` 로 기존 테이블 사용 가능)
   - `PublishedProduct` 가 `Product` 와 `RetailBand` 를 FK로 가지고 있음

2. `Post` / `Product` / `PublishedProduct` 는 정상 동작 중

---

### 0-2. 현재 Band 관련 스키마 (리팩토링 대상)

#### WholesaleBand (도매 밴드)

```prisma
model WholesaleBand {
  id          Int               @id @default(autoincrement())
  userId      Int               @map("user_id")
  apiConfigId Int               @map("api_config_id")
  bandKey     String            @map("band_key") @db.VarChar(255)
  name        String            @db.VarChar(255)
  coverUrl    String?           @map("cover_url") @db.VarChar(500)
  isActive    Boolean           @default(true) @map("is_active")
  createdAt   DateTime          @default(now()) @map("created_at") @db.Timestamp(0)
  updatedAt   DateTime          @default(now()) @updatedAt @map("updated_at") @db.Timestamp(0)
  posts       Post[]            @relation("WholesaleBand")
  apiConfig   SourcingApiConfig @relation(fields: [apiConfigId], references: [id], onDelete: Cascade)
  user        User              @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, bandKey])
  @@index([userId])
  @@index([apiConfigId])
  @@index([isActive])
  @@map("wholesale_band")
}
RetailBand (소매 밴드)
prisma
코드 복사
model RetailBand {
  id               Int                @id @default(autoincrement())
  userId           Int                @map("user_id")
  apiConfigId      Int                @map("api_config_id")
  bandKey          String             @map("band_key") @db.VarChar(255)
  name             String             @db.VarChar(255)
  coverUrl         String?            @map("cover_url") @db.VarChar(500)
  isActive         Boolean            @default(true) @map("is_active")
  createdAt        DateTime           @default(now()) @map("created_at") @db.Timestamp(0)
  updatedAt        DateTime           @default(now()) @updatedAt @map("updated_at") @db.Timestamp(0)
  formUrl          String?            @map("form_url") @db.VarChar(500)
  accountHolder    String?            @map("account_holder") @db.VarChar(100)
  bankAccount      String?            @map("bank_account") @db.VarChar(50)
  bankName         String?            @map("bank_name") @db.VarChar(50)
  apiConfig        SourcingApiConfig  @relation(fields: [apiConfigId], references: [id], onDelete: Cascade)
  productPublishes PublishedProduct[]
  user             User               @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, bandKey])
  @@index([userId])
  @@index([apiConfigId])
  @@index([isActive])
  @@map("retail_band")
}
1. 타겟 구조 개념 설계
1-1. 문제 인식
현재 스키마는 Band 전용으로 설계되어 있음:

도매: WholesaleBand

소매: RetailBand

향후 소싱처/판매처가 다양해질 경우:

AliExpress, 스마트스토어, 쿠팡, 자체몰, 카페 등

새 플랫폼마다 별도 테이블을 만들게 됨 → 유지보수 난이도 증가

1-2. 목표
Band라는 구체적인 개념을 스키마에서 제거하고,
다음과 같이 추상화된 “채널” 개념으로 통합한다.

Channel (공통 채널 테이블)

ChannelKind enum

WHOLESALE : 소싱용 채널 (도매 밴드, 도매 카페, Ali 등)

RETAIL : 판매용 채널 (소매 밴드, 쇼핑몰, 스마트스토어 등)

ChannelPlatform enum

BAND, NAVER_CAFE, ALIEXPRESS, SMARTSTORE, COUPANG, CUSTOM 등

Post / PublishedProduct 는 이제 WholesaleBand / RetailBand 대신
Channel 을 참조하도록 변경한다.

소싱: Channel(kind=WHOLESALE) → Post → CollectedProduct → Product

발행: Product → PublishedProduct → Channel(kind=RETAIL)

2. Channel 스키마 설계
2-1. enum 정의
prisma
코드 복사
enum ChannelKind {
  WHOLESALE   // 소싱/도매 채널
  RETAIL      // 판매/노출 채널
}

enum ChannelPlatform {
  BAND
  NAVER_CAFE
  ALIEXPRESS
  SMARTSTORE
  COUPANG
  CUSTOM          // 그 외 커스텀 채널
}
2-2. Channel 모델 (WholesaleBand + RetailBand 통합)
두 테이블의 공통 필드 + 소매 전용 필드를 모두 포함하는 형태로 설계한다.

prisma
코드 복사
model Channel {
  id          Int            @id @default(autoincrement())
  userId      Int            @map("user_id")
  apiConfigId Int            @map("api_config_id")

  kind        ChannelKind
  platform    ChannelPlatform

  channelKey  String         @map("channel_key") @db.VarChar(255) // 기존 bandKey
  name        String         @db.VarChar(255)
  coverUrl    String?        @map("cover_url") @db.VarChar(500)
  isActive    Boolean        @default(true) @map("is_active")

  // Retail 전용 필드 (WHOLESALE인 경우 대부분 null)
  formUrl       String?      @map("form_url") @db.VarChar(500)
  accountHolder String?      @map("account_holder") @db.VarChar(100)
  bankAccount   String?      @map("bank_account") @db.VarChar(50)
  bankName      String?      @map("bank_name") @db.VarChar(50)

  createdAt   DateTime       @default(now()) @map("created_at") @db.Timestamp(0)
  updatedAt   DateTime       @default(now()) @updatedAt @map("updated_at") @db.Timestamp(0)

  // 관계
  apiConfig         SourcingApiConfig @relation(fields: [apiConfigId], references: [id], onDelete: Cascade)
  user              User              @relation(fields: [userId], references: [id], onDelete: Cascade)

  // kind=WHOLESALE 일 때 사용
  posts             Post[]      // 기존 wholesaleBand.posts

  // kind=RETAIL 일 때 사용
  publishedProducts PublishedProduct[] // 기존 retailBand.productPublishes

  @@unique([userId, channelKey])
  @@index([userId])
  @@index([apiConfigId])
  @@index([isActive])
  @@index([kind, platform])
  @@map("channel")
}
3. Post / PublishedProduct 스키마 변경
3-1. Post (도매 게시물) 에 Channel 연결
기존에는 Post 가 WholesaleBand에만 연결되어 있었음:

prisma
코드 복사
// Before (개념)
model Post {
  // ...
  wholesaleBandId Int           @map("wholesale_band_id")
  wholesaleBand   WholesaleBand @relation("WholesaleBand", fields: [wholesaleBandId], references: [id], onDelete: Cascade)
}
목표:
Post 는 이제 소싱 채널(Channel.kind = WHOLESALE) 을 참조한다.

prisma
코드 복사
// After
model Post {
  id              Int           @id @default(autoincrement())
  // ...
  channelId       Int           @map("channel_id")
  channel         Channel       @relation(fields: [channelId], references: [id], onDelete: Cascade)

  // 기존: wholesaleBand, wholesaleBandId 관계 필드는 제거 예정
  // collectedProducts, images, comments 등은 그대로 유지
}
마이그레이션 과정에서는 wholesaleBandId 및 관계를 바로 제거하지 말고,
Channel 데이터 마이그레이션 완료 후 마지막 단계에서 제거한다.

3-2. PublishedProduct (발행 상품) 에 Channel 연결
상품 리팩토링 이후 상태 기준:

prisma
코드 복사
// (전제) 상품 리팩토링 이후 구조 예시
model PublishedProduct {
  id           Int           @id @default(autoincrement())
  userId       Int           @map("user_id")
  productId    Int           @map("product_id")
  retailBandId Int           @map("retail_band_id")  // 현재 상태

  status       PublishStatus @default(PENDING)

  createdAt    DateTime      @default(now()) @map("created_at") @db.Timestamp(0)
  updatedAt    DateTime      @updatedAt @map("updated_at") @db.Timestamp(0)

  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  product      Product       @relation(fields: [productId], references: [id], onDelete: Cascade)
  retailBand   RetailBand    @relation(fields: [retailBandId], references: [id], onDelete: Cascade)

  @@unique([productId, retailBandId])
  @@index([userId])
  @@index([productId])
  @@index([retailBandId])
  @@index([status])
  @@map("product_publish")
}
목표:
PublishedProduct 는 이제 판매 채널(Channel.kind = RETAIL) 을 참조한다.

prisma
코드 복사
// After
model PublishedProduct {
  id           Int           @id @default(autoincrement())
  userId       Int           @map("user_id")
  productId    Int           @map("product_id")

  channelId    Int           @map("channel_id")
  channel      Channel       @relation(fields: [channelId], references: [id], onDelete: Cascade)

  status       PublishStatus @default(PENDING)
  createdAt    DateTime      @default(now()) @map("created_at") @db.Timestamp(0)
  updatedAt    DateTime      @updatedAt @map("updated_at") @db.Timestamp(0)

  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  product      Product       @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@unique([productId, channelId])
  @@index([userId])
  @@index([productId])
  @@index([channelId])
  @@index([status])
  @@map("product_publish")
}
마이그레이션 과정에서는 retailBandId / retailBand 필드를 바로 지우지 말고,
Channel로 데이터 이관이 끝난 후 마지막 단계에서 제거한다.

4. 마이그레이션 단계 (DB / 데이터)
4-1. 1차 마이그레이션: Channel 모델 추가 + Post/PublishedProduct 에 channelId 추가
ChannelKind, ChannelPlatform, Channel 모델을 추가한다.

Post 모델에 channelId/channel 필드를 추가 (기존 wholesaleBand 유지)

PublishedProduct 에 channelId/channel 필드를 추가 (기존 retailBand 유지)

prisma migrate 를 수행하여 스키마를 DB에 반영한다.

이 시점에서:

기존 기능은 그대로 동작해야 한다.

Channel 테이블은 비어 있음.

Post.channelId / PublishedProduct.channelId 는 아직 null 또는 default 값.

4-2. 2차 마이그레이션: WholesaleBand / RetailBand → Channel 데이터 복사
WholesaleBand → Channel (kind=WHOLESALE, platform=BAND)

Pseudo 코드 (TypeScript 예시):

ts
코드 복사
const wholesaleBands = await prisma.wholesaleBand.findMany();

for (const wb of wholesaleBands) {
  await prisma.channel.create({
    data: {
      userId: wb.userId,
      apiConfigId: wb.apiConfigId,
      kind: 'WHOLESALE',
      platform: 'BAND',

      channelKey: wb.bandKey,
      name: wb.name,
      coverUrl: wb.coverUrl,
      isActive: wb.isActive,

      // 구매/계좌 관련 정보는 없음 → null
      formUrl: null,
      accountHolder: null,
      bankAccount: null,
      bankName: null,
    },
  });
}
RetailBand → Channel (kind=RETAIL, platform=BAND)

ts
코드 복사
const retailBands = await prisma.retailBand.findMany();

for (const rb of retailBands) {
  await prisma.channel.create({
    data: {
      userId: rb.userId,
      apiConfigId: rb.apiConfigId,
      kind: 'RETAIL',
      platform: 'BAND',

      channelKey: rb.bandKey,
      name: rb.name,
      coverUrl: rb.coverUrl,
      isActive: rb.isActive,

      formUrl: rb.formUrl,
      accountHolder: rb.accountHolder,
      bankAccount: rb.bankAccount,
      bankName: rb.bankName,
    },
  });
}
생성된 Channel 레코드의 id 와 기존 WholesaleBand.id / RetailBand.id 의 맵핑을
메모리 또는 임시 테이블에 보관한다. (다음 단계에서 필요)

4-3. 3차 마이그레이션: Post / PublishedProduct 의 channelId 채우기
Post 의 wholesaleBandId 를 기준으로 channelId 를 매핑

ts
코드 복사
const channels = await prisma.channel.findMany();
const channelByBand = new Map<string, number>();
// key: `WHOLESALE:${userId}:${bandKey}` 형태 등으로 구성

for (const ch of channels) {
  if (ch.kind === 'WHOLESALE') {
    channelByBand.set(`WHOLESALE:${ch.userId}:${ch.channelKey}`, ch.id);
  }
}

const posts = await prisma.post.findMany({ include: { wholesaleBand: true } });

for (const post of posts) {
  const wb = post.wholesaleBand;
  if (!wb) continue;

  const key = `WHOLESALE:${wb.userId}:${wb.bandKey}`;
  const channelId = channelByBand.get(key);
  if (!channelId) continue;

  await prisma.post.update({
    where: { id: post.id },
    data: { channelId },
  });
}
PublishedProduct 의 retailBandId 를 기준으로 channelId 를 매핑

ts
코드 복사
const retailChannels = await prisma.channel.findMany({
  where: { kind: 'RETAIL' },
});

const retailChannelByBand = new Map<string, number>();
for (const ch of retailChannels) {
  retailChannelByBand.set(`RETAIL:${ch.userId}:${ch.channelKey}`, ch.id);
}

const publishedList = await prisma.publishedProduct.findMany({
  include: { retailBand: true },
});

for (const pub of publishedList) {
  const rb = pub.retailBand;
  if (!rb) continue;

  const key = `RETAIL:${rb.userId}:${rb.bandKey}`;
  const channelId = retailChannelByBand.get(key);
  if (!channelId) continue;

  await prisma.publishedProduct.update({
    where: { id: pub.id },
    data: { channelId },
  });
}
4-4. 4차 마이그레이션: Prisma 스키마에서 Band 의존 제거
Post 에서 wholesaleBandId 필드 및 wholesaleBand 관계 제거

prisma
코드 복사
model Post {
  // ...
  // wholesaleBandId Int           @map("wholesale_band_id")
  // wholesaleBand   WholesaleBand @relation("WholesaleBand", fields: [wholesaleBandId], references: [id], onDelete: Cascade)

  channelId Int     @map("channel_id")
  channel   Channel @relation(fields: [channelId], references: [id], onDelete: Cascade)
}
PublishedProduct 에서 retailBandId / retailBand 관계 제거

prisma
코드 복사
model PublishedProduct {
  // ...
  // retailBandId Int
  // retailBand   RetailBand @relation(fields: [retailBandId], references: [id])

  channelId Int     @map("channel_id")
  channel   Channel @relation(fields: [channelId], references: [id], onDelete: Cascade)
}
WholesaleBand / RetailBand 모델 자체는

초기에 read-only legacy 용으로 남겨두거나

필요 없으면 @@map("wholesale_band"), @@map("retail_band") 와 함께 완전히 제거한다.
(실제 테이블 드롭 여부는 운영 안정성을 고려해 결정)

변경된 스키마로 prisma migrate 수행.

5. 애플리케이션 코드 리팩토링 가이드
5-1. 기존 Band 기반 코드 검색 키워드
아래 키워드로 전체 프로젝트 검색:

WholesaleBand

RetailBand

wholesaleBandId

retailBandId

productPublishes (RetailBand 쪽 관계)

posts (WholesaleBand 쪽 관계)

각 사용처에서 역할을 분석 후, Channel 기반으로 치환한다.

5-2. 예시: 도매 밴드 목록 조회 → 소싱 채널 목록 조회
ts
코드 복사
// Before
const wholesaleBands = await prisma.wholesaleBand.findMany({
  where: { userId, isActive: true },
});

// After
const sourcingChannels = await prisma.channel.findMany({
  where: {
    userId,
    kind: 'WHOLESALE',
    isActive: true,
  },
});
5-3. 예시: 소매 밴드에 발행 → 판매 채널에 발행
ts
코드 복사
// Before
await prisma.publishedProduct.create({
  data: {
    userId,
    productId,
    retailBandId,
    status: 'PENDING',
  },
});

// After
await prisma.publishedProduct.create({
  data: {
    userId,
    productId,
    channelId,       // kind=RETAIL 인 Channel.id
    status: 'PENDING',
  },
});
5-4. 예시: “밴드 + 쇼핑몰 둘 다 발행”
ts
코드 복사
// Before: RetailBand 기준
// 소매 밴드 + 쇼핑몰(별도 RetailBand) 두 개에 create

// After: Channel 기준
const ops = [];

if (publishToBand) {
  ops.push(prisma.publishedProduct.create({
    data: {
      userId,
      productId,
      channelId: BAND_CHANNEL_ID,  // Channel(kind=RETAIL, platform=BAND)
      status: 'PENDING',
    },
  }));
}

if (publishToMall) {
  ops.push(prisma.publishedProduct.create({
    data: {
      userId,
      productId,
      channelId: MALL_CHANNEL_ID,  // Channel(kind=RETAIL, platform=SMARTSTORE or CUSTOM)
      status: 'PENDING',
    },
  }));
}

await prisma.$transaction(ops);
5-5. 예시: “도매 밴드에서 수집한 게시물 리스트” → “소싱 채널별 게시물 리스트”
ts
코드 복사
// Before
const posts = await prisma.post.findMany({
  where: { wholesaleBandId },
});

// After
const posts = await prisma.post.findMany({
  where: { channelId }, // Channel(kind=WHOLESALE)
});
6. 요약
목표:

WholesaleBand / RetailBand 를 추상화된 Channel 모델로 통합하여
Band 외 다양한 소싱/판매 채널을 수용할 수 있는 구조로 리팩토링한다.

핵심 변경 사항:

ChannelKind, ChannelPlatform, Channel 모델 추가

Post → wholesaleBand 대신 channel(kind=WHOLESALE) 참조

PublishedProduct → retailBand 대신 channel(kind=RETAIL) 참조

기존 Band 테이블 데이터를 Channel 으로 복사 후,
Post.channelId / PublishedProduct.channelId 를 채워넣는 데이터 마이그레이션 수행

Band 관련 모델/필드를 점진적으로 제거하고,
애플리케이션 코드에서 WholesaleBand / RetailBand 사용 부분을 모두 Channel 기반으로 치환

이 문서의 단계 순서대로 Prisma 스키마, 데이터 마이그레이션, 코드 리팩토링을 수행하세요.