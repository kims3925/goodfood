import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    // 실제 사용자 ID 찾기 (ID 또는 이메일로)
    let actualUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true }
    })

    if (!actualUser) {
      actualUser = await prisma.user.findUnique({
        where: { email: session.user.email || '' },
        select: { id: true }
      })
    }

    if (!actualUser) {
      return NextResponse.json({
        success: false,
        error: '사용자를 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 등록된 모든 도매 밴드 조회
    const wholesaleBands = await prisma.wholesaleBand.findMany({
      where: {
        userId: actualUser.id,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        bandKey: true,
        collectComments: true
      }
    })

    if (wholesaleBands.length === 0) {
      return NextResponse.json({
        success: false,
        error: '등록된 도매 밴드가 없습니다.'
      })
    }

    const results = []

    for (const band of wholesaleBands) {
      console.log(`🧪 [TEST] ${band.name} 상품 수집 테스트 중...`)
      
      try {
        // collection API 호출
        const collectResponse = await fetch(`${request.url.replace('/api/test/wholesale/collect-test', '/api/wholesale/collect')}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('Cookie') || ''
          },
          body: JSON.stringify({ bandId: band.id })
        })

        const collectResult = await collectResponse.json()

        results.push({
          band_name: band.name,
          band_id: band.id,
          collect_result: collectResult
        })

        console.log(`✅ [TEST] ${band.name}: ${collectResult.success ? `${collectResult.newPosts || 0}개 수집 성공` : `실패 - ${collectResult.error}`}`)

      } catch (error) {
        console.error(`❌ [TEST] ${band.name} 테스트 실패:`, error)
        results.push({
          band_name: band.name,
          band_id: band.id,
          error: `테스트 실패: ${error}`
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `${wholesaleBands.length}개 밴드 수집 테스트 완료`,
      results: results
    })

  } catch (error) {
    console.error('수집 테스트 실패:', error)
    return NextResponse.json({
      success: false,
      error: '테스트 중 오류가 발생했습니다.',
      error_details: error.toString()
    }, { status: 500 })
  }
}