import { NextResponse } from 'next/server'
import type { TossTransaction, TransactionsSummary } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { readShopSettings } from '@/lib/paths'

// 로컬 확장 타입 (methodTypes 포함)
interface LocalTransactionsSummary extends Omit<TransactionsSummary, 'methodTypes'> {
  methodTypes: string[]  // 디버깅용: 어떤 method 값들이 있는지 (필수)
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
    const yearNum = parseInt(year)
    const monthNum = parseInt(month)
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

    while (hasMore) {
      const response = await fetchTransactions(keys.secretKey, startDate, endDate, cursor)
      allTransactions.push(...response.data)
      hasMore = response.hasMore
      cursor = response.lastCursor

      // 무한 루프 방지 (최대 10페이지)
      if (allTransactions.length > 1000) break
    }

    // 거래 요약 계산
    const methodSet = new Set<string>()
    const summary: LocalTransactionsSummary = {
      totalAmount: 0,
      totalCount: 0,
      cardAmount: 0,
      cardCount: 0,
      transferAmount: 0,
      transferCount: 0,
      virtualAccountAmount: 0,
      virtualAccountCount: 0,
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

        // 결제 수단별 집계 (다양한 값 처리)
        const method = tx.method?.toLowerCase() || ''

        if (method.includes('카드') || method.includes('card')) {
          summary.cardAmount += tx.amount
          summary.cardCount++
        } else if (method.includes('계좌이체') || method.includes('transfer')) {
          summary.transferAmount += tx.amount
          summary.transferCount++
        } else if (method.includes('가상계좌') || method.includes('virtualaccount')) {
          summary.virtualAccountAmount += tx.amount
          summary.virtualAccountCount++
        }
      }
    }

    // 디버깅용: 어떤 method 값들이 있는지 로그
    summary.methodTypes = Array.from(methodSet)
    console.log('토스페이먼츠 거래 method 값들:', summary.methodTypes)

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
          transferAmount: summary.transferAmount,
          transferCount: summary.transferCount,
          virtualAccountAmount: summary.virtualAccountAmount,
          virtualAccountCount: summary.virtualAccountCount,
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
