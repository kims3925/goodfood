// Update existing CollectedPost records using raw SQL
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function updateCategories() {
  try {
    console.log('🔄 기존 수집된 게시물의 분류를 업데이트하는 중...')
    
    // Raw SQL을 사용하여 직접 업데이트
    const result = await prisma.$executeRaw`
      UPDATE CollectedPost 
      SET productCategory = 'OTHER' 
      WHERE productCategory IS NULL 
         OR productCategory = '' 
         OR productCategory NOT IN ('SEAFOOD', 'MEAT', 'AGRICULTURE', 'PROCESSED', 'OTHER')
    `

    console.log(`✅ ${result}개의 게시물이 기타(OTHER) 분류로 업데이트되었습니다.`)
    
    // 업데이트 결과 확인
    const categoryStats = await prisma.$queryRaw`
      SELECT productCategory, COUNT(*) as count 
      FROM CollectedPost 
      GROUP BY productCategory
    `
    
    console.log('\n📊 현재 분류별 통계:')
    categoryStats.forEach(stat => {
      const categoryName = {
        'SEAFOOD': '수산',
        'MEAT': '축산', 
        'AGRICULTURE': '농산',
        'PROCESSED': '가공품',
        'OTHER': '기타'
      }[stat.productCategory] || stat.productCategory || '미분류'
      
      console.log(`  ${categoryName}: ${stat.count}개`)
    })

  } catch (error) {
    console.error('❌ 업데이트 오류:', error)
  } finally {
    await prisma.$disconnect()
  }
}

updateCategories()