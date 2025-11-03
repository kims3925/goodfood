// 최종 옵션별 상품 생성 테스트
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testFinalOptions() {
  try {
    console.log('=== 최종 옵션별 상품 테스트 ===\n')

    // 1. 기존 상품 정리
    console.log('🧹 기존 테스트 상품 정리...')
    await prisma.product.deleteMany({
      where: {
        title: { contains: '가을 신비복숭아' }
      }
    })
    console.log('✅ 정리 완료\n')

    // 2. 다중 옵션이 있는 최근 게시물 확인
    console.log('🔍 다중 옵션 게시물 확인...')
    const multiOptionPost = await prisma.collectedPost.findFirst({
      where: {
        status: 'PENDING',
        priceOptions: { not: '[]' }
      },
      include: {
        wholesaleBand: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    if (multiOptionPost) {
      try {
        const options = JSON.parse(multiOptionPost.priceOptions)
        console.log(`📋 게시물: ${multiOptionPost.title}`)
        console.log(`📊 옵션 수: ${options.length}개`)
        console.log(`🏢 소싱처: ${multiOptionPost.wholesaleBand.name}`)
        console.log(`📅 정책: ${multiOptionPost.wholesaleBand.pricingPolicy}`)
        
        if (options.length > 1) {
          console.log('\n💰 옵션별 가격 미리보기:')
          options.forEach((option, index) => {
            console.log(`  옵션 ${index + 1}: ${option.option || option.name} - ${option.price?.toLocaleString()}원`)
          })
        }
        console.log()
      } catch (error) {
        console.log('❌ 옵션 파싱 실패')
      }
    } else {
      console.log('❌ 다중 옵션 게시물을 찾을 수 없습니다.')
    }

    console.log('=== 테스트 준비 완료 ===')
    console.log('\n📋 다음 단계:')
    console.log('1. http://localhost:3000/dashboard/wholesale/collect 접속')
    console.log('2. 다중 옵션이 있는 상품 (예: 가을 신비복숭아) 소싱 확정')
    console.log('3. http://localhost:3000/dashboard/products 에서 확인:')
    console.log('   ✅ 하나의 상품으로 생성됨')
    console.log('   ✅ 테이블에서 원가/판매가 컬럼 제거됨') 
    console.log('   ✅ 상세보기에서 "추출된 옵션" 섹션에 옵션별 가격 표시됨')
    console.log('\n기대 결과:')
    console.log('- 옵션 1: 가을 신비복숭아 3kg (21-27미) - 원가 22,000원 → 판매가 27,000원')
    console.log('- 옵션 2: 가을 신비복숭아 4kg (28-36미) - 원가 28,000원 → 판매가 33,000원')
    console.log('- 옵션 3: 가을 신비복숭아 5kg (35-45미) - 원가 34,000원 → 판매가 40,000원')

  } catch (error) {
    console.error('테스트 실패:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testFinalOptions()