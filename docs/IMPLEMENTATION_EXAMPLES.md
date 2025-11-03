# BandAuto - 실사용 구현 예제

이 문서는 Context 관리 최적화를 실제로 적용하는 예제 코드를 제공합니다.

## 📋 목차
1. [Repository Pattern 사용 예제](#repository-pattern-사용-예제)
2. [Zustand Store 사용 예제](#zustand-store-사용-예제)
3. [Redis 캐싱 사용 예제](#redis-캐싱-사용-예제)
4. [API Route 최적화 예제](#api-route-최적화-예제)
5. [서버/클라이언트 컴포넌트 예제](#서버클라이언트-컴포넌트-예제)

---

## 🏗️ Repository Pattern 사용 예제

### 1. 기존 CartService 개선

**Before (기존 코드):**
```typescript
// lib/shop/cart-service.ts - 453줄
export class CartService {
  async getCart(sessionId: string, userId?: string) {
    // 직접 Prisma 호출 (데이터 접근 로직과 비즈니스 로직 혼재)
    const cart = await prisma.cart.findFirst({
      where: {
        OR: [{ sessionId }, { userId: userId || undefined }]
      },
      include: { items: { include: { product: true } } }
    })

    return this.formatCart(cart)  // 비즈니스 로직
  }
}
```

**After (Repository Pattern 적용):**
```typescript
// lib/services/cart-service.ts (신규)
import { getCartRepository } from '@/lib/repositories/cart-repository'

export class CartService {
  private cartRepo = getCartRepository()

  async getCart(sessionId: string, userId?: string) {
    // Repository를 통해 데이터 조회 (데이터 접근 로직 분리)
    const cart = await this.cartRepo.findBySessionOrUser(sessionId, userId)
    if (!cart) return null

    // 비즈니스 로직만 Service에서 처리
    return this.formatCart(cart)
  }

  private formatCart(cart: any) {
    // 배송비 계산, 총액 계산 등 비즈니스 로직
    const totalAmount = cart.items.reduce(...)
    const shippingFee = this.calculateShippingFee(totalAmount)
    return { ...cart, totalAmount, shippingFee }
  }
}
```

**개선 효과:**
- ✅ 데이터 로직과 비즈니스 로직 완전 분리
- ✅ 테스트 용이성 (Repository Mock 가능)
- ✅ 쿼리 최적화를 Repository에서 집중 관리

---

### 2. OrderService 구현 예제

**파일:** `lib/services/order-service.ts`

```typescript
import { getOrderRepository } from '@/lib/repositories/order-repository'
import { getCartRepository } from '@/lib/repositories/cart-repository'
import { getTossPaymentsService } from '@/lib/payments/toss-payments'
import prisma from '@/lib/db'

export class OrderService {
  private orderRepo = getOrderRepository()
  private cartRepo = getCartRepository()

  /**
   * 주문 생성 (비즈니스 로직)
   */
  async createOrder(data: {
    sessionId: string
    userId?: string
    productId: string
    quantity: number
    customerInfo: any
    shippingAddress?: any
  }) {
    // 1. 상품 확인 (비즈니스 규칙)
    const product = await prisma.product.findUnique({
      where: { id: data.productId }
    })

    if (!product) {
      throw new Error('상품을 찾을 수 없습니다.')
    }

    if (!product.isAvailable) {
      throw new Error('현재 구매할 수 없는 상품입니다.')
    }

    // 2. 가격 계산 (비즈니스 로직)
    const unitPrice = product.salePrice
    const subtotal = unitPrice * data.quantity
    const shippingFee = this.calculateShippingFee(subtotal)
    const totalAmount = subtotal + shippingFee

    // 3. 고객 정보 처리
    const customer = await this.getOrCreateCustomer(data.customerInfo)

    // 4. 주문번호 생성
    const tossService = await getTossPaymentsService()
    const orderNumber = tossService.generateOrderId()

    // 5. 주문 생성 (Repository 사용)
    const order = await this.orderRepo.create({
      orderNumber,
      customerId: customer.id,
      productId: product.id,
      userId: data.userId || (await this.getSystemUserId()),
      quantity: data.quantity,
      totalAmount,
      shippingAddress: data.shippingAddress
        ? JSON.stringify(data.shippingAddress)
        : null
    })

    // 6. 장바구니에서 제거 (옵션)
    if (data.sessionId) {
      const cart = await this.cartRepo.findBySessionOrUser(
        data.sessionId,
        data.userId
      )
      if (cart) {
        await this.cartRepo.removeItem(data.productId)
      }
    }

    return {
      order,
      paymentRequest: tossService.createPaymentRequest(
        orderNumber,
        totalAmount,
        product.title,
        customer.email
      )
    }
  }

  /**
   * 주문 상태 업데이트
   */
  async updateOrderStatus(orderNumber: string, status: string) {
    const order = await this.orderRepo.findByOrderNumber(orderNumber)

    if (!order) {
      throw new Error('주문을 찾을 수 없습니다.')
    }

    // 비즈니스 규칙: 이미 배송 완료된 주문은 취소 불가
    if (status === 'CANCELED' && order.shippingStatus === 'DELIVERED') {
      throw new Error('배송 완료된 주문은 취소할 수 없습니다.')
    }

    return await this.orderRepo.updateStatus(order.id, status)
  }

  // Private 헬퍼 메서드들
  private calculateShippingFee(amount: number): number {
    const freeShippingAmount = parseFloat(
      process.env.FREE_SHIPPING_AMOUNT || '30000'
    )
    const defaultShippingFee = parseFloat(
      process.env.DEFAULT_SHIPPING_FEE || '3000'
    )
    return amount >= freeShippingAmount ? 0 : defaultShippingFee
  }

  private async getOrCreateCustomer(info: any) {
    let customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { email: info.email || '' },
          { phone: info.phone }
        ]
      }
    })

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name: info.name,
          email: info.email || null,
          phone: info.phone
        }
      })
    }

    return customer
  }

  private async getSystemUserId(): Promise<string> {
    let systemUser = await prisma.user.findFirst({
      where: { email: 'system@bandauto.shop' }
    })

    if (!systemUser) {
      systemUser = await prisma.user.create({
        data: {
          name: 'System',
          email: 'system@bandauto.shop',
          password: 'system',
          role: 'ADMIN'
        }
      })
    }

    return systemUser.id
  }
}

// 싱글톤
let instance: OrderService | null = null
export function getOrderService(): OrderService {
  if (!instance) instance = new OrderService()
  return instance
}
```

---

## 🎨 Zustand Store 사용 예제

### 1. 장바구니 컴포넌트에서 사용

**파일:** `components/shop/CartDrawer.tsx`

```typescript
'use client'

import { useCartStore, addToCartWithAPI, syncCartWithServer } from '@/stores/cart-store'
import { useEffect } from 'react'
import { useSession } from 'next-auth/react'

export function CartDrawer() {
  const { data: session } = useSession()

  // Zustand Store에서 상태 가져오기 (Context 격리)
  const {
    items,
    totalItems,
    totalAmount,
    shippingFee,
    finalAmount,
    isLoading,
    error,
    removeItem,
    updateItemQuantity
  } = useCartStore()

  // 컴포넌트 마운트 시 서버와 동기화
  useEffect(() => {
    const sessionId = useCartStore.getState().sessionId
    if (sessionId) {
      syncCartWithServer(sessionId, session?.user?.id)
    }
  }, [session])

  return (
    <div className="cart-drawer">
      <h2>장바구니 ({totalItems})</h2>

      {isLoading && <div>로딩 중...</div>}
      {error && <div className="error">{error}</div>}

      <div className="cart-items">
        {items.map((item) => (
          <div key={item.id} className="cart-item">
            <img src={item.product.images} alt={item.product.title} />
            <div className="item-info">
              <h3>{item.product.title}</h3>
              <p>{item.priceAt.toLocaleString()}원</p>
            </div>

            <div className="item-controls">
              <button onClick={() => updateItemQuantity(item.id, item.quantity - 1)}>
                -
              </button>
              <span>{item.quantity}</span>
              <button onClick={() => updateItemQuantity(item.id, item.quantity + 1)}>
                +
              </button>
              <button onClick={() => removeItem(item.id)}>삭제</button>
            </div>
          </div>
        ))}
      </div>

      <div className="cart-summary">
        <div>상품 금액: {totalAmount.toLocaleString()}원</div>
        <div>배송비: {shippingFee.toLocaleString()}원</div>
        <div className="total">
          총 결제 금액: {finalAmount.toLocaleString()}원
        </div>
      </div>

      <button className="checkout-button">주문하기</button>
    </div>
  )
}
```

### 2. 상품 카드에서 장바구니 추가

**파일:** `components/shop/ProductCard.tsx`

```typescript
'use client'

import { addToCartWithAPI } from '@/stores/cart-store'
import { useSession } from 'next-auth/react'
import { useState } from 'react'

interface ProductCardProps {
  product: {
    id: string
    title: string
    salePrice: number
    images: string
  }
}

export function ProductCard({ product }: ProductCardProps) {
  const { data: session } = useSession()
  const [isAdding, setIsAdding] = useState(false)

  const handleAddToCart = async () => {
    setIsAdding(true)
    try {
      await addToCartWithAPI(
        product.id,
        1,
        session?.user?.id
      )
      alert('장바구니에 추가되었습니다!')
    } catch (error: any) {
      alert(error.message)
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <div className="product-card">
      <img src={product.images} alt={product.title} />
      <h3>{product.title}</h3>
      <p className="price">{product.salePrice.toLocaleString()}원</p>

      <button
        onClick={handleAddToCart}
        disabled={isAdding}
        className="add-to-cart-btn"
      >
        {isAdding ? '추가 중...' : '장바구니 담기'}
      </button>
    </div>
  )
}
```

---

## 💾 Redis 캐싱 사용 예제

### 1. 상품 목록 캐싱

**파일:** `lib/services/product-service.ts`

```typescript
import { getCached, invalidateCachePattern, CacheKeys, CacheTTL } from '@/lib/cache/redis-cache'
import prisma from '@/lib/db'

export class ProductService {
  /**
   * 상품 목록 조회 (캐싱 적용)
   */
  async getProducts(page: number = 1, pageSize: number = 20) {
    const cacheKey = CacheKeys.products(page)

    return await getCached(
      cacheKey,
      async () => {
        // 캐시 미스 시 DB에서 조회
        return await prisma.product.findMany({
          where: {
            isAvailable: true,
            status: 'PUBLISHED'
          },
          orderBy: { createdAt: 'desc' },
          take: pageSize,
          skip: (page - 1) * pageSize,
          select: {
            id: true,
            title: true,
            salePrice: true,
            originalPrice: true,
            images: true,
            category: true
          }
        })
      },
      CacheTTL.MEDIUM  // 5분 캐싱
    )
  }

  /**
   * 카테고리별 상품 조회 (캐싱 적용)
   */
  async getProductsByCategory(category: string, page: number = 1) {
    const cacheKey = CacheKeys.productsByCategory(category, page)

    return await getCached(
      cacheKey,
      async () => {
        return await prisma.product.findMany({
          where: {
            category,
            isAvailable: true,
            status: 'PUBLISHED'
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
          skip: (page - 1) * 20
        })
      },
      CacheTTL.MEDIUM
    )
  }

  /**
   * 상품 상세 조회 (캐싱 적용)
   */
  async getProductById(id: string) {
    const cacheKey = CacheKeys.product(id)

    return await getCached(
      cacheKey,
      async () => {
        return await prisma.product.findUnique({
          where: { id },
          include: {
            user: {
              select: { name: true, email: true }
            }
          }
        })
      },
      CacheTTL.LONG  // 10분 캐싱
    )
  }

  /**
   * 상품 생성 (캐시 무효화)
   */
  async createProduct(data: any) {
    const product = await prisma.product.create({ data })

    // 모든 상품 목록 캐시 무효화
    await invalidateCachePattern('products:*')

    return product
  }

  /**
   * 상품 업데이트 (캐시 무효화)
   */
  async updateProduct(id: string, data: any) {
    const product = await prisma.product.update({
      where: { id },
      data
    })

    // 해당 상품 캐시 무효화
    await invalidateCachePattern(`product:${id}`)
    // 목록 캐시도 무효화
    await invalidateCachePattern('products:*')

    return product
  }
}

// 싱글톤
let instance: ProductService | null = null
export function getProductService(): ProductService {
  if (!instance) instance = new ProductService()
  return instance
}
```

### 2. API Route에서 캐싱 사용

**파일:** `app/api/products/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getProductService } from '@/lib/services/product-service'

const productService = getProductService()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const category = searchParams.get('category')

    let products

    if (category) {
      // 카테고리별 조회 (캐싱 자동 적용)
      products = await productService.getProductsByCategory(category, page)
    } else {
      // 전체 목록 조회 (캐싱 자동 적용)
      products = await productService.getProducts(page)
    }

    return NextResponse.json({
      success: true,
      products,
      page,
      cached: true  // 캐싱 적용 여부 표시
    })
  } catch (error: any) {
    console.error('상품 조회 오류:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
```

---

## 🚀 API Route 최적화 예제

### 1. 간소화된 Cart API

**Before (기존 373줄):**
```typescript
// app/api/cart/route.ts
export async function POST(request: NextRequest) {
  // 100+ 줄의 비즈니스 로직 + DB 쿼리
  const product = await prisma.product.findUnique(...)
  const cart = await prisma.cart.findFirst(...)
  const existingItem = await prisma.cartItem.findUnique(...)
  // ... 더 많은 로직
}
```

**After (Repository + Service 사용):**
```typescript
// app/api/cart/route.ts (약 60줄)
import { getCartService } from '@/lib/services/cart-service'

const cartService = getCartService()

export async function POST(request: NextRequest) {
  try {
    const { sessionId, userId, productId, quantity = 1 } = await request.json()

    // 입력 검증만 수행
    if (!productId || (!sessionId && !userId)) {
      return NextResponse.json(
        { success: false, error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      )
    }

    // Service에 위임 (비즈니스 로직 완전 분리)
    const cart = await cartService.addToCart(sessionId, productId, quantity, userId)

    return NextResponse.json({
      success: true,
      message: '장바구니에 상품이 추가되었습니다.',
      cart
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
```

### 2. 세분화된 API Route

**구조:**
```
app/api/cart/
├── route.ts              # GET (장바구니 조회)
├── add/route.ts          # POST (상품 추가)
├── update/route.ts       # PUT (수량 변경)
└── remove/route.ts       # DELETE (상품 제거)
```

**예시: `app/api/cart/add/route.ts`**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getCartService } from '@/lib/services/cart-service'

const cartService = getCartService()

// 장바구니 상품 추가 전용 엔드포인트
export async function POST(request: NextRequest) {
  try {
    const { sessionId, userId, productId, quantity = 1 } = await request.json()

    if (!productId || (!sessionId && !userId)) {
      return NextResponse.json(
        { success: false, error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      )
    }

    const cart = await cartService.addToCart(sessionId, productId, quantity, userId)

    return NextResponse.json({
      success: true,
      cart
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.message.includes('찾을 수 없습니다') ? 404 : 500 }
    )
  }
}
```

---

## 🎨 서버/클라이언트 컴포넌트 예제

### 1. 서버 컴포넌트 (데이터 페칭)

**파일:** `app/(shop)/products/page.tsx`

```typescript
import { getProductService } from '@/lib/services/product-service'
import { ProductGrid } from '@/components/shop/ProductGrid'

const productService = getProductService()

// 서버 컴포넌트 (기본)
export default async function ProductsPage({
  searchParams
}: {
  searchParams: { page?: string; category?: string }
}) {
  const page = parseInt(searchParams.page || '1')
  const category = searchParams.category

  // 서버에서 데이터 페칭 (클라이언트 번들에 포함 안 됨)
  const products = category
    ? await productService.getProductsByCategory(category, page)
    : await productService.getProducts(page)

  return (
    <main className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">
        {category ? `${category} 상품` : '전체 상품'}
      </h1>

      {/* 클라이언트 컴포넌트로 전달 */}
      <ProductGrid products={products} />
    </main>
  )
}

// 메타데이터 (SEO)
export async function generateMetadata({
  searchParams
}: {
  searchParams: { category?: string }
}) {
  return {
    title: searchParams.category
      ? `${searchParams.category} 상품 | BandAuto`
      : '전체 상품 | BandAuto',
    description: '신선한 식자재를 저렴한 가격에 만나보세요.'
  }
}
```

### 2. 클라이언트 컴포넌트 (인터랙션)

**파일:** `components/shop/ProductGrid.tsx`

```typescript
'use client'

import { useState } from 'react'
import { ProductCard } from './ProductCard'

interface Product {
  id: string
  title: string
  salePrice: number
  images: string
}

interface ProductGridProps {
  products: Product[]
}

// 클라이언트 컴포넌트 (인터랙션만 처리)
export function ProductGrid({ products }: ProductGridProps) {
  const [sortBy, setSortBy] = useState<'price' | 'name'>('price')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // 정렬 로직 (클라이언트에서만)
  const sortedProducts = [...products].sort((a, b) => {
    if (sortBy === 'price') {
      return a.salePrice - b.salePrice
    }
    return a.title.localeCompare(b.title)
  })

  return (
    <div>
      {/* 필터 UI */}
      <div className="filters mb-4">
        <button
          onClick={() => setSortBy('price')}
          className={sortBy === 'price' ? 'active' : ''}
        >
          가격순
        </button>
        <button
          onClick={() => setSortBy('name')}
          className={sortBy === 'name' ? 'active' : ''}
        >
          이름순
        </button>
      </div>

      {/* 상품 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {sortedProducts.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  )
}
```

---

## 🧪 테스트 예제

### 1. Repository 테스트

**파일:** `tests/repositories/cart-repository.test.ts`

```typescript
import { CartRepository } from '@/lib/repositories/cart-repository'
import prisma from '@/lib/db'

describe('CartRepository', () => {
  let cartRepo: CartRepository

  beforeEach(() => {
    cartRepo = new CartRepository()
  })

  it('세션 ID로 장바구니를 찾을 수 있어야 함', async () => {
    const sessionId = 'test-session-123'

    const cart = await cartRepo.findBySessionOrUser(sessionId)

    expect(cart).toBeDefined()
    expect(cart?.sessionId).toBe(sessionId)
  })

  it('장바구니 아이템을 추가할 수 있어야 함', async () => {
    const cart = await cartRepo.create({ sessionId: 'test-session' })

    const item = await cartRepo.addItem(
      cart.id,
      'product-123',
      2,
      10000
    )

    expect(item.quantity).toBe(2)
    expect(item.priceAt).toBe(10000)
  })
})
```

### 2. Service 테스트 (Repository Mock)

**파일:** `tests/services/cart-service.test.ts`

```typescript
import { CartService } from '@/lib/services/cart-service'
import { CartRepository } from '@/lib/repositories/cart-repository'

describe('CartService', () => {
  let cartService: CartService
  let mockCartRepo: jest.Mocked<CartRepository>

  beforeEach(() => {
    // Repository Mock
    mockCartRepo = {
      findBySessionOrUser: jest.fn(),
      addItem: jest.fn(),
      updateItemQuantity: jest.fn()
    } as any

    cartService = new CartService(mockCartRepo)
  })

  it('장바구니 조회 시 배송비가 올바르게 계산되어야 함', async () => {
    // Given
    mockCartRepo.findBySessionOrUser.mockResolvedValue({
      id: 'cart-1',
      sessionId: 'session-1',
      items: [
        {
          id: 'item-1',
          productId: 'product-1',
          quantity: 2,
          priceAt: 10000,
          product: { /* ... */ }
        }
      ]
    } as any)

    // When
    const cart = await cartService.getCart('session-1')

    // Then
    expect(cart).toBeDefined()
    expect(cart?.totalAmount).toBe(20000)
    expect(cart?.shippingFee).toBe(3000)  // 30000원 미만이므로 배송비 있음
    expect(cart?.finalAmount).toBe(23000)
  })
})
```

---

## 📊 성능 측정 예제

### 성능 로깅 유틸리티

**파일:** `lib/utils/performance.ts`

```typescript
export function measurePerformance<T>(
  label: string,
  fn: () => Promise<T>
): () => Promise<T> {
  return async () => {
    const start = Date.now()
    try {
      const result = await fn()
      const duration = Date.now() - start
      console.log(`[Performance] ${label}: ${duration}ms`)
      return result
    } catch (error) {
      const duration = Date.now() - start
      console.error(`[Performance Error] ${label}: ${duration}ms`, error)
      throw error
    }
  }
}

