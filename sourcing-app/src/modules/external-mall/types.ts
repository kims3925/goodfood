/**
 * 외부 쇼핑몰 커넥터 인터페이스 (작업지시서 §3)
 *
 * 모든 외부몰 커넥터(Cafe24/OwnerClan/Shopify/CustomApi)가 구현.
 * 소싱(읽기)과 결제연동(쓰기)을 분리하여 시나리오 A/B 모두 지원.
 */

export type MallPlatform =
  | 'CAFE24'
  | 'OWNERCLAN'
  | 'SHOPIFY'
  | 'NAVER_STORE'
  | 'COUPANG'
  | 'CUSTOM_API'

export interface FetchProductsParams {
  page?: number
  limit?: number
  categoryId?: string
  keyword?: string
  minPrice?: number
  maxPrice?: number
  updatedAfter?: Date
}

export interface ExternalProduct {
  externalId: string
  name: string
  price: number
  originalPrice?: number
  thumbnailUrl: string
  productUrl: string
  category?: string
  stock?: number
  options?: ExternalOption[]
}

export interface ExternalProductDetail extends ExternalProduct {
  description: string
  images: string[]
  options: ExternalOption[]
  shippingInfo?: string
  sellerInfo?: string
}

export interface ExternalOption {
  name: string
  values: Array<{
    label: string
    price?: number
    stock?: number
  }>
}

export interface CheckoutOptions {
  variantId?: string
  quantity?: number
  affiliateCode?: string
  returnUrl?: string
}

export interface ProductRegistration {
  name: string
  price: number
  description: string
  images: string[]
  options?: ExternalOption[]
  categoryId?: string
}

export interface RegisteredProduct {
  externalId: string
  productUrl: string
  status: 'active' | 'pending' | 'failed'
}

export interface StockInfo {
  totalStock: number
  status: 'in_stock' | 'low' | 'out_of_stock'
  variants?: Array<{ id: string; name: string; stock: number }>
}

export interface ExternalCategory {
  id: string
  name: string
  parentId?: string
}

export interface ExternalOrderStatus {
  externalOrderId: string
  status: string
  totalAmount: number
}

export interface ExternalMallConnector {
  platform: MallPlatform

  // ━━━ 소싱 (읽기) ━━━
  fetchProducts(params: FetchProductsParams): Promise<ExternalProduct[]>
  fetchProductDetail(productId: string): Promise<ExternalProductDetail>
  fetchCategories?(): Promise<ExternalCategory[]>
  checkStock?(productId: string): Promise<StockInfo>

  // ━━━ 결제연동 (쓰기) ━━━
  registerProduct?(product: ProductRegistration): Promise<RegisteredProduct>
  getCheckoutUrl(productId: string, options?: CheckoutOptions): string
  getOrderStatus?(orderId: string): Promise<ExternalOrderStatus>

  testConnection(): Promise<{ success: boolean; message: string }>
}
