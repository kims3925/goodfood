/**
 * Next.js Instrumentation
 * 서버 시작 시 자동으로 실행되는 초기화 코드
 */

export async function register() {
  // 서버 사이드에서만 실행
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Instrumentation] Shop-app 서버 초기화...')

    // 입금 기한 초과 주문 자동 취소 스케줄러 시작
    startExpiredOrderCanceller()
  }
}

/**
 * 입금 기한 초과 주문 자동 취소 스케줄러
 * 10분마다 실행
 */
function startExpiredOrderCanceller() {
  const INTERVAL = 10 * 60 * 1000 // 10분

  console.log('[AutoCancel] 자동 취소 스케줄러 시작 (10분 간격)')

  // 초기 실행 (서버 시작 후 1분 뒤)
  setTimeout(async () => {
    await cancelExpiredOrders()
  }, 60 * 1000)

  // 주기적 실행
  setInterval(async () => {
    await cancelExpiredOrders()
  }, INTERVAL)
}

/**
 * 입금 기한 초과 주문 취소 실행
 */
async function cancelExpiredOrders() {
  try {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/cron/cancel-expired-orders`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    if (data.cancelledCount > 0) {
      console.log(`[AutoCancel] ${data.cancelledCount}개 주문 자동 취소됨`)
    }
  } catch (error) {
    console.error('[AutoCancel] 자동 취소 실행 실패:', error)
  }
}
