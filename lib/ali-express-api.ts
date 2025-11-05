/**
 * 알리익스프레스 API 클라이언트
 * AliExpress Open Platform API 연동
 *
 * 참고: https://developers.aliexpress.com/
 */

interface AliExpressProduct {
  productId: string
  productTitle: string
  productImage: string
  productUrl: string
  originalPrice: number
  salePrice: number
  discount: number
  currency: string
  rating?: number
  totalOrders?: number
  shippingPrice?: number
  categoryId?: string
  sellerId?: string
}

interface SearchParams {
  keyword: string
  page?: number
  pageSize?: number
  minPrice?: number
  maxPrice?: number
  sort?: 'default' | 'priceAsc' | 'priceDesc' | 'orders' | 'rating'
}

interface SearchResponse {
  success: boolean
  products: AliExpressProduct[]
  totalResults: number
  currentPage: number
  error?: string
}

/**
 * 알리익스프레스 API 클라이언트 클래스
 */
export class AliExpressAPI {
  private apiKey: string
  private appSecret: string
  private baseURL: string

  constructor(apiKey?: string, appSecret?: string) {
    this.apiKey = apiKey || process.env.ALIEXPRESS_API_KEY || ''
    this.appSecret = appSecret || process.env.ALIEXPRESS_APP_SECRET || ''
    this.baseURL = 'https://api-sg.aliexpress.com/sync'
  }

  /**
   * 상품 검색
   */
  async searchProducts(params: SearchParams): Promise<SearchResponse> {
    try {
      // API 키가 없으면 모의 데이터 반환
      if (!this.apiKey || !this.appSecret) {
        console.log('⚠️  알리익스프레스 API 키가 없습니다. 모의 데이터를 반환합니다.')
        return this.getMockSearchResults(params)
      }

      // 실제 API 호출 (구현 필요)
      const response = await this.callAPI('aliexpress.affiliate.product.query', {
        keywords: params.keyword,
        page_no: params.page || 1,
        page_size: params.pageSize || 20,
        min_price: params.minPrice,
        max_price: params.maxPrice,
        sort: this.mapSortParam(params.sort),
      })

      return this.parseSearchResponse(response)
    } catch (error) {
      console.error('알리익스프레스 API 오류:', error)
      return {
        success: false,
        products: [],
        totalResults: 0,
        currentPage: 1,
        error: error instanceof Error ? error.message : 'API 호출 실패',
      }
    }
  }

  /**
   * 상품 상세 정보 조회
   */
  async getProductDetail(productId: string): Promise<AliExpressProduct | null> {
    try {
      if (!this.apiKey || !this.appSecret) {
        console.log('⚠️  알리익스프레스 API 키가 없습니다.')
        return null
      }

      const response = await this.callAPI('aliexpress.affiliate.product.detail', {
        product_ids: productId,
      })

      return this.parseProductDetail(response)
    } catch (error) {
      console.error('상품 상세 조회 오류:', error)
      return null
    }
  }

