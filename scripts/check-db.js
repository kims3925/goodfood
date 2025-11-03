const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function checkDatabase() {
  try {
    console.log('🔍 데이터베이스 상태 확인 중...\n')

    // 1. 사용자 데이터 확인
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        bandClientId: true,
        bandClientSecret: true,
        bandAccessToken: true,
        createdAt: true
      }
    })
    console.log('👥 사용자 데이터:')
    console.log(`   총 ${users.length}명의 사용자`)
    if (users.length > 0) {
      users.forEach(user => {
        console.log(`   - ${user.email} (${user.name || 'No name'})`)
        console.log(`     Band API: ${user.bandAccessToken ? '설정됨' : '미설정'}`)
        console.log(`     가입일: ${user.createdAt}`)
      })
    }
    console.log('')

    // 2. 도매 밴드 데이터 확인
    const wholesaleBands = await prisma.wholesaleBand.findMany({
      include: {
        user: {
          select: {
            email: true
          }
        }
      }
    })
    console.log('🏢 도매 밴드 데이터:')
    console.log(`   총 ${wholesaleBands.length}개의 도매 밴드`)
    if (wholesaleBands.length > 0) {
      wholesaleBands.forEach(band => {
        console.log(`   - ${band.name} (${band.bandKey})`)
        console.log(`     소유자: ${band.user.email}`)
        console.log(`     댓글 수집: ${band.collectComments ? '활성' : '비활성'}`)
        console.log(`     등록일: ${band.createdAt}`)
      })
    }
    console.log('')

    // 3. 수집된 게시물 데이터 확인
    const collectedPosts = await prisma.collectedPost.findMany({
      select: {
        id: true,
        title: true,
        status: true,
        aiAnalyzed: true,
        isAvailable: true,
        hasDeadline: true,
        createdAt: true,
        wholesaleBand: {
          select: {
            name: true
          }
        }
      },
      take: 10 // 최근 10개만
    })
    console.log('📄 수집된 게시물 데이터:')
    console.log(`   총 ${collectedPosts.length}개의 게시물 (최근 10개만 표시)`)
    if (collectedPosts.length > 0) {
      collectedPosts.forEach(post => {
        console.log(`   - ${post.title.substring(0, 50)}...`)
        console.log(`     밴드: ${post.wholesaleBand.name}`)
        console.log(`     상태: ${post.status}, AI분석: ${post.aiAnalyzed ? '완료' : '미완료'}`)
        console.log(`     이용가능: ${post.isAvailable}, 마감시간: ${post.hasDeadline ? '있음' : '없음'}`)
        console.log(`     수집일: ${post.createdAt}`)
      })
    }
    console.log('')

    // 4. 상품 데이터 확인
    const products = await prisma.product.findMany({
      select: {
        id: true,
        title: true,
        status: true,
        originalPrice: true,
        salePrice: true,
        createdAt: true
      }
    })
    console.log('🛍️ 상품 데이터:')
    console.log(`   총 ${products.length}개의 상품`)
    if (products.length > 0) {
      products.forEach(product => {
        console.log(`   - ${product.title}`)
        console.log(`     원가: ${product.originalPrice}원, 판매가: ${product.salePrice}원`)
        console.log(`     상태: ${product.status}`)
        console.log(`     생성일: ${product.createdAt}`)
      })
    }
    console.log('')

    console.log('✅ 데이터베이스 확인 완료')

  } catch (error) {
    console.error('❌ 데이터베이스 확인 중 오류:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkDatabase()