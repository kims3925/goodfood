/**
 * Wholesale Service
 * 도매 소싱 비즈니스 로직 레이어
 */

import prisma from '@bandauto/db'
import { pricingService, PricingService } from '@/domain/pricing/services/pricing.service'
import { productRepository, ProductRepository } from '@/domain/products/repository/product.repository'
import {
  collectedPostRepository,
  CollectedPostRepository
} from '@/domain/wholesale/repository/collected-post.repository'
import {
  ConfirmSourcingDTO,
  ConfirmSourcingResult,
  ConvertPostToProductDTO,
  CollectedPostFilter,
  CollectedPostStats,
  PriceOption,
  ProcessedPriceInfo
} from '@/types/services/wholesale'
import {
  ValidationError,
  NotFoundError,
  BusinessLogicError
} from '@/lib/errors/handlers'

export class WholesaleService {
  constructor(
    private pricingSvc: PricingService = pricingService,
    private productRepo: ProductRepository = productRepository,
    private collectedPostRepo: CollectedPostRepository = collectedPostRepository
  ) {}

  /**
   * 소싱 확정 (여러 게시물을 상품으로 변환)
   */
  async confirmSourcing(data: ConfirmSourcingDTO): Promise<ConfirmSourcingResult> {
    // 입력값 검증
    if (!data.postIds || data.postIds.length === 0) {
      throw new ValidationError('선택된 게시물이 없습니다')
    }

    if (!data.userId) {
      throw new ValidationError('사용자 ID는 필수입니다')
    }

    // 선택된 게시물들 조회
    const selectedPosts = await this.collectedPostRepo.findManyByIds(
      data.postIds,
      data.userId
    )

    if (selectedPosts.length === 0) {
      throw new NotFoundError('처리 가능한 게시물')
    }

    // 최종 게시 내용 매핑 생성
    const finalContentMap = new Map<string, string>()
    if (data.finalContents && Array.isArray(data.finalContents)) {
      data.finalContents.forEach(item => {
        finalContentMap.set(item.id, item.finalContent)
      })
    }

    const createdProducts: ConfirmSourcingResult['createdProducts'] = []
    const failedPosts: ConfirmSourcingResult['failedPosts'] = []

    // 각 게시물을 상품으로 변환
    for (const post of selectedPosts) {
      try {
        const product = await this.convertPostToProduct({
          postId: post.id,
          userId: data.userId,
          finalContent: finalContentMap.get(post.id)
        })

        createdProducts.push({
          id: product.id,
          title: product.title,
          salePrice: product.salePrice,
          originalPrice: product.originalPrice,
          sourceId: post.id
        })

        console.log(`상품 생성 완료: ${product.title} (${product.id})`)
      } catch (error: any) {
        console.error(`게시물 ${post.id} 변환 실패:`, error)
        failedPosts.push({
          id: post.id,
          reason: error.message || '알 수 없는 오류'
        })
      }
    }

    return {
      createdProducts,
      failedPosts,
      totalCount: selectedPosts.length,
      successCount: createdProducts.length,
      failedCount: failedPosts.length
    }
  }

  /**
   * 단일 게시물을 상품으로 변환
   */
  async convertPostToProduct(data: ConvertPostToProductDTO) {
    // 게시물 조회
    const post = await this.collectedPostRepo.findById(data.postId)

    if (!post) {
      throw new NotFoundError('게시물', data.postId)
    }

    if (post.userId !== parseInt(data.userId)) {
      throw new ValidationError('권한이 없습니다')
    }

    // 가격 옵션 파싱
    let priceOptions: PriceOption[] = []
    try {
      priceOptions = JSON.parse(post.priceOptions || '[]')
    } catch {
      priceOptions = []
    }

    // 밴드 가격정책 가져오기
    const policyText = post.wholesaleBand.pricingPolicy || ''

    // 가격 옵션들에 정책 적용
    const processedPriceOptions: PriceOption[] = []
    if (priceOptions.length > 0) {
      for (const option of priceOptions) {
        const parsedPrice = this.pricingSvc.parsePrice(option.price)
        if (!parsedPrice.isValid) {
          console.warn(`가격 파싱 실패: ${option.price}`)
          continue
        }

        const pricingResult = await this.pricingSvc.applyPricingPolicy({
          originalPrice: parsedPrice.value,
          pricingPolicyText: policyText,
          shippingFee: post.shippingFee || 0,
          userId: data.userId
        })

        processedPriceOptions.push({
          ...option,
          salePrice: pricingResult.appliedPrice,
          originalPrice: parsedPrice.value
        })
      }
    }

    // 기본 가격 설정
    let basePrice = 10000
    let salePrice = 10000

    if (processedPriceOptions.length > 0) {
      basePrice = processedPriceOptions[0].originalPrice || 10000
      salePrice = processedPriceOptions[0].salePrice || basePrice
    } else if (priceOptions.length > 0) {
      // 옵션은 있지만 파싱이 실패한 경우
      const parsedPrice = this.pricingSvc.parsePrice(priceOptions[0].price)
      if (parsedPrice.isValid) {
        basePrice = parsedPrice.value

        const pricingResult = await this.pricingSvc.applyPricingPolicy({
          originalPrice: basePrice,
          pricingPolicyText: policyText,
          shippingFee: post.shippingFee || 0,
          userId: data.userId
        })

        salePrice = pricingResult.appliedPrice
      }
    }

    // 특이사항 조합
    const specialNotes: string[] = []

    if (post.hasDeadline && post.deadlineInfo) {
      specialNotes.push(`⏰ ${post.deadlineInfo}`)
    }
    if (!post.isAvailable && post.unavailableReason) {
      specialNotes.push(`❌ ${post.unavailableReason}`)
    }

    // 처리된 가격 정보
    const enhancedPriceInfo: ProcessedPriceInfo = {
      originalPriceOptions: priceOptions,
      processedPriceOptions: processedPriceOptions,
      appliedPolicy: policyText,
      shippingFee: post.shippingFee || 0,
      baseInfo: post.priceInfo || ''
    }

    // 상품 생성
    const product = await this.productRepo.create({
      user: {
        connect: { id: parseInt(data.userId) }
      },
      title: post.hookingTitle || post.title || '제목 없음',
      originalPrice: basePrice,
      salePrice: salePrice,
      description:
        data.finalContent ||
        post.hookingContent ||
        post.detailedContent ||
        post.content ||
        '',
      sourceType: 'COLLECTED_POST',
      sourceId: String(post.id),

      // AI 분석 결과 및 추가 정보
      hookingTitle: post.hookingTitle,
      hookingContent: post.hookingContent,
      detailedContent: post.detailedContent,

      // 가격 관련 정보
      shippingFee: post.shippingFee,
      priceInfo: JSON.stringify(enhancedPriceInfo),

      // 특이사항 및 메타데이터
      specialNotes: specialNotes.length > 0 ? specialNotes.join('\n') : null,
      hasDeadline: post.hasDeadline,
      deadlineInfo: post.deadlineInfo,
      isAvailable: post.isAvailable,
      unavailableReason: post.unavailableReason,

      // 소싱 정보
      wholesaleBandName: post.wholesaleBand.name,
      author: post.author,
      originalCreatedAt: post.bandCreatedAt,

      // 이미지 복사
      images: {
        create: (post.images || []).map((img: any, index: number) => ({
          url: img.url,
          sortOrder: img.sortOrder || index
        }))
      }
    })

    // 게시물 상태 업데이트
    await this.collectedPostRepo.updateStatus(post.id, 'PROCESSED')

    return product
  }

