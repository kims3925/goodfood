export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { getActiveVisitors, getVisitorsByShop, getActiveVisitorCount } from '@/lib/redis'

/**
 * GET /api/shop/visitors
 *
 * 실시간 쇼핑몰 접속자 조회
 *
 * Query params:
 * - groupBy: 'shop' | undefined (쇼핑몰별 그룹화)
 */
export async function GET(request: Request) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const groupBy = searchParams.get('groupBy')

    if (groupBy === 'shop') {
      const visitorsByShop = await getVisitorsByShop()
      const totalCount = Object.values(visitorsByShop).flat().length

      return NextResponse.json({
        success: true,
        data: {
          totalCount,
          byShop: visitorsByShop,
        },
      })
    }

    const visitors = await getActiveVisitors()
    const count = await getActiveVisitorCount()

    // 통계 계산
    const stats = {
      total: count,
      mobile: visitors.filter((v) => v.device === 'mobile').length,
      desktop: visitors.filter((v) => v.device === 'desktop').length,
      viewingProduct: visitors.filter((v) => v.productId).length,
    }

    return NextResponse.json({
      success: true,
      data: {
        stats,
        visitors,
      },
    })
  } catch (error) {
    console.error('접속자 조회 실패:', error)

    // Redis 연결 실패 시 빈 결과 반환 (서비스 영향 최소화)
    if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
      return NextResponse.json({
        success: true,
        data: {
          stats: { total: 0, mobile: 0, desktop: 0, viewingProduct: 0 },
          visitors: [],
          warning: 'Redis 연결 실패 - 접속자 추적이 비활성화되어 있습니다.',
        },
      })
    }

    return NextResponse.json(
      { success: false, error: '접속자 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}
