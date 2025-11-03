import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkCollectedPosts() {
  console.log('🔍 최근 수집된 게시물 확인...\n')

  try {
    // 최근 10개 게시물 조회
    const posts = await prisma.collectedPost.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        extractedPrice: true,
        adjustedPrice: true,
        policyApplied: true,
        priceCalculation: true,
        aiAnalyzed: true,
        wholesaleBand: {
          select: {
            name: true,
            pricingPolicy: true
          }
        },
        createdAt: true
      }
    })

    if (posts.length === 0) {
      console.log('❌ 수집된 게시물이 없습니다.')
      return
    }

    console.log(`📋 최근 수집된 ${posts.length}개 게시물:\n`)

    posts.forEach((post, index) => {
      console.log(`${index + 1}. [${post.wholesaleBand.name}] ${post.title?.slice(0, 40)}...`)
      console.log(`   ID: ${post.id}`)
      console.log(`   AI 분석 완료: ${post.aiAnalyzed ? '✅' : '❌'}`)
      console.log(`   원가 (extractedPrice): ${post.extractedPrice ? post.extractedPrice.toLocaleString() + '원' : '없음'}`)
      console.log(`   판매가 (adjustedPrice): ${post.adjustedPrice ? post.adjustedPrice.toLocaleString() + '원' : '없음'}`)
      console.log(`   정책 적용 여부: ${post.policyApplied ? '✅' : '❌'}`)
      console.log(`   밴드 정책: ${post.wholesaleBand.pricingPolicy || '없음'}`)

      if (post.priceCalculation) {
        try {
          const calc = JSON.parse(post.priceCalculation)
          console.log(`   가격 계산: ${calc.originalPrice}원 → ${calc.adjustedPrice}원 (마진: ${calc.finalMargin}원)`)
        } catch (e) {
          console.log(`   가격 계산: 파싱 오류`)
        }
      }

      console.log(`   수집 시간: ${post.createdAt.toLocaleString('ko-KR')}\n`)
    })

  } catch (error) {
    console.error('❌ 오류 발생:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkCollectedPosts()
