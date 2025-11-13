import { NextResponse } from 'next/server'
import { refreshBandToken, validateBandToken } from '@/lib/band-token-refresh'

export async function POST() {
  try {
    console.log('🔄 Band API 토큰 갱신 시작...')
    
    // 현재 토큰 상태 확인
    const currentToken = process.env.BAND_ACCESS_TOKEN
    if (currentToken) {
      const isValid = await validateBandToken(currentToken)
      if (isValid) {
        return NextResponse.json({
          success: true,
          message: '현재 토큰이 아직 유효합니다.',
          currentToken: `${currentToken.slice(0, 20)}...`
        })
      }
    }
    
    // 토큰 갱신 시도
    const newTokens = await refreshBandToken()
    
    return NextResponse.json({
      success: true,
      message: '토큰이 성공적으로 갱신되었습니다.',
      newTokens: {
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token,
        expires_in: newTokens.expires_in
      },
      instructions: [
        '다음 내용을 .env.local 파일에 업데이트하세요:',
        `BAND_ACCESS_TOKEN="${newTokens.access_token}"`,
        newTokens.refresh_token ? `BAND_REFRESH_TOKEN="${newTokens.refresh_token}"` : '',
        '그리고 개발 서버를 재시작하세요: npm run dev'
      ].filter(Boolean)
    })
    
  } catch (error) {
    console.error('토큰 갱신 실패:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
      solution: [
        '1. Band API 클라이언트 정보를 확인하세요 (.env.local)',
        '2. 리프레시 토큰이 유효한지 확인하세요',
        '3. 필요시 Band Developers에서 새로운 앱을 등록하세요',
        '4. https://developers.band.us/develop/guide/api 참조'
      ]
    }, { status: 500 })
  }
}