  /**
   * API 호출 (공통)
   */
  private async callAPI(method: string, params: any): Promise<any> {
    const crypto = await import('crypto')

    // 기본 파라미터
    const apiParams: Record<string, any> = {
      app_key: this.apiKey,
      method: method,
      timestamp: Date.now().toString(),
      sign_method: 'md5',
      format: 'json',
      v: '2.0',
      ...params
    }

    // MD5 서명 생성
    const sign = this.generateSign(apiParams, crypto)
    apiParams.sign = sign

    // URL 생성
    const queryString = new URLSearchParams(apiParams).toString()
    const url = `${this.baseURL}?${queryString}`

    // API 호출
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`API 호출 실패: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    // 에러 응답 처리
    if (data.error_response) {
      throw new Error(`AliExpress API 오류: ${data.error_response.msg || 'Unknown error'}`)
    }

    return data
  }

  /**
   * MD5 서명 생성 (AliExpress 요구사항)
   */
  private generateSign(params: Record<string, any>, crypto: typeof import('crypto')): string {
    // 1. app_key, sign 제외한 파라미터 정렬
    const sortedKeys = Object.keys(params)
      .filter(key => key !== 'sign')
      .sort()

    // 2. key+value 형식으로 연결
    const signString = sortedKeys
      .map(key => `${key}${params[key]}`)
      .join('')

    // 3. app_secret으로 감싸기
    const fullSignString = `${this.appSecret}${signString}${this.appSecret}`

    // 4. MD5 해시 생성 (대문자)
    return crypto
      .createHash('md5')
      .update(fullSignString, 'utf8')
      .digest('hex')
      .toUpperCase()
  }

  /**
   * 정렬 파라미터 매핑
   */
  private mapSortParam(sort?: string): string {
    const sortMap: Record<string, string> = {
      default: 'default',
      priceAsc: 'price_asc',
      priceDesc: 'price_desc',
      orders: 'orders_desc',
      rating: 'rating_desc',
    }
    return sortMap[sort || 'default'] || 'default'
  }

  /**
   * API 응답 파싱
   */
  private parseSearchResponse(response: any): SearchResponse {
    try {
      // AliExpress Affiliate API 응답 구조
      const result = response.aliexpress_affiliate_product_query_response?.resp_result

      if (!result) {
        return {
          success: false,
          products: [],
          totalResults: 0,
          currentPage: 1,
          error: '응답 데이터가 없습니다.'
        }
      }

      const resultData = typeof result === 'string' ? JSON.parse(result) : result
      const products = resultData.result?.products || []

      return {
        success: true,
        products: products.map((p: any) => this.parseProduct(p)),
        totalResults: resultData.result?.total_results || products.length,
        currentPage: resultData.result?.current_page_no || 1
      }
    } catch (error) {
      console.error('응답 파싱 오류:', error)
      return {
        success: false,
        products: [],
        totalResults: 0,
        currentPage: 1,
        error: '응답 파싱 실패'
      }
    }
  }

  /**
   * 개별 상품 데이터 파싱
   */
  private parseProduct(raw: any): AliExpressProduct {
    return {
      productId: String(raw.product_id || raw.item_id || ''),
      productTitle: raw.product_title || raw.subject || '',
      productImage: raw.product_main_image_url || raw.product_small_image_urls?.string?.[0] || '',
      productUrl: raw.promotion_link || raw.product_detail_url || '',
      originalPrice: parseFloat(raw.original_price || raw.target_original_price || 0),
      salePrice: parseFloat(raw.target_sale_price || raw.sale_price || 0),
      discount: parseInt(raw.discount || 0),
      currency: raw.target_sale_price_currency || raw.original_price_currency || 'USD',
      rating: raw.evaluate_rate ? parseFloat(raw.evaluate_rate) : undefined,
      totalOrders: raw.volume ? parseInt(raw.volume) : undefined,
      shippingPrice: raw.estimated_price_ship ? parseFloat(raw.estimated_price_ship) : undefined,
      categoryId: raw.first_level_category_id ? String(raw.first_level_category_id) : undefined,
      sellerId: raw.shop_id ? String(raw.shop_id) : undefined
    }
  }

  /**
   * 상품 상세 파싱
   */
  private parseProductDetail(response: any): AliExpressProduct | null {
    try {
      const result = response.aliexpress_affiliate_product_detail_response?.resp_result

      if (!result) {
        return null
      }

      const resultData = typeof result === 'string' ? JSON.parse(result) : result
      const product = resultData.result?.products?.[0]

      if (!product) {
        return null
      }

      return this.parseProduct(product)
    } catch (error) {
      console.error('상품 상세 파싱 오류:', error)
      return null
    }
  }

  /**
   * 모의 검색 결과 생성 (테스트용)
   */
  private getMockSearchResults(params: SearchParams): SearchResponse {
    const mockProducts: AliExpressProduct[] = []
    const count = params.pageSize || 20

    for (let i = 1; i <= count; i++) {
      const basePrice = Math.random() * 100 + 10
      const discount = Math.floor(Math.random() * 50)
      const salePrice = basePrice * (1 - discount / 100)

      mockProducts.push({
        productId: `mock-${Date.now()}-${i}`,
        productTitle: `${params.keyword} - 샘플 상품 #${i}`,
        productImage: `https://picsum.photos/400/400?random=${i}`,
        productUrl: `https://www.aliexpress.com/item/${i}.html`,
        originalPrice: parseFloat(basePrice.toFixed(2)),
        salePrice: parseFloat(salePrice.toFixed(2)),
        discount: discount,
        currency: 'USD',
        rating: parseFloat((3.5 + Math.random() * 1.5).toFixed(1)),
        totalOrders: Math.floor(Math.random() * 10000),
        shippingPrice: Math.random() > 0.5 ? 0 : parseFloat((Math.random() * 10).toFixed(2)),
        categoryId: 'mock-category',
        sellerId: `seller-${i}`,
      })
    }

    return {
      success: true,
      products: mockProducts,
      totalResults: count * 10,
      currentPage: params.page || 1,
    }
  }
}

/**
 * 싱글톤 인스턴스
 */
let apiInstance: AliExpressAPI | null = null

export function getAliExpressAPI(): AliExpressAPI {
  if (!apiInstance) {
    apiInstance = new AliExpressAPI()
  }
  return apiInstance
}

/**
 * 환율 변환 헬퍼
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rate: number = 1300 // USD to KRW 기본 환율
): number {
  if (fromCurrency === 'USD' && toCurrency === 'KRW') {
    return amount * rate
  }
  return amount
}

/**
 * 마진 계산 헬퍼
 */
export function calculateMargin(
  cost: number,
  marginPercent: number
): number {
  return cost * (1 + marginPercent / 100)
}

/**
 * 판매가 계산 (배송비 + 마진 포함)
 */
export function calculateSellingPrice(
  productPrice: number,
  shippingPrice: number,
  marginPercent: number,
  exchangeRate: number = 1300
): number {
  const totalCostUSD = productPrice + shippingPrice
  const totalCostKRW = convertCurrency(totalCostUSD, 'USD', 'KRW', exchangeRate)
  const sellingPrice = calculateMargin(totalCostKRW, marginPercent)

  // 100원 단위로 반올림
  return Math.round(sellingPrice / 100) * 100
}
