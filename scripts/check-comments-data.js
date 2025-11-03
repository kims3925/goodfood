// 댓글 수집 상태 확인 스크립트
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function checkCommentsData() {
  try {
    console.log('🔍 댓글 수집 상태 확인 중...')
    
    // SD 밴드 (AADDeL6bg9W04y-zRp3RW63-) 정보 확인
    const sdBand = await prisma.wholesaleBand.findFirst({
      where: {
        bandKey: 'AADDeL6bg9W04y-zRp3RW63-'
      }
    })
    
    console.log('📱 SD 밴드 정보:')
    console.log('- ID:', sdBand?.id)
    console.log('- 이름:', sdBand?.name)
    console.log('- 댓글 수집 설정:', sdBand?.collectComments)
    
    if (!sdBand) {
      console.log('❌ SD 밴드를 찾을 수 없습니다.')
      return
    }
    
    // 해당 밴드의 수집된 게시물들 확인
    const posts = await prisma.collectedPost.findMany({
      where: {
        wholesaleBandId: sdBand.id
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    })
    
    console.log(`\n📋 최근 수집된 게시물 ${posts.length}개:`)
    
    for (const post of posts) {
      console.log(`\n게시물 ID: ${post.bandPostId}`)
      console.log(`제목: ${post.title}`)
      console.log(`수집 시간: ${post.createdAt}`)
      
      // 댓글 데이터 파싱
      let comments = []
      try {
        comments = JSON.parse(post.comments || '[]')
      } catch (e) {
        console.log('❌ 댓글 파싱 오류:', e.message)
      }
      
      console.log(`댓글 수: ${comments.length}개`)
      if (comments.length > 0) {
        console.log('댓글 내용:')
        comments.forEach((comment, idx) => {
          console.log(`  ${idx + 1}. ${comment.slice(0, 50)}${comment.length > 50 ? '...' : ''}`)
        })
      } else {
        console.log('💭 댓글 없음')
      }
    }
    
    // 댓글이 있는 게시물 통계
    const postsWithComments = await prisma.collectedPost.count({
      where: {
        wholesaleBandId: sdBand.id,
        comments: {
          not: '[]'
        }
      }
    })
    
    const totalPosts = await prisma.collectedPost.count({
      where: {
        wholesaleBandId: sdBand.id
      }
    })
    
    console.log(`\n📊 통계:`)
    console.log(`- 전체 게시물: ${totalPosts}개`)
    console.log(`- 댓글 있는 게시물: ${postsWithComments}개`)
    console.log(`- 댓글 수집률: ${((postsWithComments / totalPosts) * 100).toFixed(1)}%`)
    
  } catch (error) {
    console.error('❌ 오류:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkCommentsData()