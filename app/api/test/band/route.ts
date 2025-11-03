import { NextRequest, NextResponse } from 'next/server'
import { NaverBandClient } from '@/lib/api/band-client'

/**
 * 네이버 밴드 API 연결 테스트 엔드포인트
 * GET /api/test/band
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🧪 네이버 밴드 API 테스트 시작...')
    
    // 환경변수 확인
    const accessToken = process.env.BAND_ACCESS_TOKEN
    const clientId = process.env.BAND_CLIENT_ID
    const clientSecret = process.env.BAND_CLIENT_SECRET
    
    console.log('🔑 환경변수 상태:', {
      accessToken: accessToken ? `${accessToken.slice(0, 10)}...` : '❌ 없음',
      clientId: clientId ? `${clientId}` : '❌ 없음',
      clientSecret: clientSecret ? `${clientSecret.slice(0, 5)}...` : '❌ 없음'
    })

    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: 'BAND_ACCESS_TOKEN이 설정되지 않았습니다.',
        suggestion: '.env.local 파일에서 BAND_ACCESS_TOKEN을 확인해주세요.'
      }, { status: 400 })
    }

    // Band API 클라이언트 초기화
    const bandClient = new NaverBandClient(accessToken)
    
    // 1단계: 토큰 유효성 검사
    console.log('1️⃣ 액세스 토큰 유효성 검사...')
    const isTokenValid = await bandClient.validateToken()
    
    if (!isTokenValid) {
      return NextResponse.json({
        success: false,
        error: '액세스 토큰이 유효하지 않습니다.',
        suggestions: [
          '1. 네이버 개발자센터에서 토큰이 만료되지 않았는지 확인',
          '2. 토큰 권한에 "밴드 API" 권한이 포함되어 있는지 확인',
          '3. 새로운 액세스 토큰을 발급받아 교체'
        ]
      }, { status: 401 })
    }

    // 2단계: 밴드 목록 조회
    console.log('2️⃣ 가입된 밴드 목록 조회...')
    const bands = await bandClient.getBands()
    
    console.log(`✅ ${bands.length}개의 밴드를 찾았습니다.`)
    
    // 3단계: 첫 번째 밴드의 게시물 조회 (테스트)
    let firstBandPosts = []
    if (bands.length > 0) {
      const firstBand = bands[0]
      console.log(`3️⃣ 첫 번째 밴드 "${firstBand.name}" 게시물 조회...`)
      
      try {
        firstBandPosts = await bandClient.getBandPosts(firstBand.band_key, { limit: 5 })
        console.log(`✅ ${firstBandPosts.length}개의 게시물을 찾았습니다.`)
      } catch (error) {
        console.warn('⚠️ 게시물 조회 실패 (권한 문제일 수 있음):', error)
      }
    }

    // 테스트 결과 반환
    return NextResponse.json({
      success: true,
      message: '네이버 밴드 API 연결 성공! 🎉',
      data: {
        tokenValid: true,
        bandsCount: bands.length,
        bands: bands.map(band => ({
          band_key: band.band_key,
          name: band.name,
          description: band.description?.slice(0, 100) + (band.description && band.description.length > 100 ? '...' : ''),
          member_count: band.member_count,
          is_public: band.is_public,
          created_at: band.created_at
        })),
        samplePosts: firstBandPosts.length > 0 ? firstBandPosts.slice(0, 3).map(post => ({
          post_key: post.post_key,
          content: post.content.slice(0, 200) + (post.content.length > 200 ? '...' : ''),
          author_name: post.author.name,
          created_at: post.created_at,
          has_photos: post.photo && post.photo.length > 0
        })) : []
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ 밴드 API 테스트 실패:', error)
    
    // 에러 타입별 분석 및 해결책 제공
    let errorAnalysis = {
      type: 'UNKNOWN_ERROR',
      message: '알 수 없는 오류가 발생했습니다.',
      suggestions: ['서버 로그를 확인해주세요.']
    }

    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase()
      
      if (errorMessage.includes('fetch')) {
        errorAnalysis = {
          type: 'NETWORK_ERROR',
          message: '네트워크 연결 오류입니다.',
          suggestions: [
            '1. 인터넷 연결을 확인해주세요.',
            '2. 방화벽이나 프록시 설정을 확인해주세요.',
            '3. 네이버 밴드 API 서버 상태를 확인해주세요.'
          ]
        }
      } else if (errorMessage.includes('unauthorized') || errorMessage.includes('401')) {
        errorAnalysis = {
          type: 'AUTH_ERROR',
          message: '인증 오류입니다.',
          suggestions: [
            '1. BAND_ACCESS_TOKEN이 올바른지 확인해주세요.',
            '2. 토큰이 만료되지 않았는지 확인해주세요.',
            '3. 네이버 개발자센터에서 새 토큰을 발급받아주세요.'
          ]
        }
      } else if (errorMessage.includes('403')) {
        errorAnalysis = {
          type: 'PERMISSION_ERROR',
          message: '권한 오류입니다.',
          suggestions: [
            '1. 애플리케이션에 밴드 API 권한이 부여되었는지 확인해주세요.',
            '2. 사용자가 밴드 API 사용에 동의했는지 확인해주세요.'
          ]
        }
      }
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
      analysis: errorAnalysis,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}