// Band API 이미지 업로드 개선 테스트 스크립트
require('dotenv').config({ path: '.env.local' })
const fs = require('fs')
const path = require('path')

// 실제 이미지 파일을 Base64로 변환하는 함수
function createTestImage() {
  // 간단한 PNG 이미지를 생성 (1x1 빨간 픽셀)
  const pngData = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
    0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0x0F, 0x00, 0x00,
    0x01, 0x00, 0x01, 0x5C, 0xCF, 0x8E, 0xDE, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
  ])
  
  return pngData.toString('base64')
}

async function testBandImageUpload() {
  try {
    console.log('🖼️ Band API 이미지 업로드 테스트 시작...')
    
    const accessToken = process.env.BAND_ACCESS_TOKEN
    if (!accessToken) {
      throw new Error('BAND_ACCESS_TOKEN이 설정되지 않았습니다.')
    }
    
    const bandKey = 'AAAtu_SZ1y6xCFvn6LHJhzVm' // 킹도매방
    
    // 1. 이미지 업로드 시도 (만약 별도 API가 있다면)
    console.log('📤 1단계: 이미지 업로드 시도...')
    const imageUploadResult = await attemptImageUpload(accessToken, bandKey)
    
    if (imageUploadResult.success) {
      console.log('✅ 이미지 업로드 성공:', imageUploadResult.imageUrl)
      
      // 2. 업로드된 이미지로 게시물 작성
      await createPostWithUploadedImage(accessToken, bandKey, imageUploadResult.imageUrl)
    } else {
      console.log('⚠️ 직접 이미지 업로드 불가능, 대안 방법 시도...')
      
      // 3. 대안: 외부 이미지 URL 사용
      await createPostWithExternalImage(accessToken, bandKey)
    }
    
  } catch (error) {
    console.error('❌ 이미지 업로드 테스트 오류:', error)
  }
}

async function attemptImageUpload(accessToken, bandKey) {
  try {
    // Band API에서 가능한 이미지 업로드 엔드포인트들 시도
    const uploadEndpoints = [
      'https://openapi.band.us/v2.2/band/photo/upload',
      'https://openapi.band.us/v2/band/photo/upload', 
      'https://openapi.band.us/v2.2/photo/upload',
      'https://openapi.band.us/v2/photo/upload',
      'https://openapi.band.us/v2.2/band/image/upload',
      'https://openapi.band.us/v2/band/image/upload'
    ]
    
    const testImageBase64 = createTestImage()
    
    for (const endpoint of uploadEndpoints) {
      console.log(`🔍 엔드포인트 테스트: ${endpoint}`)
      
      try {
        // FormData 방식 시도
        const formData = new FormData()
        formData.append('access_token', accessToken)
        formData.append('band_key', bandKey)
        
        // Base64를 Blob으로 변환
        const imageBlob = new Blob([Buffer.from(testImageBase64, 'base64')], { 
          type: 'image/png' 
        })
        formData.append('photo', imageBlob, 'test-image.png')
        
        const response = await fetch(endpoint, {
          method: 'POST',
          body: formData
        })
        
        const result = await response.json()
        console.log(`📊 응답:`, result)
        
        if (response.ok && result.result_code === 1) {
          return {
            success: true,
            imageUrl: result.result_data?.photo_url || result.result_data?.url,
            photoKey: result.result_data?.photo_key
          }
        }
        
      } catch (error) {
        console.log(`❌ ${endpoint} 실패:`, error.message)
      }
      
      // URL-encoded 방식도 시도
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            access_token: accessToken,
            band_key: bandKey,
            photo_data: `data:image/png;base64,${testImageBase64}`,
            photo_name: 'test-image.png'
          })
        })
        
        const result = await response.json()
        console.log(`📊 URL-encoded 응답:`, result)
        
        if (response.ok && result.result_code === 1) {
          return {
            success: true,
            imageUrl: result.result_data?.photo_url || result.result_data?.url,
            photoKey: result.result_data?.photo_key
          }
        }
        
      } catch (error) {
        console.log(`❌ URL-encoded ${endpoint} 실패:`, error.message)
      }
    }
    
    return { success: false }
    
  } catch (error) {
    console.error('이미지 업로드 시도 오류:', error)
    return { success: false }
  }
}

async function createPostWithUploadedImage(accessToken, bandKey, imageUrl) {
  try {
    console.log('📝 업로드된 이미지로 게시물 작성...')
    
    const content = `api: 업로드된 이미지 테스트

이미지가 정상적으로 업로드되어 게시물에 포함되었습니다.

이미지 URL: ${imageUrl}

테스트 시간: ${new Date().toLocaleString('ko-KR')}`

    const postUrl = 'https://openapi.band.us/v2.2/band/post/create'
    const postData = new URLSearchParams({
      access_token: accessToken,
      band_key: bandKey,
      content: content
    })
    
    const response = await fetch(postUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: postData
    })
    
    const responseData = await response.json()
    
    if (response.ok && responseData.result_code === 1) {
      console.log('✅ 업로드된 이미지 게시물 작성 성공!')
      console.log('📝 게시물 ID:', responseData.result_data?.post_key)
    } else {
      console.log('❌ 게시물 작성 실패:', responseData)
    }
    
  } catch (error) {
    console.error('게시물 작성 오류:', error)
  }
}

async function createPostWithExternalImage(accessToken, bandKey) {
  try {
    console.log('🌐 외부 이미지 URL 사용 테스트...')
    
    // 공개 이미지 URL들 (테스트용)
    const testImageUrls = [
      'https://via.placeholder.com/300x200/ff0000/ffffff?text=API+TEST',
      'https://picsum.photos/300/200',
      'https://httpcat.com/200'
    ]
    
    for (const imageUrl of testImageUrls) {
      console.log(`🖼️ 외부 이미지 테스트: ${imageUrl}`)
      
      const content = `api: 외부 이미지 URL 테스트

외부 이미지 URL을 사용한 게시물 테스트입니다.

<img src="${imageUrl}" alt="테스트 이미지" style="max-width: 100%; height: auto;" />

또는 마크다운 형식:
![테스트 이미지](${imageUrl})

또는 URL 직접 링크:
${imageUrl}

테스트 시간: ${new Date().toLocaleString('ko-KR')}`

      const postUrl = 'https://openapi.band.us/v2.2/band/post/create'
      const postData = new URLSearchParams({
        access_token: accessToken,
        band_key: bandKey,
        content: content
      })
      
      const response = await fetch(postUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: postData
      })
      
      const responseData = await response.json()
      
      if (response.ok && responseData.result_code === 1) {
        console.log('✅ 외부 이미지 게시물 작성 성공!')
        console.log('📝 게시물 ID:', responseData.result_data?.post_key)
      } else if (responseData.result_code === 1003) {
        console.log('⏰ 쿨다운 시간, 15초 대기...')
        await new Promise(resolve => setTimeout(resolve, 15000))
      } else {
        console.log('❌ 게시물 작성 실패:', responseData)
      }
      
      // 각 테스트 사이에 대기
      await new Promise(resolve => setTimeout(resolve, 3000))
    }
    
  } catch (error) {
    console.error('외부 이미지 테스트 오류:', error)
  }
}

// 스크립트 실행
if (require.main === module) {
  testBandImageUpload()
    .then(() => {
      console.log('\n🏁 Band API 이미지 업로드 테스트 완료')
      process.exit(0)
    })
    .catch(error => {
      console.error('\n💥 테스트 실행 오류:', error)
      process.exit(1)
    })
}

module.exports = { testBandImageUpload }