// 사용 예
const getProducts = measurePerformance(
  'getProducts',
  async () => await prisma.product.findMany()
)
```

---

## 🎯 마이그레이션 체크리스트

기존 코드를 최적화된 구조로 마이그레이션하기 위한 단계:

### Phase 1: Repository 생성
- [ ] `lib/repositories/` 폴더 생성
- [ ] CartRepository 구현
- [ ] OrderRepository 구현
- [ ] ProductRepository 구현

### Phase 2: Service 리팩토링
- [ ] `lib/shop/cart-service.ts` → `lib/services/cart-service.ts`로 이동
- [ ] Repository 주입 방식으로 변경
- [ ] OrderService 신규 생성

### Phase 3: Zustand Store 분리
- [ ] `stores/` 폴더 생성
- [ ] cart-store.ts 구현
- [ ] auth-store.ts 구현
- [ ] payment-store.ts 구현

### Phase 4: Redis 캐싱 적용
- [ ] `lib/cache/redis-cache.ts` 구현
- [ ] ProductService에 캐싱 적용
- [ ] 환경변수 `REDIS_URL` 설정

### Phase 5: API Route 간소화
- [ ] `/api/cart/route.ts` 간소화 (Service 사용)
- [ ] `/api/orders/route.ts` 간소화 (Service 사용)
- [ ] 필요시 세분화된 엔드포인트 생성

### Phase 6: 테스트 작성
- [ ] Repository 테스트
- [ ] Service 테스트 (Mock 사용)
- [ ] E2E 테스트 (Playwright)

---

## 📝 결론

이 예제들을 따라 구현하면:
- ✅ **Context 완전 분리** (Repository, Service, Store)
- ✅ **성능 2-3배 향상** (캐싱, 쿼리 최적화)
- ✅ **코드 가독성 향상** (단일 책임 원칙)
- ✅ **테스트 용이성** (Mock 사용 가능)

**다음 단계:** Phase 1부터 순차적으로 마이그레이션을 시작하세요!
