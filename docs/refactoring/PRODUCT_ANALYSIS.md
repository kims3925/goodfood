# BandAuto DB 리팩토링 설계  
## 목표: CollectedProduct / Product / PublishedProduct 분리

당신은 TypeScript / Next.js / Prisma 환경의 리팩토링을 수행하는 AI 개발자입니다.  
아래 단계에 따라 **기존 Product(수집상품 + 내부상품 역할)를 분리**하여,  

- `CollectedProduct` : 수집된 원본 상품(도매 게시물에서 추출된 상품)
- `Product`          : 내부 기준 상품(우리 쇼핑몰/밴드에서 사용하는 마스터 상품)
- `PublishedProduct` : 채널(소매 밴드 등)에 실제 발행된 상품

구조로 재정리하세요.

---

## 0. 현재 구조 요약

현재 Prisma 스키마의 핵심 모델은 다음과 같다.

### Post (collectedPost 개념)

```prisma
model Post {
  id              Int           @id @default(autoincrement())
  userId          Int           @map("user_id")
  wholesaleBandId Int           @map("wholesale_band_id")
  externalId      String        @map("external_id") @db.VarChar(255)
  title           String        @db.VarChar(500)
  content         String        @db.Text
  author          String?       @db.VarChar(100)
  createdAt       DateTime      @default(now()) @map("created_at") @db.Timestamp(0)
  updatedAt       DateTime      @default(now()) @updatedAt @map("updated_at") @db.Timestamp(0)
  user            User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  wholesaleBand   WholesaleBand @relation("WholesaleBand", fields: [wholesaleBandId], references: [id], onDelete: Cascade)
  comments        PostComment[]
  images          PostImage[]
  product         Product?      // 현재: Post 1 : 1 Product 관계

  @@unique([wholesaleBandId, externalId])
  @@index([userId])
  @@index([wholesaleBandId])
  @@index([createdAt])
  @@index([externalId])
  @@map("post")
}
Product (현재: 수집상품 + 내부상품이 섞여 있음)
model Product {
  id           Int           @id @default(autoincrement())
  userId       Int           @map("user_id")
  postId       Int           @unique @map("post_id")

  name         String        @db.VarChar(500)
  description  String?       @db.Text

  status       ProductStatus @default(DRAFT)

  thumbnailUrl String?       @map("thumbnail_url") @db.VarChar(1000)

  categoryId   String?       @map("category_id") @db.VarChar(100)

  currency       String  @default("KRW") @db.VarChar(10)
  price          Int?
  wholesalePrice Int?    @map("wholesale_price")

  createdAt DateTime  @default(now()) @map("created_at") @db.Timestamp(0)
  updatedAt DateTime  @updatedAt @map("updated_at") @db.Timestamp(0)

  user                   User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  post                   Post             @relation(fields: [postId], references: [id], onDelete: Cascade)
  variants               ProductVariant[]
  options                ProductOption[]
  productPublishes       ProductPublish[]
  publishHistories       PublishHistory[]
  wishlists              Wishlist[]
  inquiries              Inquiry[]

  @@index([userId])
  @@index([postId])
  @@index([categoryId])
  @@index([status])
  @@index([createdAt])
  @@map("product")
}

ProductPublish (publishedProduct 개념)
model ProductPublish {
  id            Int           @id @default(autoincrement())
  userId        Int           @map("user_id")
  productId     Int           @map("product_id")
  retailBandId  Int           @map("retail_band_id")

  status        PublishStatus @default(PENDING)

  createdAt     DateTime @default(now()) @map("created_at") @db.Timestamp(0)
  updatedAt     DateTime @updatedAt @map("updated_at") @db.Timestamp(0)

  user           User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  product        Product           @relation(fields: [productId], references: [id], onDelete: Cascade)
  retailBand     RetailBand        @relation(fields: [retailBandId], references: [id], onDelete: Cascade)
  orderItems     OrderItem[]
  orderTests     OrderTest[]
  cartItems      CartItem[]

  @@unique([productId, retailBandId])
  @@index([userId])
  @@index([productId])
  @@index([retailBandId])
  @@index([status])
  @@map("product_publish")
}

1. 타겟 구조 개념 설계
1-1. 역할 정의

CollectedProduct (신규)

도매 밴드 Post 에서 추출한 “수집 상품”

원본 제목/내용/가격/옵션 정보를 비교적 덜 정제된 상태로 저장

Post 1 : N CollectedProduct 구조를 허용 (향후 하나의 게시물에서 여러 상품으로 쪼개기 위함)

Product (내부 기준 상품, 마스터 상품)

실제 쇼핑몰/소매 밴드에서 사용하는 “정제된 상품”

ProductOption, ProductVariant, Wishlist, Inquiry, ProductPublish, PublishHistory 등은 내부 Product 기준으로 동작

하나의 Product 는 하나의 CollectedProduct 로부터 파생되거나, 나중에는 여러 CollectedProduct를 머지하는 구조도 가능 (초기에는 1:1 FK 기반으로 설계)

PublishedProduct (기존 ProductPublish)

특정 채널(RetailBand)에 실제로 발행된 “리스팅 단위 상품”

하나의 Product 가 여러 PublishedProduct 로 발행될 수 있음 (채널/계정/가격 정책이 다를 수 있음)

2. Prisma 스키마 리팩토링 단계
2-1. CollectedProduct 모델 추가

prisma/schema.prisma 에 CollectedProduct 모델을 새로 추가한다.

초기에는 현재 Product 모델과 필드를 많이 공유해도 괜찮다.

추후 점진적으로 분리/정제할 수 있도록 설계.

예시 스키마 (초안)
model CollectedProduct {
  id             Int      @id @default(autoincrement())
  userId         Int      @map("user_id")
  postId         Int      @map("post_id")

  // 원본에서 추출한 상품 정보 (불완전해도 됨)
  name           String?  @db.VarChar(500)
  description    String?  @db.Text

  currency       String   @default("KRW") @db.VarChar(10)
  price          Int?
  wholesalePrice Int?     @map("wholesale_price")

  // 원본 JSON 그대로 넣고 싶은 경우
  rawMetadata    Json?    @map("raw_metadata")

  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamp(0)
  updatedAt      DateTime @updatedAt @map("updated_at") @db.Timestamp(0)

  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  post           Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  products       Product[]

  @@index([userId])
  @@index([postId])
  @@map("collected_product")
}


Post 모델에 collectedProducts 관계를 추가한다.

model Post {
  // 기존 필드 유지
  // ...

  // 기존: product Product?
  product           Product?           @relation(fields: [/* 나중에 제거 예정 */], references: [id])?
  collectedProducts CollectedProduct[] // 신규 관계

  // @@map("post") 유지
}


주의:
Post–Product 기존 1:1 관계는 바로 제거하지 말고, 이후 단계에서 점진적으로 옮긴 후 제거한다.

2-2. Product 모델을 “내부 기준 상품”으로 변경

Product 모델에 collectedProductId FK 를 추가한다.

model Product {
  id           Int           @id @default(autoincrement())
  userId       Int           @map("user_id")
  postId       Int           @unique @map("post_id") // ← 이 필드는 단계적으로 제거 예정

  // 내부 마스터 상품 정보
  name         String        @db.VarChar(500)
  description  String?       @db.Text

  status       ProductStatus @default(DRAFT)

  thumbnailUrl String?       @map("thumbnail_url") @db.VarChar(1000)
  categoryId   String?       @map("category_id") @db.VarChar(100)

  currency       String  @default("KRW") @db.VarChar(10)
  price          Int?
  wholesalePrice Int?    @map("wholesale_price")

  // 신규: 원본 CollectedProduct 참조 (source)
  collectedProductId Int?              @map("collected_product_id")
  collectedProduct   CollectedProduct? @relation(fields: [collectedProductId], references: [id])

  createdAt DateTime  @default(now()) @map("created_at") @db.Timestamp(0)
  updatedAt DateTime  @updatedAt @map("updated_at") @db.Timestamp(0)

  user             User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  post             Post             @relation(fields: [postId], references: [id], onDelete: Cascade)
  variants         ProductVariant[]
  options          ProductOption[]
  productPublishes ProductPublish[]
  publishHistories PublishHistory[]
  wishlists        Wishlist[]
  inquiries        Inquiry[]

  @@index([userId])
  @@index([postId])
  @@index([categoryId])
  @@index([status])
  @@index([createdAt])
  @@map("product")
}


이후 단계에서 postId 를 제거하고, 원본과의 연결은 CollectedProduct 를 통해 추적하도록 변경할 예정이다.

최종 목표:

Post 1:N CollectedProduct

CollectedProduct 1:N Product (초기에는 1:1도 가능)

Product 에는 더 이상 postId 직접 FK가 없어도 됨

2-3. ProductPublish → PublishedProduct 모델 이름 변경

Prisma 레벨에서 모델 이름을 변경하고 실제 테이블 명도 변경한다.

model PublishedProduct {
  id            Int           @id @default(autoincrement())
  userId        Int           @map("user_id")
  productId     Int           @map("product_id")
  retailBandId  Int           @map("retail_band_id")

  status        PublishStatus @default(PENDING)

  createdAt     DateTime @default(now()) @map("created_at") @db.Timestamp(0)
  updatedAt     DateTime @updatedAt @map("updated_at") @db.Timestamp(0)

  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  product    Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  retailBand RetailBand @relation(fields: [retailBandId], references: [id], onDelete: Cascade)
  orderItems OrderItem[]
  orderTests OrderTest[]
  cartItems  CartItem[]

  @@unique([productId, retailBandId])
  @@index([userId])
  @@index([productId])
  @@index([retailBandId])
  @@index([status])
  @@map("product_publish")
}

model Product {
  // ...
  publishedProducts PublishedProduct[] // 기존 productPublishes
  // ...
}


코드 상에서도 ProductPublish → PublishedProduct 로 이름을 전부 정리한다.

2-4. PublishHistory 정리

현재 스키마:

model PublishHistory {
  id           Int           @id @default(autoincrement())
  userId       Int           @map("user_id")
  productId    Int           @map("product_id")
  retailBandId Int           @map("retail_band_id")
  postKey      String?       @map("post_key") @db.VarChar(255)
  status       PublishStatus @default(PENDING)
  errorMessage String?       @map("error_message") @db.Text
  publishedAt  DateTime      @default(now()) @map("published_at") @db.Timestamp(0)
  product      Product       @relation(fields: [productId], references: [id], onDelete: Cascade)
  retailBand   RetailBand    @relation(fields: [retailBandId], references: [id], onDelete: Cascade)
  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([productId, retailBandId])
  @@index([userId])
  @@index([productId])
  @@index([retailBandId])
  @@index([status])
  @@index([publishedAt])
  @@map("publish_history")
}

@@unique([productId, retailBandId]) 는 제거해야 한다.

  @@index([productId, retailBandId])


필요하다면 PublishedProduct 와의 FK도 추가할 수 있다.

  publishedProductId Int?
  publishedProduct   PublishedProduct? @relation(fields: [publishedProductId], references: [id])

3. 데이터 마이그레이션 단계

코드/DB를 망가뜨리지 않고 안전하게 옮기기 위한 단계다.

3-1. 마이그레이션 1차: 스키마 추가만 먼저

위에서 정의한 대로:

CollectedProduct 모델 추가

Product 에 collectedProductId 추가

PublishedProduct 모델 추가 (기존 ProductPublish 매핑)

PublishHistory 제약 수정(필요 시)

npx prisma migrate dev  또는 prisma migrate 를 통해 DB 스키마를 반영한다.
  중요: Prisma CLI 명령어 실행 시 —schema prisma 옵션을
  사용해야 합니다:
  - npx prisma db push —schema prisma
  - npx prisma generate —schema prisma
  - npx prisma validate —schema prisma

이 시점에서:

기존 기능은 그대로 동작해야 한다.

CollectedProduct 테이블은 비어 있고, 아직 코드에서 사용하지 않는다.

3-2. 기존 Product 데이터를 CollectedProduct 로 복사

임시 스크립트(예: Node/TS) 또는 Raw SQL을 만들어 다음 작업을 수행한다.

각 Product 레코드에 대해:

동일한 userId, postId, name, description, currency, price, wholesalePrice 를 가진 CollectedProduct 레코드 생성

생성된 CollectedProduct.id 를 Product.collectedProductId 에 업데이트

pseudo 코드 예시 (TypeScript):

const products = await prisma.product.findMany();

for (const p of products) {
  const collected = await prisma.collectedProduct.create({
    data: {
      userId: p.userId,
      postId: p.postId,
      name: p.name,
      description: p.description,
      currency: p.currency,
      price: p.price,
      wholesalePrice: p.wholesalePrice,
    },
  });

  await prisma.product.update({
    where: { id: p.id },
    data: {
      collectedProductId: collected.id,
    },
  });
}


이 작업 후:

모든 기존 Product 는 collectedProductId 를 가진 상태가 된다.

추후 Post 와의 직접 연결은 끊고, CollectedProduct 를 통해 거슬러 올라갈 수 있게 된다.

3-3. Product.postId 제거 및 Post.product 관계 정리

Prisma 스키마에서 Product.postId 및 Post.product 필드를 제거하고, 대신:

model Post {
  // ...
  collectedProducts CollectedProduct[]
  // product 필드는 삭제
}

model Product {
  id           Int           @id @default(autoincrement())
  userId       Int           @map("user_id")
  // postId 제거
  // post 관계 제거

  // collectedProductId 만 유지
  collectedProductId Int?              @map("source_collected_product_id")
  collectedProduct   CollectedProduct? @relation(fields: [collectedProductId], references: [id])

  // 나머지 필드/관계 유지
}


다시 prisma migrate 를 수행한다.

이 후:

Post ↔ Product 직접 관계는 사라지고

Post -> CollectedProduct -> Product 로 추적하는 구조가 된다.

4. 애플리케이션 코드 리팩토링 가이드

리팩토링 후 코드 레벨에서 다음과 같이 바꾸어야 한다.

4-1. 기존 Product 사용 위치 점검

post.product 를 사용하던 모든 곳을 검색한다.

역할에 따라 아래와 같이 분리한다.

“원본 게시물에서 바로 상품을 생성/조회하는 기능” → CollectedProduct 기준으로 변경

“실제 쇼핑몰에 보여줄 상품 정보” → Product 기준으로 유지/강화

예시 변경:

// before
const post = await prisma.post.findUnique({
  where: { id: postId },
  include: { product: true },
});

// after
const post = await prisma.post.findUnique({
  where: { id: postId },
  include: {
    collectedProducts: {
      include: {
        products: true, // 각 collectedProduct에서 생성된 내부 Product들
      },
    },
  },
});

4-2. “상품 등록 / AI 상품 등록” 플로우 분리

수집 상품 생성 단계

도매 밴드 게시물 → CollectedProduct 를 생성

내부 상품 생성 단계

CollectedProduct 기반으로 AI 또는 수동 입력으로 Product 생성

발행 단계

내부 Product 를 선택하여 PublishedProduct(기존 ProductPublish) 생성

각 단계는 각각의 테이블을 기준으로 동작하도록 코드를 수정한다.

5. 테스트 및 검증 체크리스트

마이그레이션 이후

기존 상품 리스트 페이지가 정상적으로 동작하는지

기존 발행 내역(ProductPublish → PublishedProduct)이 정상 조회되는지

PublishHistory 가 여전히 정상적으로 쌓이는지

새 플로우

Post 에서 CollectedProduct 를 생성하는 기능

CollectedProduct 를 기반으로 Product 생성 (AI/수동 모두)

Product 를 특정 RetailBand 에 발행하여 PublishedProduct 생성

발행 이력이 PublishHistory 에 누적되는지

데이터 무결성

CollectedProduct.userId = Post.userId 일관성 유지

Product.userId 와 CollectedProduct.userId 일관성 유지

삭제 시 onDelete: Cascade 가 잘 동작하는지 (Post 삭제 → CollectedProduct & Product 영향 확인)

6. 요약

목표:

수집 상품(CollectedProduct), 내부 기준 상품(Product), 발행 상품(PublishedProduct)을 명확히 분리하여,
추후 AI 가공, 멀티 소스, 멀티 채널 발행에 확장 가능한 구조로 만든다.

핵심 단계:

CollectedProduct 모델 추가 및 Post 와의 관계 추가

Product 에 collectedProductId 추가 → 내부 상품을 수집 상품과 연결

기존 Product 데이터를 CollectedProduct 로 복사 + FK 연결

Product.postId 및 Post.product 제거, 경로를 Post -> CollectedProduct -> Product 로 변경

ProductPublish → PublishedProduct 이름 정리

앱 코드에서 수집/내부/발행 단계별로 사용하는 모델을 명확히 분리

이 문서의 순서대로 Prisma 스키마, 마이그레이션, 애플리케이션 코드를 단계적으로 수정하세요.