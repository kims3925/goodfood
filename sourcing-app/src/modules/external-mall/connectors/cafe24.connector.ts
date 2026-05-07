/**
 * 카페24 Open API v2 커넥터 (작업지시서 §5-1).
 *
 * 인증: OAuth 2.0
 * 문서: https://developers.cafe24.com/docs/api/admin
 *
 * 필요 스코프:
 * - mall.read_product / mall.read_category / mall.read_order
 * - mall.write_product (자사몰 결제 — 시나리오 B)
 */

import type {
  ExternalMallConnector,
  MallPlatform,
  FetchProductsParams,
  ExternalProduct,
  ExternalProductDetail,
  CheckoutOptions,
  ProductRegistration,
  RegisteredProduct,
  StockInfo,
  ExternalCategory,
} from '../types'

export class Cafe24Connector implements ExternalMallConnector {
  platform: MallPlatform = 'CAFE24'

  private baseUrl: string
  private accessToken: string
  private mallId: string

  constructor(config: { mallId: string; accessToken: string; apiVersion?: string }) {
    this.mallId = config.mallId
    this.accessToken = config.accessToken
    this.baseUrl = `https://${config.mallId}.cafe24api.com/api/v2`
  }

  async fetchProducts(params: FetchProductsParams): Promise<ExternalProduct[]> {
    const limit = params.limit || 50
    const offset = ((params.page || 1) - 1) * limit
    const query = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      display: 'T',
    })
    if (params.categoryId) query.set('category', params.categoryId)
    if (params.keyword) query.set('product_name', params.keyword)
    if (params.updatedAfter) {
      query.set('updated_start_date', params.updatedAfter.toISOString().split('T')[0])
    }

    const res = await this.request(`/admin/products?${query.toString()}`)
    if (!res.ok) {
      throw new Error(`카페24 상품 목록 조회 실패: HTTP ${res.status}`)
    }
    const json = (await res.json()) as { products?: any[] }
    return (json.products || []).map((p) => this.mapProduct(p))
  }

  async fetchProductDetail(productId: string): Promise<ExternalProductDetail> {
    const res = await this.request(
      `/admin/products/${productId}?embed=options,variants,images`
    )
    if (!res.ok) {
      throw new Error(`카페24 상품 상세 조회 실패: HTTP ${res.status}`)
    }
    const json = (await res.json()) as { product?: any }
    const p = json.product
    if (!p) throw new Error(`상품 ${productId} 응답 없음`)

    return {
      externalId: String(p.product_no),
      name: p.product_name,
      price: Number(p.price) || 0,
      originalPrice: p.retail_price ? Number(p.retail_price) : undefined,
      thumbnailUrl: p.list_image || p.detail_image || '',
      productUrl: this.buildProductUrl(String(p.product_no)),
      description: p.description || '',
      images: (p.images || []).map((img: any) => img.big || img.medium).filter(Boolean),
      options: (p.options || []).map((opt: any) => ({
        name: opt.option_name,
        values: (opt.option_value || []).map((v: any) => ({
          label: v.option_text,
          price: v.additional_amount ? Number(v.additional_amount) : 0,
          stock: v.stock_quantity ? Number(v.stock_quantity) : undefined,
        })),
      })),
      shippingInfo: p.shipping_info || undefined,
      category: p.category ? String(p.category) : undefined,
    }
  }

  async fetchCategories(): Promise<ExternalCategory[]> {
    const res = await this.request('/admin/categories?depth=2')
    if (!res.ok) return []
    const json = (await res.json()) as { categories?: any[] }
    return (json.categories || []).map((c) => ({
      id: String(c.category_no),
      name: c.category_name,
      parentId: c.parent_category_no ? String(c.parent_category_no) : undefined,
    }))
  }

  async checkStock(productId: string): Promise<StockInfo> {
    const res = await this.request(`/admin/products/${productId}/variants`)
    if (!res.ok) {
      return { totalStock: 0, status: 'out_of_stock' }
    }
    const json = (await res.json()) as { variants?: any[] }
    const variants = json.variants || []
    const totalStock = variants.reduce(
      (sum, v) => sum + (Number(v.quantity) || 0),
      0
    )
    return {
      totalStock,
      status: totalStock > 10 ? 'in_stock' : totalStock > 0 ? 'low' : 'out_of_stock',
      variants: variants.map((v) => ({
        id: v.variant_code,
        name: (v.options || []).map((o: any) => o.value).join('/'),
        stock: Number(v.quantity) || 0,
      })),
    }
  }

  getCheckoutUrl(productId: string, options?: CheckoutOptions): string {
    let url = this.buildProductUrl(productId)
    const params = new URLSearchParams()
    if (options?.affiliateCode) params.set('ref', options.affiliateCode)
    if (options?.variantId) params.set('variant', options.variantId)
    const qs = params.toString()
    return qs ? `${url}&${qs}` : url
  }

  async registerProduct(product: ProductRegistration): Promise<RegisteredProduct> {
    const body = {
      shop_no: 1,
      request: {
        product_name: product.name,
        price: product.price,
        description: product.description,
        detail_image: product.images[0],
        list_image: product.images[0],
        ...(product.options?.length
          ? {
              has_option: 'T',
              options: product.options.map((opt) => ({
                option_name: opt.name,
                option_value: opt.values.map((v) => ({
                  option_text: v.label,
                  additional_amount: v.price || 0,
                })),
              })),
            }
          : {}),
      },
    }

    const res = await this.request('/admin/products', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      throw new Error(`카페24 상품 등록 실패: HTTP ${res.status}`)
    }
    const json = (await res.json()) as { product?: any }
    const created = json.product
    return {
      externalId: String(created.product_no),
      productUrl: this.buildProductUrl(String(created.product_no)),
      status: 'active',
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const res = await this.request('/admin/store')
      if (!res.ok) {
        return { success: false, message: `HTTP ${res.status}` }
      }
      const json = (await res.json()) as { store?: any }
      const name = json.store?.shop_name || this.mallId
      return { success: true, message: `연결 성공: ${name}` }
    } catch (err: any) {
      return { success: false, message: err?.message || 'unknown' }
    }
  }

  // ─── private ───

  private buildProductUrl(productId: string): string {
    return `https://${this.mallId}.cafe24.com/product/detail.html?product_no=${productId}`
  }

  private mapProduct(p: any): ExternalProduct {
    return {
      externalId: String(p.product_no),
      name: p.product_name,
      price: Number(p.price) || 0,
      originalPrice: p.retail_price ? Number(p.retail_price) : undefined,
      thumbnailUrl: p.list_image || p.small_image || '',
      productUrl: this.buildProductUrl(String(p.product_no)),
      category: p.category ? String(p.category) : undefined,
      stock: p.stock_quantity ? Number(p.stock_quantity) : undefined,
    }
  }

  private async request(path: string, init?: RequestInit): Promise<Response> {
    const url = `${this.baseUrl}${path}`
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'X-Cafe24-Api-Version': '2024-03-01',
        ...((init?.headers as Record<string, string>) || {}),
      },
    })
    if (res.status === 401) {
      throw new Error('카페24 인증 만료 — 토큰 갱신 필요')
    }
    return res
  }
}
