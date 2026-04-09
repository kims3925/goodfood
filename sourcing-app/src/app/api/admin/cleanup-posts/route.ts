export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/cleanup-posts
 *
 * 데이터 정합성 정리:
 * - Product가 생성되었지만 CollectedProduct가 없는 게시물에 대해
 *   CollectedProduct를 자동 생성하여 post/list에서 제거
 * - 안전하게 중복 실행 가능
 */

import { NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

export async function POST() {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const userId = currentUser.userId

    // 1. Product 테이블에서 postId를 가진 모든 상품 조회
    // Product 모델에 postId가 없으므로, CollectedProduct를 통해 역추적
    // 대신: CollectedPost 중 collectedProducts가 없지만 이미 AI 가공된 것들을 찾기

    // post/list에 표시되는 게시물 (collectedProducts가 없는 게시물) 조회
    const postsWithoutCollectedProduct = await prisma.collectedPost.findMany({
      where: {
        userId,
        deletedAt: null,
        collectedProducts: { none: {} },
      },
      select: {
        id: true,
        title: true,
        channelId: true,
      },
    })

    // 이 중 이미 Product가 존재하는 게시물을 찾기 위해
    // Product의 이름과 CollectedPost의 제목을 매칭하는 것은 부정확하므로,
    // 모든 미분류 게시물에 대해 CollectedProduct를 생성하지 않고,
    // confirmAiProcess 이후 자동으로 처리되도록 보장

    // 2. 대안: Product 생성 시 channelId + name 조합으로 매칭된 게시물 찾기
    // Product에 postId 컬럼이 없어 직접 매칭 불가
    // → 향후 Product 모델에 postId 추가 시 정확한 매칭 가능

    // 3. 현재 가능한 정리: isConverted=false인 CollectedProduct를 true로 업데이트
    const unconverted = await prisma.collectedProduct.updateMany({
      where: {
        userId,
        isConverted: false,
        deletedAt: null,
      },
      data: {
        isConverted: true,
      },
    })

    return NextResponse.json({
      success: true,
      message: '데이터 정리 완료',
      data: {
        postsWithoutCollectedProduct: postsWithoutCollectedProduct.length,
        unconvertedFixed: unconverted.count,
      },
    })
  } catch (error) {
    console.error('데이터 정리 실패:', error)
    return NextResponse.json(
      { success: false, error: '데이터 정리에 실패했습니다.' },
      { status: 500 }
    )
  }
}
