import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'

// GET: 정산 이력 조회 (현재는 빈 데이터 반환)
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    // Settlement 모델이 없으므로 빈 데이터 반환
    return NextResponse.json({
      success: true,
      data: {
        settlements: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
        },
        stats: {
          PENDING: { count: 0, totalAmount: 0, totalOrders: 0 },
          COMPLETED: { count: 0, totalAmount: 0, totalOrders: 0 },
          CANCELLED: { count: 0, totalAmount: 0, totalOrders: 0 },
        },
      },
    })
  } catch (error) {
    console.error('정산 이력 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '정산 이력을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}
