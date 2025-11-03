import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function clearOldPosts() {
  console.log('🗑️  기존 수집 게시물 삭제 시작...\n')

  try {
    // 모든 수집된 게시물 삭제
    const result = await prisma.collectedPost.deleteMany({})

    console.log(`✅ ${result.count}개의 기존 게시물을 삭제했습니다.\n`)
    console.log('💡 이제 http://localhost:3000/automation/bands 페이지에서')
    console.log('   새로운 게시물을 수집하면 최신 코드가 적용됩니다!')

  } catch (error) {
    console.error('❌ 오류 발생:', error)
  } finally {
    await prisma.$disconnect()
  }
}

clearOldPosts()
