export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

/**
 * GET /api/product/deactivate
 *
 * 일괄 비활성화 대상 상품 미리보기
 * - 지정된 기간(일) 이전에 생성된 미발행 상품 조회
 *
 * Query params:
 * - days: 기준 일수 (기본값: 90)
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '90')

    // 기준 날짜 계산 (days일 전)
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    // 대상 상품 조회: 지정 기간 이전 생성 + 활성 상태 + Soft Delete 제외
    // (발행 여부 관계없이 오래된 모든 상품)
    const products = await prisma.product.findMany({
      where: {
        userId: currentUser.userId,
        deletedAt: null, // Soft Delete 제외
        isActive: true, // 활성 상태만
        createdAt: {
          lt: cutoffDate,
        },
      },
      select: {
        id: true,
        name: true,
        thumbnailUrl: true,
        createdAt: true,
        channel: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        count: products.length,
        products: products.slice(0, 100), // 미리보기는 최대 100개만
        cutoffDate: cutoffDate.toISOString(),
        days,
      },
    })
  } catch (error) {
    console.error('비활성화 대상 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '대상 상품 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/product/deactivate
 *
 * 일괄 비활성화 실행
 * - 지정된 기간(일) 이전에 생성된 상품을 비활성화 (isActive: false)
 * - Soft Delete가 아닌 비활성화 상태로 변경하여 목록에서 계속 조회 가능
 *
 * Body:
 * - days: 기준 일수 (필수)
 * - productIds?: 특정 상품 ID 목록 (선택, 미리보기에서 선택한 상품만 비활성화)
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { days, productIds } = body

    if (!days || typeof days !== 'number' || days < 1) {
      return NextResponse.json(
        { success: false, error: '유효한 기간(days)을 입력해주세요.' },
        { status: 400 }
      )
    }

    // 기준 날짜 계산
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    // 비활성화 대상 조건 (발행 여부 관계없이 오래된 모든 상품)
    const whereCondition: any = {
      userId: currentUser.userId,
      deletedAt: null,
      isActive: true,
      createdAt: {
        lt: cutoffDate,
      },
    }

    // 특정 상품 ID가 지정된 경우
    if (productIds && Array.isArray(productIds) && productIds.length > 0) {
      whereCondition.id = { in: productIds }
    }

    // 비활성화 실행 (isActive만 false로 변경, deletedAt은 설정하지 않음)
    const result = await prisma.product.updateMany({
      where: whereCondition,
      data: {
        isActive: false,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        deactivatedCount: result.count,
        cutoffDate: cutoffDate.toISOString(),
        days,
      },
      message: `${result.count}개 상품이 비활성화되었습니다.`,
    })
  } catch (error) {
    console.error('일괄 비활성화 실패:', error)
    return NextResponse.json(
      { success: false, error: '일괄 비활성화에 실패했습니다.' },
      { status: 500 }
    )
  }
}
