// Band API 토큰 테스트 스크립트
require('dotenv').config({ path: '.env.local' })

async function testBandToken() {
  const accessToken = process.env.BAND_ACCESS_TOKEN
  
  console.log('🔐 테스트할 토큰:', accessToken ? `${accessToken.slice(0, 20)}...` : '없음')
  
  if (!accessToken) {
    console.error('❌ BAND_ACCESS_TOKEN이 설정되지 않았습니다.')
    return
  }

  // 1. 프로필 API로 토큰 테스트
  try {
    console.log('\n📍 1. 프로필 API 테스트...')
    const profileUrl = new URL('https://openapi.band.us/v2/profile')
    profileUrl.searchParams.append('access_token', accessToken)
    
    const profileResponse = await fetch(profileUrl.toString())
    const profileData = await profileResponse.json()
    
    console.log('프로필 API 응답:', profileResponse.status)
    console.log('프로필 데이터:', JSON.stringify(profileData, null, 2))
    
    if (profileResponse.ok && profileData.result_code === 200) {
      console.log('✅ 토큰이 유효합니다!')
    } else {
      console.log('❌ 토큰 문제:', profileData)
    }
  } catch (error) {
    console.error('프로필 API 오류:', error.message)
  }

  // 2. 밴드 목록 API 테스트
  try {
    console.log('\n📍 2. 밴드 목록 API 테스트...')
    const bandsUrl = new URL('https://openapi.band.us/v2/bands')
    bandsUrl.searchParams.append('access_token', accessToken)
    
    const bandsResponse = await fetch(bandsUrl.toString())
    const bandsData = await bandsResponse.json()
    
    console.log('밴드 API 응답:', bandsResponse.status)
    console.log('밴드 데이터:', JSON.stringify(bandsData, null, 2))
    
    if (bandsResponse.ok && bandsData.result_code === 200) {
      console.log('✅ 밴드 목록 조회 성공!')
      console.log('사용 가능한 밴드 수:', bandsData.result_data?.bands?.length || 0)
    } else {
      console.log('❌ 밴드 API 문제:', bandsData)
    }
  } catch (error) {
    console.error('밴드 API 오류:', error.message)
  }

  // 3. 특정 밴드 게시물 테스트 (기존에 사용한 밴드키)
  try {
    console.log('\n📍 3. 특정 밴드 게시물 API 테스트...')
    const bandKey = 'AABCumUKs_sTeqNNdShoOiJN' // 로그에서 확인한 밴드키
    const postsUrl = new URL('https://openapi.band.us/v2/band/posts')
    postsUrl.searchParams.append('access_token', accessToken)
    postsUrl.searchParams.append('band_key', bandKey)
    postsUrl.searchParams.append('locale', 'ko_KR')
    
    const postsResponse = await fetch(postsUrl.toString())
    const postsData = await postsResponse.json()
    
    console.log('게시물 API 응답:', postsResponse.status)
    console.log('게시물 데이터:', JSON.stringify(postsData, null, 2))
    
    if (postsResponse.ok && postsData.result_code === 200) {
      console.log('✅ 게시물 조회 성공!')
      console.log('게시물 수:', postsData.result_data?.items?.length || 0)
    } else {
      console.log('❌ 게시물 API 문제:', postsData)
    }
  } catch (error) {
    console.error('게시물 API 오류:', error.message)
  }
}

testBandToken().catch(console.error)