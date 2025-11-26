/**
 * Product Service
 * 상품 비즈니스 로직 레이어
 */

import { Product, ProductStatus } from '@bandauto/db'
import { productRepository, ProductRepository } from '@/domain/products/repository/product.repository'
import {
  CreateProductDTO,
  UpdateProductDTO,
  ProductFilter,
  ProductWithShopStatus,
  DeleteProductsResult
} from '@/types/services/product'
import {
  ValidationError,
  NotFoundError,
  UnauthorizedError
} from '@/lib/errors/handlers'

export class ProductService {
  constructor(private repository: ProductRepository = productRepository) {}

  /**
   * 사용자별 전체 상품 목록 조회
   * 쇼핑몰 등록 상태 정보 포함
   */
  async findAllByUserId(userId: number): Promise<ProductWithShopStatus[]> {
    if (!userId) {
      throw new ValidationError('사용자 ID는 필수입니다')
    }

    const products = await this.repository.findAllByUserId(userId)

    // 쇼핑몰 등록 상태 정보 추가
    return products.map(product => ({
      ...product,
      isRegisteredToShop: product.status === 'ACTIVE'
    }))
  }

  /**
   * ID로 상품 조회
   */
  async findById(id: number, userId: number): Promise<Product> {
    if (!id) {
      throw new ValidationError('상품 ID는 필수입니다')
    }

    if (!userId) {
      throw new ValidationError('사용자 ID는 필수입니다')
    }

    const product = await this.repository.findByIdAndUserId(id, userId)

    if (!product) {
      throw new NotFoundError('상품', id)
    }

    return product
  }

  /**
   * 필터 조건으로 상품 조회
   */
  async findByFilter(filter: ProductFilter): Promise<ProductWithShopStatus[]> {
    if (!filter.userId) {
      throw new ValidationError('사용자 ID는 필수입니다')
    }

    const products = await this.repository.findByFilter(filter)

    return products.map(product => ({
      ...product,
      isRegisteredToShop: product.status === 'ACTIVE'
    }))
  }

  /**
   * 새 상품 생성
   */
  async createProduct(data: CreateProductDTO): Promise<Product> {
    // 필수 필드 검증
    if (!data.userId) {
      throw new ValidationError('사용자 ID는 필수입니다')
    }

    if (!data.title) {
      throw new ValidationError('상품 제목은 필수입니다')
    }

    if (!data.originalPrice || data.originalPrice <= 0) {
      throw new ValidationError('원가는 필수이며 0보다 커야 합니다')
    }

    if (!data.salePrice || data.salePrice <= 0) {
      throw new ValidationError('판매가는 필수이며 0보다 커야 합니다')
    }

    // 상품 생성
    const product = await this.repository.create({
      user: {
        connect: { id: data.userId }
      },
      title: data.title,
      originalPrice: data.originalPrice,
      salePrice: data.salePrice,
      description: data.description || '',
      hookingTitle: data.hookingTitle,
      hookingContent: data.hookingContent,
      detailedContent: data.detailedContent,
      shippingFee: data.shippingFee,
      priceInfo: data.priceInfo,
      specialNotes: data.specialNotes,
      productCategory: data.productCategory,
      status: data.status || 'DRAFT',
      images: data.images,
      originUrl: data.originUrl,
      wholesaleBand: data.wholesaleBandId
        ? { connect: { id: data.wholesaleBandId } }
        : undefined,
      collectedPost: data.collectedPostId
        ? { connect: { id: data.collectedPostId } }
        : undefined
    })

    return product
  }

