/**
 * Band Collection Service
 * 밴드 게시물 수집 비즈니스 로직 레이어
 */

import { NaverBandClient, BandPost } from '@/domain/band'
import { parallelBatchAnalyzeProducts } from '@/domain/wholesale/services/ai-analysis.service'
import prisma from '@/lib/database/client'
import {
  CollectPostsDTO,
  CollectPostsResult,
  AIAnalysisResult,
  CollectionProgress,
  DuplicateCheckResult
} from '@/types/services/band-collection'
import {
  ValidationError,
  NotFoundError,
  ExternalApiError
} from '@/lib/errors/handlers'
import { getBandAccessToken } from '@/domain/band'

export class BandCollectionService {
  /**
   * 밴드 게시물 수집
   */
  async collectPosts(data: CollectPostsDTO): Promise<CollectPostsResult> {
    // 입력값 검증
    if (!data.bandId) {
      throw new ValidationError('밴드 ID는 필수입니다')
    }

    if (!data.userId) {
      throw new ValidationError('사용자 ID는 필수입니다')
    }

    // 사용자 확인
    const user = await prisma.user.findUnique({
      where: { id: data.userId }
    })

    if (!user) {
      throw new NotFoundError('사용자', data.userId)
    }

    // 도매 밴드 조회
    const wholesaleBand = await prisma.wholesaleBand.findFirst({
      where: {
        id: data.bandId,
        userId: data.userId
      }
    })

    if (!wholesaleBand) {
      throw new NotFoundError('도매 밴드', data.bandId)
    }

    // Band API 클라이언트 생성
    let accessToken: string
    try {
      accessToken = await getBandAccessToken(data.userId)
    } catch (error: any) {
      throw new ExternalApiError('Band', error.message)
    }

    const bandClient = new NaverBandClient(accessToken)

    // 밴드 게시물 가져오기
    console.log(`📥 밴드 게시물 수집 시작: ${wholesaleBand.name}`)

    let bandPosts: BandPost[]
    try {
      bandPosts = await bandClient.getBandPosts(wholesaleBand.bandKey, {
        since: data.dateRange?.since,
        until: data.dateRange?.until,
        limit: data.limit || 20
      })
    } catch (error: any) {
      throw new ExternalApiError('Band', error.message)
    }

    console.log(`✅ ${bandPosts.length}개 게시물 가져옴`)

    if (bandPosts.length === 0) {
      return {
        totalFetched: 0,
        newPosts: 0,
        duplicates: 0,
        failed: 0,
        collectedPosts: [],
        errors: []
      }
    }

    // 중복 체크 및 필터링
    const newPosts: BandPost[] = []
    let duplicateCount = 0

    for (const post of bandPosts) {
      const duplicateCheck = await this.checkDuplicate(
        post,
        wholesaleBand.id,
        data.userId
      )

      if (duplicateCheck.isDuplicate) {
        console.log(`⏭️  중복 게시물 스킵: ${post.post_key}`)
        duplicateCount++
      } else {
        newPosts.push(post)
      }
    }

    console.log(`🆕 새 게시물: ${newPosts.length}개, 중복: ${duplicateCount}개`)

    if (newPosts.length === 0) {
      return {
        totalFetched: bandPosts.length,
        newPosts: 0,
        duplicates: duplicateCount,
        failed: 0,
        collectedPosts: [],
        errors: []
      }
    }

    // AI 분석 (병렬 배치 처리)
    console.log(`🤖 AI 분석 시작: ${newPosts.length}개 게시물`)

    const analysisInputs = newPosts.map(post => ({
      title: post.content.substring(0, 100), // 첫 100자를 제목으로
      content: post.content,
      comments: [],  // BandPost에는 comment_count만 있고 실제 댓글 배열은 없음
      pricingPolicy: wholesaleBand.pricingPolicy || ''
    }))

    let analysisResults: AIAnalysisResult[]
    try {
      // userId를 두 번째 파라미터로 전달
      analysisResults = await parallelBatchAnalyzeProducts(
        analysisInputs,
        data.userId  // userId를 별도 파라미터로 전달
      )
    } catch (error: any) {
      console.error('❌ AI 분석 실패:', error)
      // AI 분석 실패 시 빈 결과 배열 사용
      analysisResults = newPosts.map(() => ({}))
    }

    console.log(`✅ AI 분석 완료: ${analysisResults.length}개`)

    // DB 저장
    const collectedPosts: CollectPostsResult['collectedPosts'] = []
    const errors: CollectPostsResult['errors'] = []

    for (let i = 0; i < newPosts.length; i++) {
      const post = newPosts[i]
      const analysis = analysisResults[i] || {}

      try {
        const savedPost = await this.saveCollectedPost(
          post,
          wholesaleBand,
          data.userId,
          analysis
        )

        collectedPosts.push({
          id: savedPost.id,
          title: savedPost.title,
          bandKey: wholesaleBand.bandKey,
          postKey: post.post_key,
          productCategory: savedPost.productCategory
        })

        console.log(`💾 저장 완료: ${savedPost.title}`)
      } catch (error: any) {
        console.error(`❌ 저장 실패 (${post.post_key}):`, error)
        errors.push({
          postKey: post.post_key,
          reason: error.message || '알 수 없는 오류'
        })
      }
    }

    return {
      totalFetched: bandPosts.length,
      newPosts: collectedPosts.length,
      duplicates: duplicateCount,
      failed: errors.length,
      collectedPosts,
      errors
    }
  }