  /**
   * 수집된 게시물 조회
   */
  async findCollectedPosts(filter: CollectedPostFilter) {
    if (!filter.userId) {
      throw new ValidationError('사용자 ID는 필수입니다')
    }

    return this.collectedPostRepo.findByFilter(filter)
  }

  /**
   * 수집된 게시물 ID로 조회
   */
  async findCollectedPostById(id: string, userId: string) {
    if (!id) {
      throw new ValidationError('게시물 ID는 필수입니다')
    }

    if (!userId) {
      throw new ValidationError('사용자 ID는 필수입니다')
    }

    const post = await this.collectedPostRepo.findById(id)

    if (!post) {
      throw new NotFoundError('게시물', id)
    }

    if (post.userId !== parseInt(userId)) {
      throw new ValidationError('권한이 없습니다')
    }

    return post
  }

  /**
   * 수집된 게시물 통계
   */
  async getCollectedPostStats(userId: string): Promise<CollectedPostStats> {
    if (!userId) {
      throw new ValidationError('사용자 ID는 필수입니다')
    }

    const [
      totalPosts,
      pendingPosts,
      processedPosts,
      failedPosts,
      selectedPosts,
      categoryBreakdown
    ] = await Promise.all([
      this.collectedPostRepo.count({ userId }),
      this.collectedPostRepo.count({ userId, status: 'PENDING' }),
      this.collectedPostRepo.count({ userId, status: 'PROCESSED' }),
      this.collectedPostRepo.count({ userId, status: 'FAILED' }),
      this.collectedPostRepo.count({ userId, isSelected: true }),
      this.collectedPostRepo.getStatsByCategory(userId)
    ])

    return {
      totalPosts,
      pendingPosts,
      processedPosts,
      failedPosts,
      selectedPosts,
      categoryBreakdown
    }
  }

  /**
   * 수집된 게시물 삭제
   */
  async deleteCollectedPost(id: string, userId: string): Promise<void> {
    if (!id) {
      throw new ValidationError('게시물 ID는 필수입니다')
    }

    const post = await this.collectedPostRepo.findById(id)

    if (!post) {
      throw new NotFoundError('게시물', id)
    }

    if (post.userId !== parseInt(userId)) {
      throw new ValidationError('권한이 없습니다')
    }

    await this.collectedPostRepo.delete(id)
  }

  /**
   * 여러 수집된 게시물 삭제
   */
  async deleteCollectedPosts(ids: string[], userId: string): Promise<number> {
    if (!ids || ids.length === 0) {
      throw new ValidationError('삭제할 게시물이 없습니다')
    }

    // 권한 확인을 위해 게시물들 조회
    const posts = await this.collectedPostRepo.findManyByIds(ids, userId)

    if (posts.length === 0) {
      throw new NotFoundError('삭제 가능한 게시물')
    }

    // 권한 검증
    const userIdInt = parseInt(userId)
    const unauthorizedPost = posts.find(p => p.userId !== userIdInt)
    if (unauthorizedPost) {
      throw new ValidationError('권한이 없는 게시물이 포함되어 있습니다')
    }

    return this.collectedPostRepo.deleteMany(ids)
  }
}

// Singleton 인스턴스
export const wholesaleService = new WholesaleService()
