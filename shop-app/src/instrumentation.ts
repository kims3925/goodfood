/**
 * Next.js Instrumentation
 * 서버 시작 시 자동으로 실행되는 초기화 코드
 */

export async function register() {
  // 서버 사이드에서만 실행
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Instrumentation] Shop-app 서버 초기화...')
  }
}
