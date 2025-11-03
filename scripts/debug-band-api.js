// Band API 디버깅 스크립트 - 단계별 테스트
require('dotenv').config({ path: '.env.local' })

async function debugBandApi() {
  try {
    const accessToken = process.env.BAND_ACCESS_TOKEN
    if (!accessToken) {
      throw new Error('BAND_ACCESS_TOKEN이 설정되지 않았습니다.')
    }
    
    // 킹도매방 밴드키
    const bandKey = 'AAAtu_SZ1y6xCFvn6LHJhzVm'
    
    console.log('🔍 Band API 디버깅 시작...')
    console.log('📍 밴드키:', bandKey)
    
    // 1. 가장 간단한 텍스트로 테스트
    await testSimpleText(accessToken, bandKey)
    
    // 2. 작은 HTML 테스트
    await testSimpleHtml(accessToken, bandKey)
    
    // 3. 작은 이미지 테스트
    await testSmallImage(accessToken, bandKey)
    
  } catch (error) {
    console.error('디버깅 중 오류:', error)
  }
}

async function testSimpleText(accessToken, bandKey) {
  try {
    console.log('\n📝 1. 간단한 텍스트 테스트...')
    
    const content = 'api: 간단한 테스트 게시물입니다.'
    
    const postUrl = 'https://openapi.band.us/v2.2/band/post/create'
    const postData = new URLSearchParams({
      access_token: accessToken,
      band_key: bandKey,
      content: content
    })
    
    console.log('📤 API 호출 중...')
    console.log('📋 Content:', content)
    
    const response = await fetch(postUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: postData
    })
    
    const responseData = await response.json()
    
    console.log('📊 응답 상태:', response.status)
    console.log('📊 응답 데이터:', JSON.stringify(responseData, null, 2))
    
    if (response.ok && responseData.result_code === 1) {
      console.log('✅ 간단한 텍스트 게시 성공!')
    } else {
      console.log('❌ 게시 실패:', responseData)
    }
    
  } catch (error) {
    console.error('간단한 텍스트 테스트 오류:', error)
  }
}

async function testSimpleHtml(accessToken, bandKey) {
  try {
    console.log('\n🏷️ 2. 간단한 HTML 테스트...')
    
    const content = `api: HTML 테스트
    
<b>굵은 글씨</b>
<i>기울임 글씨</i>
<br/>줄바꿈 테스트`
    
    const postUrl = 'https://openapi.band.us/v2.2/band/post/create'
    const postData = new URLSearchParams({
      access_token: accessToken,
      band_key: bandKey,
      content: content
    })
    
    console.log('📤 API 호출 중...')
    
    const response = await fetch(postUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: postData
    })
    
    const responseData = await response.json()
    
    console.log('📊 응답 상태:', response.status)
    console.log('📊 응답 데이터:', JSON.stringify(responseData, null, 2))
    
    if (response.ok && responseData.result_code === 1) {
      console.log('✅ HTML 테스트 성공!')
    } else {
      console.log('❌ HTML 테스트 실패:', responseData)
    }
    
  } catch (error) {
    console.error('HTML 테스트 오류:', error)
  }
}

async function testSmallImage(accessToken, bandKey) {
  try {
    console.log('\n🖼️ 3. 작은 이미지 테스트...')
    
    // 1x1 픽셀 투명 GIF (매우 작음)
    const smallImage = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    
    const content = `api: 작은 이미지 테스트

<img src="${smallImage}" alt="작은 테스트 이미지" width="10" height="10" />

작은 이미지가 표시되나요?`
    
    const postUrl = 'https://openapi.band.us/v2.2/band/post/create'
    const postData = new URLSearchParams({
      access_token: accessToken,
      band_key: bandKey,
      content: content
    })
    
    console.log('📤 API 호출 중...')
    console.log('📋 Content length:', content.length)
    
    const response = await fetch(postUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: postData
    })
    
    const responseData = await response.json()
    
    console.log('📊 응답 상태:', response.status)
    console.log('📊 응답 데이터:', JSON.stringify(responseData, null, 2))
    
    if (response.ok && responseData.result_code === 1) {
      console.log('✅ 작은 이미지 테스트 성공!')
    } else {
      console.log('❌ 작은 이미지 테스트 실패:', responseData)
    }
    
  } catch (error) {
    console.error('작은 이미지 테스트 오류:', error)
  }
}

// 스크립트 실행
if (require.main === module) {
  debugBandApi()
    .then(() => {
      console.log('\n🏁 Band API 디버깅 완료')
      process.exit(0)
    })
    .catch(error => {
      console.error('\n💥 디버깅 오류:', error)
      process.exit(1)
    })
}

module.exports = { debugBandApi }