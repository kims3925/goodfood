/**
 * 가격 정책 적용 검증 스크립트
 * 도매가와 소매가가 동일한 상품(variants)을 찾아 출력합니다.
 *
 * 사용법:
 * cd sourcing-app
 * npx tsx scripts/check-price-policy.ts
 */

import prisma from '@bandauto/db'

interface UnpricedVariant {
  variantId: number
  productId: number
  productName: string
  optionSummary: string | null
  wholesalePrice: number | null
  price: number
  createdAt: Date
}

interface ProductWithIssues {
  productId: number
  productName: string
  channelName: string | null
  createdAt: Date
  variants: {
    id: number
    optionSummary: string | null
    wholesalePrice: number | null
    price: number
  }[]
}

async function checkPricePolicy() {
  console.log('🔍 가격 정책 적용 검증 시작...\n')

  // 1. 도매가와 소매가가 같은 variants 조회
  // wholesalePrice가 null이거나, price와 같은 경우
  const unpricedVariants = await prisma.$queryRaw<UnpricedVariant[]>`
    SELECT
      pv.id as "variantId",
      pv.product_id as "productId",
      p.name as "productName",
      pv.option_summary as "optionSummary",
      pv.wholesale_price as "wholesalePrice",
      pv.price,
      p.created_at as "createdAt"
    FROM product_variant pv
    JOIN product p ON p.id = pv.product_id
    WHERE pv.wholesale_price IS NOT NULL
      AND pv.wholesale_price = pv.price
    ORDER BY p.created_at DESC
  `

  console.log(`📊 총 ${unpricedVariants.length}개의 미적용 variant 발견\n`)

  if (unpricedVariants.length === 0) {
    console.log('✅ 모든 상품에 가격 정책이 적용되어 있습니다!')
    await prisma.$disconnect()
    return
  }

  // 2. 상품별로 그룹화
  const productMap = new Map<number, ProductWithIssues>()

  for (const v of unpricedVariants) {
    if (!productMap.has(v.productId)) {
      // 채널 정보 조회
      const product = await prisma.product.findUnique({
        where: { id: v.productId },
        include: { channel: { select: { name: true } } }
      })

      productMap.set(v.productId, {
        productId: v.productId,
        productName: v.productName,
        channelName: product?.channel?.name || null,
        createdAt: v.createdAt,
        variants: []
      })
    }

    productMap.get(v.productId)!.variants.push({
      id: v.variantId,
      optionSummary: v.optionSummary,
      wholesalePrice: v.wholesalePrice,
      price: v.price
    })
  }

  // 3. 결과 출력
  console.log('=' .repeat(80))
  console.log('📋 가격 정책 미적용 상품 목록')
  console.log('=' .repeat(80))

  const products = Array.from(productMap.values())
  console.log(`\n총 ${products.length}개 상품에서 문제 발견:\n`)

  for (const product of products) {
    console.log(`\n🏷️  [${product.productId}] ${product.productName}`)
    console.log(`   채널: ${product.channelName || '없음'}`)
    console.log(`   생성일: ${product.createdAt.toLocaleDateString('ko-KR')}`)
    console.log(`   문제 옵션:`)

    for (const v of product.variants) {
      console.log(`     - [${v.id}] ${v.optionSummary || '기본'}`)
      console.log(`       도매가: ${v.wholesalePrice?.toLocaleString()}원 = 소매가: ${v.price.toLocaleString()}원 ⚠️`)
    }
  }

  // 4. 요약 통계
  console.log('\n' + '=' .repeat(80))
  console.log('📈 요약')
  console.log('=' .repeat(80))
  console.log(`• 문제 상품 수: ${products.length}개`)
  console.log(`• 문제 variant 수: ${unpricedVariants.length}개`)

  // 날짜별 분포
  const dateMap = new Map<string, number>()
  for (const product of products) {
    const dateKey = product.createdAt.toISOString().split('T')[0]
    dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + 1)
  }

  console.log('\n📅 날짜별 분포:')
  const sortedDates = Array.from(dateMap.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  for (const [date, count] of sortedDates.slice(0, 10)) {
    console.log(`   ${date}: ${count}개`)
  }

  // 5. 해결 방법 안내
  console.log('\n' + '=' .repeat(80))
  console.log('💡 해결 방법')
  console.log('=' .repeat(80))
  console.log(`
1. 가격 정책 확인
   - 설정 > 가격 정책에서 정책 내용이 명확한지 확인
   - 예: "도매가의 130%를 소매가로 설정" 같은 명확한 규칙

2. 상품 재변환
   - 수집상품 관리에서 해당 상품 선택
   - 가격 정책을 선택하고 다시 변환

3. 수동 수정
   - 상품 편집에서 직접 소매가 수정
`)

  await prisma.$disconnect()
}

// 메인 실행
checkPricePolicy().catch(console.error)
