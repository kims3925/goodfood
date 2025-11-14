import { NextRequest, NextResponse } from 'next/server'
import { productMonitor } from '@/domain/products/services/monitoring.service'

// Vercel Cron Job이나 외부 스케줄러에서 호출할 엔드포인트
export async function GET(request: NextRequest) {
  try {
    // 보안을 위한 간단한 인증 토큰 확인
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || 'bandauto-cron-secret'
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 })
    }

    console.log('🕐 상품 모니터링 크론 작업 시작:', new Date().toISOString())

    // 모든 처리된 상품들의 상태 확인 시작
    productMonitor.scheduleAllProcessedProducts().catch(error => {
      console.error('크론 작업 중 오류:', error)
    })

    return NextResponse.json({
      success: true,
      message: 'Product monitoring cron job started',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('상품 모니터링 크론 작업 오류:', error)
    return NextResponse.json({
      success: false,
      error: '크론 작업 실행 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// 수동 트리거를 위한 POST 엔드포인트
export async function POST(request: NextRequest) {
  try {
    console.log('📱 수동 상품 모니터링 시작:', new Date().toISOString())

    const { immediate } = await request.json()

    if (immediate) {
      // 즉시 실행
      await productMonitor.scheduleAllProcessedProducts()
      
      return NextResponse.json({
        success: true,
        message: 'Product monitoring completed',
        timestamp: new Date().toISOString()
      })
    } else {
      // 백그라운드 실행
      productMonitor.scheduleAllProcessedProducts().catch(error => {
        console.error('백그라운드 모니터링 오류:', error)
      })

      return NextResponse.json({
        success: true,
        message: 'Product monitoring started in background',
        timestamp: new Date().toISOString()
      })
    }

  } catch (error) {
    console.error('수동 상품 모니터링 오류:', error)
    return NextResponse.json({
      success: false,
      error: '모니터링 실행 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}