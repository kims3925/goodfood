// 단일 게시물 댓글 수집 테스트
require('dotenv').config({ path: '.env.local' })
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function testSinglePostCollect() {
  try {
    // 테스트할 게시물 정보
    const testPostKey = 'AACWbS8USrT31QoyBJyY59XD'
    const bandKey = 'AADDeL6bg9W04y-zRp3RW63-'
    const accessToken = process.env.BAND_ACCESS_TOKEN
    
    if (!accessToken) {
      console.log('❌ BAND_ACCESS_TOKEN이 설정되지 않았습니다.')
      return
    }
    
    console.log('🧪 단일 게시물 댓글 수집 테스트 시작')
    console.log('- Post Key:', testPostKey)
    console.log('- Band Key:', bandKey)
    
    // 댓글 수집 함수 (수정된 버전)
    const fetchComments = async (postKey) => {
      try {
        const commentsUrl = new URL('https://openapi.band.us/v2/band/post/comments')
        commentsUrl.searchParams.append('access_token', accessToken)
        commentsUrl.searchParams.append('band_key', bandKey)
        commentsUrl.searchParams.append('post_key', postKey)
        commentsUrl.searchParams.append('locale', 'ko_KR')

        const commentsResponse = await fetch(commentsUrl.toString())
        if (!commentsResponse.ok) {
          console.warn(`댓글 수집 실패 for post ${postKey}:`, commentsResponse.status)
          return []
        }

        const commentsData = await commentsResponse.json()
        if (commentsData.result_data?.items) {
          // 수정된 부분: content 필드를 먼저 체크
          return commentsData.result_data.items.map((comment) => comment.content || comment.body || '')
        }
        
        return []
      } catch (error) {
        console.error(`댓글 수집 오류 for post ${postKey}:`, error)
        return []
      }
    }
    
    // 댓글 수집 테스트
    const comments = await fetchComments(testPostKey)
    
    console.log('💬 수집된 댓글:')
    console.log('- 댓글 개수:', comments.length)
    comments.forEach((comment, idx) => {
      console.log(`  ${idx + 1}. ${comment}`)
    })
    
    // 기존 데이터베이스의 해당 게시물 확인
    const existingPost = await prisma.collectedPost.findFirst({
      where: {
        bandPostId: testPostKey
      }
    })
    
    if (existingPost) {
      console.log('\n📋 기존 데이터베이스 댓글:')
      try {
        const dbComments = JSON.parse(existingPost.comments || '[]')
        console.log('- DB 댓글 개수:', dbComments.length)
        dbComments.forEach((comment, idx) => {
          console.log(`  ${idx + 1}. ${comment}`)
        })
      } catch (e) {
        console.log('❌ DB 댓글 파싱 오류:', e.message)
      }
    }
    
    console.log('\n✅ 테스트 완료!')
    
  } catch (error) {
    console.error('❌ 테스트 오류:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testSinglePostCollect()