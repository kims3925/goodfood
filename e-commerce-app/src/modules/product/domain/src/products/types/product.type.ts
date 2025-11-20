/**
 * Product Service DTO 타입 정의
 */

import { Product, ProductStatus } from '@prisma/client'
import { BaseFilter } from './common'

/**
 * 상품 생성 DTO
 */
export interface CreateProductDTO {
  userId: number
  title: string
  originalPrice: number
  salePrice: number
  description?: string
  hookingTitle?: string
  hookingContent?: string
  detailedContent?: string
  shippingFee?: number
  priceInfo?: string
  specialNotes?: string
  productCategory?: string
  status?: ProductStatus
  images?: string
  originUrl?: string
  wholesaleBandId?: number
  collectedPostId?: number
}

/**
 * 상품 업데이트 DTO
 */
export interface UpdateProductDTO {
  title?: string
  description?: string
  hookingTitle?: string
  hookingContent?: string
  detailedContent?: string
  originalPrice?: number
  salePrice?: number
  shippingFee?: number
  priceInfo?: string
  specialNotes?: string
  productCategory?: string
  status?: ProductStatus
  images?: string
}

/**
 * 상품 필터 DTO
 */
export interface ProductFilter extends BaseFilter {
  userId: number
  status?: ProductStatus
  category?: string
  minPrice?: number
  maxPrice?: number
  wholesaleBandId?: number
}

/**
 * 상품 목록 응답 (쇼핑몰 상태 포함)
 */
export interface ProductWithShopStatus extends Product {
  isRegisteredToShop: boolean
}

/**
 * 상품 일괄 삭제 결과
 */
export interface DeleteProductsResult {
  success: boolean
  message: string
  deletedCount: number
  deactivatedCount: number
  hasOrderedProducts: boolean
}

/**
 * 상품 상태 업데이트 DTO
 */
export interface UpdateProductStatusDTO {
  id: number
  status: ProductStatus
}