  /**
   * 상품 업데이트
   */
  async updateProduct(
    id: number,
    userId: number,
    data: UpdateProductDTO
  ): Promise<Product> {
    if (!id) {
      throw new ValidationError('상품 ID는 필수입니다')
    }

    if (!userId) {
      throw new ValidationError('사용자 ID는 필수입니다')
    }

    // 상품 존재 및 권한 확인
    const existingProduct = await this.repository.findByIdAndUserId(id, userId)
    if (!existingProduct) {
      throw new NotFoundError('상품', id)
    }

    // 업데이트 데이터 필터링 (null/undefined 제거)
    const updateData: any = {}

    if (data.title !== undefined) updateData.title = data.title
    if (data.description !== undefined) updateData.description = data.description
    if (data.hookingTitle !== undefined) updateData.hookingTitle = data.hookingTitle
    if (data.hookingContent !== undefined)
      updateData.hookingContent = data.hookingContent
    if (data.detailedContent !== undefined)
      updateData.detailedContent = data.detailedContent
    if (data.specialNotes !== undefined) updateData.specialNotes = data.specialNotes
    if (data.productCategory !== undefined)
      updateData.productCategory = data.productCategory
    if (data.priceInfo !== undefined) updateData.priceInfo = data.priceInfo
    if (data.status !== undefined) updateData.status = data.status
    if (data.images !== undefined) updateData.images = data.images

    // 숫자 필드 검증 및 추가
    if (data.originalPrice !== undefined) {
      const price = parseFloat(String(data.originalPrice))
      if (!isNaN(price) && price >= 0) {
        updateData.originalPrice = price
      }
    }

    if (data.salePrice !== undefined) {
      const price = parseFloat(String(data.salePrice))
      if (!isNaN(price) && price >= 0) {
        updateData.salePrice = price
      }
    }

    if (data.shippingFee !== undefined) {
      const fee = parseFloat(String(data.shippingFee))
      if (!isNaN(fee) && fee >= 0) {
        updateData.shippingFee = fee
      }
    }

    updateData.updatedAt = new Date()

    // 상품 업데이트
    const updatedProduct = await this.repository.update(id, updateData)

    return updatedProduct
  }

  /**
   * 상품 삭제 (단일)
   */
  async deleteProduct(id: number, userId: number): Promise<void> {
    if (!id) {
      throw new ValidationError('상품 ID는 필수입니다')
    }

    if (!userId) {
      throw new ValidationError('사용자 ID는 필수입니다')
    }

    // 상품 존재 및 권한 확인
    const existingProduct = await this.repository.findByIdAndUserId(id, userId)
    if (!existingProduct) {
      throw new NotFoundError('상품', id)
    }

    await this.repository.delete(id)
  }

  /**
   * 상품 일괄 삭제
   * 주문이 있는 상품은 상태만 DELETED로 변경
   */
  async deleteProducts(
    productIds: number[],
    userId: number
  ): Promise<DeleteProductsResult> {
    if (!productIds || productIds.length === 0) {
      throw new ValidationError('삭제할 상품 ID가 필요합니다')
    }

    if (!userId) {
      throw new ValidationError('사용자 ID는 필수입니다')
    }

    // 상품 존재 확인
    const existingProducts = await this.repository.findManyByIds(productIds)
    if (existingProducts.length === 0) {
      throw new NotFoundError('상품', productIds.join(', '))
    }

    // 권한 확인 (모든 상품이 해당 사용자 소유인지)
    const unauthorizedProducts = existingProducts.filter(
      (p: any) => p.userId !== userId
    )
    if (unauthorizedProducts.length > 0) {
      throw new UnauthorizedError('일부 상품에 대한 삭제 권한이 없습니다')
    }

    // 일괄 삭제 실행
    const result = await this.repository.deleteMany(productIds)

    const totalProcessed = result.deletedCount + result.deactivatedCount
    const hasOrderedProducts = result.deactivatedCount > 0

    const message = hasOrderedProducts
      ? `총 ${totalProcessed}개 상품 처리 완료 (삭제: ${result.deletedCount}개, 비활성화: ${result.deactivatedCount}개)`
      : `${result.deletedCount}개 상품이 완전히 삭제되었습니다.`

    return {
      success: true,
      message,
      deletedCount: result.deletedCount,
      deactivatedCount: result.deactivatedCount,
      hasOrderedProducts
    }
  }

  /**
   * 상품 상태 업데이트
   */
  async updateProductStatus(
    id: number,
    userId: number,
    status: ProductStatus
  ): Promise<Product> {
    if (!id) {
      throw new ValidationError('상품 ID는 필수입니다')
    }

    if (!userId) {
      throw new ValidationError('사용자 ID는 필수입니다')
    }

    if (!status) {
      throw new ValidationError('상태 값은 필수입니다')
    }

    // 상품 존재 및 권한 확인
    const existingProduct = await this.repository.findByIdAndUserId(id, userId)
    if (!existingProduct) {
      throw new NotFoundError('상품', id)
    }

    return this.repository.updateStatus(id, status)
  }

  /**
   * 상품 개수 조회
   */
  async countProducts(filter?: Partial<ProductFilter>): Promise<number> {
    return this.repository.count(filter)
  }
}

// Singleton 인스턴스
export const productService = new ProductService()
