import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import * as path from 'path'

/**
 * 새 토큰으로 환경변수 업데이트 및 테스트 API
 * POST /api/test/band/update-token
 * Body: { token: "new_access_token" } 또는 { code: "authorization_code" }
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 토큰 업데이트 및 테스트 시작...')
    
    const body = await request.json()
    let accessToken = body.token
    
    // Authorization Code가 제공된 경우 토큰 교환 먼저 수행
    if (body.code && !accessToken) {
      console.log('🔑 Authorization Code로 토큰 교환 중...')
      
      const clientId = process.env.BAND_CLIENT_ID
      const clientSecret = process.env.BAND_CLIENT_SECRET
      
      if (!clientId || !clientSecret) {
        return NextResponse.json({
          success: false,
          error: 'Client credentials가 설정되지 않았습니다.'
        }, { status: 500 })
      }
      
      const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
      
      const tokenResponse = await fetch('https://auth.band.us/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${basicAuth}`
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: body.code
        })
      })
      
      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text()
        return NextResponse.json({
          success: false,
          error: `토큰 교환 실패: HTTP ${tokenResponse.status}`,
          details: errorText
        }, { status: tokenResponse.status })
      }
      
      const tokenData = await tokenResponse.json()
      
      if (tokenData.error) {
        return NextResponse.json({
          success: false,
          error: `토큰 교환 실패: ${tokenData.error}`,
          description: tokenData.error_description
        }, { status: 400 })
      }
      
      accessToken = tokenData.access_token
      console.log('✅ 토큰 교환 성공')
    }
    
    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: 'token 또는 code 파라미터가 필요합니다.',
        usage: {
          'token 직접 제공': 'POST { "token": "your_access_token" }',
          'code로 토큰 교환': 'POST { "code": "authorization_code" }'
        }
      }, { status: 400 })
    }
    
    console.log('🔍 새로운 토큰:', accessToken.substring(0, 20) + '...')
    
    // 1단계: .env.local 파일 업데이트
    console.log('💾 .env.local 파일 업데이트 중...')
    
    try {
      const envPath = path.join(process.cwd(), '.env.local')
      const envContent = await fs.readFile(envPath, 'utf-8')
      
      // BAND_ACCESS_TOKEN 줄 찾기 및 교체
      const updatedContent = envContent.replace(
        /BAND_ACCESS_TOKEN="[^"]*"/,
        `BAND_ACCESS_TOKEN="${accessToken}"`
      )
      
      await fs.writeFile(envPath, updatedContent, 'utf-8')
      console.log('✅ .env.local 파일 업데이트 완료')
      
    } catch (error) {
      console.error('❌ .env.local 파일 업데이트 실패:', error)
      return NextResponse.json({
        success: false,
        error: '.env.local 파일 업데이트 실패',
        details: error instanceof Error ? error.message : String(error)
      }, { status: 500 })
    }
    
    // 2단계: 새로운 토큰으로 밴드 API 테스트
    console.log('🧪 새로운 토큰으로 밴드 API 테스트...')
    
    const testResults = {
      bandsTest: null as any,
      postsTest: null as any
    }
    
    // 2-1. 밴드 목록 조회 테스트
    try {
      const bandsResponse = await fetch('https://openapi.band.us/v2.1/bands', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'BandAuto/1.0.0'
        }
      })
      
      if (bandsResponse.ok) {
        const bandsData = await bandsResponse.json()
        testResults.bandsTest = {
          success: true,
          status: bandsResponse.status,
          bandsCount: bandsData.result_data?.bands?.length || 0,
          bands: bandsData.result_data?.bands?.slice(0, 5).map((band: any) => ({
            band_key: band.band_key,
            name: band.name,
            member_count: band.member_count
          })) || []
        }
        console.log(`✅ 밴드 목록 조회 성공: ${testResults.bandsTest.bandsCount}개 밴드`)
      } else {
        const errorText = await bandsResponse.text()
        testResults.bandsTest = {
          success: false,
          status: bandsResponse.status,
          error: errorText
        }
        console.log(`❌ 밴드 목록 조회 실패: ${bandsResponse.status}`)
      }
    } catch (error) {
      testResults.bandsTest = {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
    
    // 2-2. "나은 상품 공급방" 게시물 조회 테스트
    const targetBandKey = 'AAAMvZteE5OjyYnjS64rQuH3'
    
    try {
      const postsResponse = await fetch(`https://openapi.band.us/v2.1/bands/${targetBandKey}/posts?limit=5`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'BandAuto/1.0.0'
        }
      })
      
      if (postsResponse.ok) {
        const postsData = await postsResponse.json()
        testResults.postsTest = {
          success: true,
          status: postsResponse.status,
          postsCount: postsData.result_data?.posts?.length || 0,
          posts: postsData.result_data?.posts?.slice(0, 3).map((post: any) => ({
            post_key: post.post_key,
            content: post.content?.substring(0, 100) + '...',
            created_at: post.created_at,
            author: post.author?.name
          })) || []
        }
        console.log(`✅ "나은 상품 공급방" 게시물 조회 성공: ${testResults.postsTest.postsCount}개 게시물`)
      } else {
        const errorText = await postsResponse.text()
        testResults.postsTest = {
          success: false,
          status: postsResponse.status,
          error: errorText
        }
        console.log(`❌ "나은 상품 공급방" 게시물 조회 실패: ${postsResponse.status}`)
      }
    } catch (error) {
      testResults.postsTest = {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
    
    // 결과 분석
    const allTestsSuccessful = testResults.bandsTest?.success && testResults.postsTest?.success
    
    return NextResponse.json({
      success: allTestsSuccessful,
      message: allTestsSuccessful 
        ? '🎉 토큰 업데이트 및 모든 API 테스트 성공!' 
        : '⚠️ 토큰은 업데이트되었지만 일부 API 테스트가 실패했습니다.',
      
      tokenInfo: {
        updated: true,
        preview: accessToken.substring(0, 20) + '...',
        length: accessToken.length
      },
      
      apiTests: testResults,
      
      nextSteps: allTestsSuccessful ? [
        '✅ 모든 설정이 완료되었습니다!',
        '🚀 이제 "나은 상품 공급방" 게시물을 수집할 수 있습니다.',
        '📊 오늘 날짜 기준으로 게시물을 수집해보겠습니다.'
      ] : [
        '⚠️ API 테스트가 실패했습니다.',
        '🔍 네이버 개발자센터에서 앱 권한을 다시 확인해주세요.',
        '🔄 필요시 OAuth 인증을 다시 진행해주세요.'
      ],
      
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ 토큰 업데이트 실패:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}