  /**
   * 중복 게시물 체크
   */
  private async checkDuplicate(
    post: BandPost,
    wholesaleBandId: string,
    userId: string
  ): Promise<DuplicateCheckResult> {
    // 1. postKey로 중복 체크
    const existingByPostKey = await prisma.collectedPost.findFirst({
      where: {
        postKey: post.post_key,
        wholesaleBandId,
        userId
      }
    })

    if (existingByPostKey) {
      return {
        isDuplicate: true,
        existingPostId: existingByPostKey.id,
        similarity: 1.0
      }
    }

    // 2. 제목/내용 유사도로 중복 체크 (선택적)
    const recentPosts = await prisma.collectedPost.findMany({
      where: {
        wholesaleBandId,
        userId,
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 최근 7일
        }
      },
      take: 50
    })

    for (const existingPost of recentPosts) {
      const similarity = this.calculateSimilarity(
        post.content,
        existingPost.content
      )

      if (similarity > 0.9) {
        // 90% 이상 유사하면 중복으로 간주
        console.log(
          `⚠️  유사 게시물 발견: ${post.post_key} vs ${existingPost.postKey} (${(similarity * 100).toFixed(1)}%)`
        )
        return {
          isDuplicate: true,
          existingPostId: existingPost.id,
          similarity
        }
      }
    }

    return { isDuplicate: false }
  }

  /**
   * 수집된 게시물 저장
   */
  private async saveCollectedPost(
    post: BandPost,
    wholesaleBand: any,
    userId: number,
    analysis: AIAnalysisResult
  ) {
    // 이미지 URL 추출
    const images = post.photo?.map(p => p.url) || []

    // 콘텐츠 정화
    const sanitizedContent = this.sanitizeContent(post.content)
    const sanitizedHookingContent = this.sanitizeContent(
      analysis.hookingContent
    )
    const sanitizedDetailedContent = this.sanitizeContent(
      analysis.detailedContent
    )

    // 가격 정보 정수 변환 (원 단위)
    const extractedPrice = analysis.extractedPrice ? Math.floor(analysis.extractedPrice) : null
    const adjustedPrice = analysis.adjustedPrice ? Math.floor(analysis.adjustedPrice) : null
    const shippingFee = analysis.shippingFee ? Math.floor(analysis.shippingFee) : null

    return prisma.collectedPost.create({
      data: {
        userId,
        wholesaleBandId: wholesaleBand.id,
        postKey: post.post_key,
        title: analysis.hookingTitle || post.content.substring(0, 100),
        content: sanitizedContent,
        author: post.author.name,
        bandCreatedAt: new Date(post.created_at),
        status: 'PENDING',
        isSelected: false,

        // AI 분석 결과
        hookingTitle: analysis.hookingTitle,
        hookingContent: sanitizedHookingContent,
        detailedContent: sanitizedDetailedContent,
        productCategory: analysis.productCategory,
        priceOptions: analysis.priceOptions
          ? JSON.stringify(analysis.priceOptions)
          : '[]',

        // 가격 정보 (Integer 원 단위)
        extractedPrice,
        adjustedPrice,
        shippingFee,
        priceInfo: analysis.priceInfo,

        // 기타 정보
        hasDeadline: analysis.hasDeadline || false,
        deadlineInfo: analysis.deadlineInfo,
        isAvailable: analysis.isAvailable !== false, // 기본값 true
        unavailableReason: analysis.unavailableReason,

        // 이미지 relation으로 생성
        images: {
          create: images.map((url, index) => ({
            url,
            sortOrder: index
          }))
        }
      },
      include: {
        images: true
      }
    })
  }

  /**
   * 콘텐츠 정화
   */
  private sanitizeContent(content: string | null | undefined): string {
    if (!content) return ''

    try {
      let sanitized = content.toString()

      // 백슬래시 제거
      sanitized = sanitized.replace(/\\/g, '')

      // 제어 문자 제거
      sanitized = sanitized.replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
      sanitized = sanitized.replace(/\x00/g, '')

      // 특수 문자 제거
      sanitized = sanitized.replace(/['"`]/g, '')

      // 특수 유니코드 제거
      sanitized = sanitized.replace(/[\uFFF0-\uFFFF]/g, '')

      // 연속 공백 정리
      sanitized = sanitized.replace(/\s+/g, ' ')

      // 길이 제한
      if (sanitized.length > 5000) {
        sanitized = sanitized.substring(0, 5000) + '...'
      }

      return sanitized.trim()
    } catch (error) {
      console.error('콘텐츠 정화 중 오류:', error)
      return (
        content
          ?.toString()
          .replace(/[^\w\s가-힣ㄱ-ㅎㅏ-ㅣ0-9]/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 1000) || ''
      )
    }
  }

  /**
   * 문자열 유사도 계산 (Jaccard 유사도)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0

    const words1 = new Set(
      str1
        .toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 1)
    )
    const words2 = new Set(
      str2
        .toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 1)
    )

    const intersection = new Set([...words1].filter(x => words2.has(x)))
    const union = new Set([...words1, ...words2])

    return intersection.size / union.size
  }

  /**
   * Band API 토큰 유효성 검사
   */
  async validateBandToken(accessToken: string): Promise<boolean> {
    try {
      const bandClient = new NaverBandClient(accessToken)
      return await bandClient.validateToken()
    } catch (error) {
      console.error('❌ Band API 토큰 검증 실패:', error)
      return false
    }
  }

  /**
   * 사용자의 밴드 목록 조회
   */
  async getUserBands(accessToken: string) {
    try {
      const bandClient = new NaverBandClient(accessToken)
      return await bandClient.getBands()
    } catch (error: any) {
      throw new ExternalApiError('Band', error.message)
    }
  }
}

// Singleton 인스턴스
export const bandCollectionService = new BandCollectionService()
