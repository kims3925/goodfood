// Band API 토큰 갱신 유틸리티
export async function refreshBandToken() {
  const clientId = process.env.BAND_CLIENT_ID
  const clientSecret = process.env.BAND_CLIENT_SECRET
  const refreshToken = process.env.BAND_REFRESH_TOKEN
  
  if (!clientId || !clientSecret) {
    throw new Error('Band API 클라이언트 인증 정보가 없습니다.')
  }

  // Band API OAuth 2.0 토큰 갱신
  try {
    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    
    const response = await fetch('https://auth.band.us/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${authHeader}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken || ''
      })
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('토큰 갱신 실패:', response.status, errorData)
      throw new Error(`토큰 갱신 실패: ${response.status}`)
    }

    const tokenData = await response.json()
    console.log('✅ 토큰 갱신 성공')
    
    return {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in
    }
  } catch (error) {
    console.error('토큰 갱신 중 오류:', error)
    throw error
  }
}

// 토큰 유효성 검사
export async function validateBandToken(accessToken: string) {
  try {
    // Band API의 간단한 엔드포인트로 토큰 테스트
    const testUrl = new URL('https://openapi.band.us/v2/profile')
    testUrl.searchParams.append('access_token', accessToken)

    const response = await fetch(testUrl.toString())
    const data = await response.json()

    // 상세한 로깅
    console.log('🔍 Band API 토큰 검증 응답:', {
      status: response.status,
      ok: response.ok,
      result_code: data.result_code,
      result_data: data.result_data,
      full_response: JSON.stringify(data).slice(0, 200)
    })

    if (response.ok && data.result_code === 1) {
      console.log('✅ 토큰이 유효합니다.')
      return true
    } else if (data.result_code === 1001) {
      console.log('⚠️ Band API 할당량이 초과되었습니다. 잠시 후 다시 시도하세요.')
      return false
    } else if (data.result_data?.detail?.error === 'invalid_token') {
      console.log('❌ 토큰이 만료되었거나 유효하지 않습니다.')
      return false
    } else {
      console.log('⚠️ 토큰 상태를 확인할 수 없습니다. 응답:', JSON.stringify(data))
      return false
    }
  } catch (error) {
    console.error('토큰 검증 중 오류:', error)
    return false
  }
}

// 토큰 자동 갱신 (필요시)
export async function ensureValidToken(): Promise<string> {
  const currentToken = process.env.BAND_ACCESS_TOKEN
  
  if (!currentToken) {
    throw new Error('Band API 토큰이 설정되지 않았습니다.')
  }
  
  // 토큰 유효성 검사
  const isValid = await validateBandToken(currentToken)
  
  if (isValid) {
    return currentToken
  }
  
  // 토큰이 유효하지 않으면 갱신 시도
  console.log('🔄 토큰 갱신을 시도합니다...')
  const newTokens = await refreshBandToken()
  
  // 환경변수 업데이트는 수동으로 해야 함 (개발 환경에서)
  console.log('📝 새 토큰을 .env.local에 업데이트해주세요:')
  console.log(`BAND_ACCESS_TOKEN="${newTokens.access_token}"`)
  if (newTokens.refresh_token) {
    console.log(`BAND_REFRESH_TOKEN="${newTokens.refresh_token}"`)
  }
  
  return newTokens.access_token
}