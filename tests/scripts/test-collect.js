const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testCollectAPI() {
  try {
    // 사용자 확인
    const users = await prisma.user.findMany()
    console.log('Users:', users.length)
    
    // 도매 밴드 확인
    const bands = await prisma.wholesaleBand.findMany({
      select: {
        id: true,
        name: true,
        bandKey: true,
        userId: true
      }
    })
    console.log('\nWholesale bands:')
    bands.forEach((band, index) => {
      console.log(`${index + 1}. ${band.name} (${band.bandKey}) - User: ${band.userId}`)
    })
    
    if (bands.length > 0) {
      // 첫 번째 밴드로 수집 API 테스트
      const testBand = bands[0]
      console.log(`\nTesting collection with band: ${testBand.name}`)
      
      // 실제 API 호출 대신 수집 과정을 시뮬레이션
      console.log('Band API 토큰 확인 필요:', process.env.BAND_ACCESS_TOKEN ? '토큰 존재' : '토큰 없음')
    }
    
  } catch (error) {
    console.error('Test error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testCollectAPI()