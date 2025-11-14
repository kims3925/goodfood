import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/database/client'
// import { analyzePostsWithAI } from '@/domain/wholesale/services/ai-analysis.service' // TODO: 구현 필요

/**
 * AI 분석 독립 실행 API
 * 수집된 게시물 중 미분석된 게시물만 AI로 분석
 */
export async function POST(req: Request) {
  try {
    // 인증 확인
    const session = await getServerSession()
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const { postIds } = await req.json()

    // 사용자 조회
    const user = await prisma.user.findUnique({
      where: { email: session.user.email as string },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 분석 대상 게시물 조회
    const whereClause: any = {
      userId: user.id,
      aiAnalyzed: false, // 미분석 게시물만
    }

    // 특정 게시물 ID가 지정된 경우
    if (postIds && Array.isArray(postIds) && postIds.length > 0) {
      whereClause.id = { in: postIds }
    }

    const posts = await prisma.collectedPost.findMany({
      where: whereClause,
      include: {
        wholesaleBand: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    if (posts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'AI 분석이 필요한 게시물이 없습니다.',
        analyzed: 0,
        skipped: 0,
      })
    }

    console.log(`🤖 AI 분석 시작: ${posts.length}개 게시물`)

    // AI 분석 실행
    // TODO: analyzePostsWithAI 함수 구현 필요
    return NextResponse.json({
      success: false,
      error: 'analyzePostsWithAI 함수가 구현되지 않았습니다.',
    }, { status: 501 })

    // TODO: Unreachable code below - implement AI analysis first
    /* let successCount = 0
    let failureCount = 0

    // 분석 결과를 DB에 저장
    for (const post of analyzedPosts) {
      try {
        await prisma.collectedPost.update({
          where: { id: post.id },
          data: {
            aiAnalyzed: true,
            aiProcessedAt: new Date(),
            hookingTitle: post.hookingTitle,
            hookingContent: post.hookingContent,
            detailedContent: post.detailedContent,
            productCategory: post.productCategory,
            extractedPrice: post.extractedPrice,
            adjustedPrice: post.adjustedPrice,
            shippingFee: post.shippingFee,
            priceInfo: post.priceInfo,
            priceOptions: post.priceOptions ? JSON.stringify(post.priceOptions) : null,
            shippingPolicy: post.shippingPolicy,
            hasDeadline: post.hasDeadline,
            deadlineInfo: post.deadlineInfo,
            isAvailable: post.isAvailable,
            unavailableReason: post.unavailableReason,
          },
        })
        successCount++
      } catch (error) {
        console.error(`Failed to update post ${post.id}:`, error)
        failureCount++
      }
    }

    console.log(`✅ AI 분석 완료: 성공 ${successCount}개, 실패 ${failureCount}개`)

    return NextResponse.json({
      success: true,
      message: `${successCount}개 게시물의 AI 분석이 완료되었습니다.${failureCount > 0 ? ` (실패: ${failureCount}개)` : ''}`,
      analyzed: successCount,
      failed: failureCount,
      total: posts.length,
    }) */

  } catch (error) {
    console.error('AI 분석 실패:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'AI 분석 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}

/**
 * AI 분석 대상 게시물 개수 조회
 */
export async function GET(req: Request) {
  try {
    const session = await getServerSession()
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email as string },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 미분석 게시물 개수 조회
    const pendingCount = await prisma.collectedPost.count({
      where: {
        userId: user.id,
        aiAnalyzed: false,
      },
    })

    return NextResponse.json({
      success: true,
      pendingCount,
    })

  } catch (error) {
    console.error('미분석 게시물 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
