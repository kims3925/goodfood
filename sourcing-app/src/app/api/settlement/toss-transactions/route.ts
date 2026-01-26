export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import type { TossTransaction, TransactionsSummary } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { readShopSettings } from '@/lib/paths'

// 로컬 확장 타입
interface LocalTransactionsSummary {
  totalAmount: number
  totalCount: number
  cardAmount: number
  cardCount: number
  easyPayAmount: number
  easyPayCount: number
  canceledAmount: number
  canceledCount: number
  transactions: TossTransaction[]
  methodTypes: string[]  // 디버깅용
}

// 토스페이먼츠 API 키 가져오기
function getTossPaymentsKeys() {
  // shop-app 설정 파일에서 키 조회 (환경변수 SHOP_SETTINGS_PATH 지원)
  const settings = readShopSettings()

  if (settings) {
    return {
      secretKey: (settings.tossSecretKey as string) || process.env.TOSS_PAYMENTS_SECRET_KEY || '',
      clientKey: (settings.tossClientKey as string) || process.env.TOSS_PAYMENTS_CLIENT_KEY || ''
    }
  }

  // 환경변수 폴백
  return {
    secretKey: process.env.TOSS_PAYMENTS_SECRET_KEY || '',
    clientKey: process.env.TOSS_PAYMENTS_CLIENT_KEY || ''
  }
}

// 토스페이먼츠 거래 조회
async function fetchTransactions(
  secretKey: string,
  startDate: string,
  endDate: string,
  startingAfter?: string
): Promise<{ hasMore: boolean; lastCursor?: string; data: TossTransaction[] }> {
  const baseUrl = 'https://api.tosspayments.com/v1'

  const params = new URLSearchParams({
    startDate,
    endDate,
  })
  if (startingAfter) {
    params.set('startingAfter', startingAfter)
  }

  const response = await fetch(
    `${baseUrl}/transactions?${params.toString()}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
      }
    }
  )

  if (!response.ok) {
    const errorData = await response.json()
    console.error('토스페이먼츠 거래 조회 실패:', errorData)
    throw new Error(`거래 조회 실패: ${errorData.message || '알 수 없는 오류'}`)
  }

  const data = await response.json()

  const transactions = Array.isArray(data) ? data : []
  const hasMore = transactions.length >= 100
  const lastCursor = transactions.length > 0
    ? transactions[transactions.length - 1].transactionKey
    : undefined

  return {
    hasMore,
    lastCursor,
    data: transactions
  }
}

/**
 * GET /api/settlement/toss-transactions
 * 토스페이먼츠 거래 내역 조회
 *
 * Query Parameters:
 * - year: 조회 연도 (필수)
 * - month: 조회 월 (필수)
 */
export async function GET(request: Request) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')
    const month = searchParams.get('month')

    if (!year || !month) {
      return NextResponse.json(
        { success: false, error: '년도와 월을 지정해주세요.' },
        { status: 400 }
      )
    }

    // 해당 월의 시작일과 종료일 계산
    const yearNum = parseInt(year, 10)
    const monthNum = parseInt(month, 10)

    // NaN 및 유효 범위 검증
    if (Number.isNaN(yearNum) || Number.isNaN(monthNum)) {
      return NextResponse.json(
        { success: false, error: '년도와 월은 숫자여야 합니다.' },
        { status: 400 }
      )
    }

    if (monthNum < 1 || monthNum > 12) {
      return NextResponse.json(
        { success: false, error: '월은 1~12 사이의 값이어야 합니다.' },
        { status: 400 }
      )
    }

    if (yearNum < 2020 || yearNum > 2100) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 연도입니다.' },
        { status: 400 }
      )
    }

    const startDate = `${yearNum}-${String(monthNum).padStart(2, '0')}-01T00:00:00`

    // 다음 달의 첫날에서 1초를 빼서 마지막 날 23:59:59 구하기
    const lastDay = new Date(yearNum, monthNum, 0).getDate()
    const endDate = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59`

    // API 키 조회
    const keys = getTossPaymentsKeys()

    if (!keys.secretKey) {
      return NextResponse.json(
        { success: false, error: '토스페이먼츠 API 키가 설정되지 않았습니다.' },
        { status: 500 }
      )
    }

    // 모든 거래 조회 (페이지네이션)
    const allTransactions: TossTransaction[] = []
    let cursor: string | undefined = undefined
    let hasMore = true
    let pageCount = 0
    const MAX_PAGES = 10  // 무한 루프 방지용 최대 페이지 수

    while (hasMore) {
      const response = await fetchTransactions(keys.secretKey, startDate, endDate, cursor)

      // 빈 응답 처리 (무한 루프 방지)
      if (response.data.length === 0) {
        break
      }

      allTransactions.push(...response.data)
      hasMore = response.hasMore
      cursor = response.lastCursor
      pageCount++

      // 페이지 카운트 기반 무한 루프 방지
      if (pageCount >= MAX_PAGES) {
        console.warn(`토스페이먼츠 거래 조회: 최대 페이지(${MAX_PAGES}) 도달, 조회 중단`)
        break
      }
    }

    // 거래 요약 계산
    const methodSet = new Set<string>()
    const summary: LocalTransactionsSummary = {
      totalAmount: 0,
      totalCount: 0,
      cardAmount: 0,
      cardCount: 0,
      easyPayAmount: 0,
      easyPayCount: 0,
      canceledAmount: 0,
      canceledCount: 0,
      transactions: allTransactions,
      methodTypes: []
    }

    for (const tx of allTransactions) {
      // method 값 수집 (디버깅용)
      if (tx.method) {
        methodSet.add(tx.method)
      }

      // 취소 거래 처리
      if (tx.status === 'CANCELED' || tx.status === 'PARTIAL_CANCELED') {
        summary.canceledAmount += tx.amount
        summary.canceledCount++
        continue
      }

      // 완료된 거래만 집계
      if (tx.status === 'DONE') {
        summary.totalAmount += tx.amount
        summary.totalCount++

        // 결제 수단별 집계
        const method = tx.method || ''

        if (method.includes('카드') || method.toLowerCase().includes('card')) {
          summary.cardAmount += tx.amount
          summary.cardCount++
        } else if (method.includes('간편결제') || method.toLowerCase().includes('easypay')) {
          summary.easyPayAmount += tx.amount
          summary.easyPayCount++
        }
      }
    }

    summary.methodTypes = Array.from(methodSet)

    return NextResponse.json({
      success: true,
      data: {
        period: {
          year: yearNum,
          month: monthNum,
          startDate,
          endDate
        },
        summary: {
          totalAmount: summary.totalAmount,
          totalCount: summary.totalCount,
          cardAmount: summary.cardAmount,
          cardCount: summary.cardCount,
          easyPayAmount: summary.easyPayAmount,
          easyPayCount: summary.easyPayCount,
          canceledAmount: summary.canceledAmount,
          canceledCount: summary.canceledCount,
          methodTypes: summary.methodTypes  // 디버깅용
        },
        transactions: allTransactions.slice(0, 100) // 최근 100건만 반환
      }
    })

  } catch (error) {
    console.error('토스페이먼츠 거래 조회 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '거래 조회 중 오류가 발생했습니다.'
      },
      { status: 500 }
    )
  }
}
