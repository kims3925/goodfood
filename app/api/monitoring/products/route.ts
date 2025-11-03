import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { productMonitor } from '@/lib/product-monitor'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    const { action, postId } = await request.json()

    switch (action) {
      case 'check_single':
        if (!postId) {
          return NextResponse.json({
            success: false,
            error: '게시물 ID가 필요합니다.'
          }, { status: 400 })
        }

        try {
          const result = await productMonitor.checkProductAvailability(postId)
          return NextResponse.json({
            success: true,
            result
          })
        } catch (error) {
          return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : '상품 상태 확인 실패'
          }, { status: 500 })
        }

      case 'schedule_all':
        // 모든 처리된 상품들의 모니터링 스케줄
        productMonitor.scheduleAllProcessedProducts().catch(error => {
          console.error('Background monitoring error:', error)
        })

        return NextResponse.json({
          success: true,
          message: '모든 상품 모니터링이 백그라운드에서 시작되었습니다.'
        })

      case 'queue_status':
        const status = productMonitor.getQueueStatus()
        return NextResponse.json({
          success: true,
          status
        })

      default:
        return NextResponse.json({
          success: false,
          error: '유효하지 않은 액션입니다.'
        }, { status: 400 })
    }

  } catch (error) {
    console.error('상품 모니터링 API 오류:', error)
    return NextResponse.json({
      success: false,
      error: '상품 모니터링 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    const status = productMonitor.getQueueStatus()
    
    return NextResponse.json({
      success: true,
      status
    })

  } catch (error) {
    console.error('상품 모니터링 상태 조회 오류:', error)
    return NextResponse.json({
      success: false,
      error: '상태 조회 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}