/**
 * 가설 3: 배치 처리 테스트
 * 
 * 현재: 개별 게시물마다 AI 호출
 * 개선: 여러 게시물을 한 번의 AI 요청으로 배치 분석
 */
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

// 배치 크기 설정
const BATCH_SIZE = 5

// 가상의 배치 AI 분석 함수
async function analyzeBatchProducts(posts, pricingPolicy) {
  const startTime = Date.now()
  console.log(`🤖 배치 AI 분석 시작: ${posts.length}개 게시물`)
  
  // 배치 처리를 위한 프롬프트 구성
  const batchPrompt = `
다음 ${posts.length}개의 상품을 한 번에 분석해주세요:

${posts.map((post, index) => `
=== 상품 ${index + 1} ===
제목: ${post.content.slice(0, 50)}...
내용: ${post.content}
댓글: ${JSON.parse(post.comments || '[]').join(', ')}
`).join('\n')}

가격 정책: ${pricingPolicy}

각 상품에 대해 다음 형식으로 분석 결과를 JSON 배열로 반환해주세요:
[
  {
    "index": 0,
    "hookingTitle": "20자 이내 후킹 제목",
    "hookingContent": "매력적인 판매 문구",
    "productCategory": "SEAFOOD|MEAT|AGRICULTURE|PROCESSED|OTHER",
    "priceInfo": {"originalPrice": 10000, "salePrice": 8000},
    "shippingFee": 3000,
    "hasDeadline": true,
    "deadlineInfo": "마감 정보"
  }
]`
  
  // 실제 배치 AI 분석 시간 시뮬레이션
  // 개별 분석보다 약간 더 오래 걸리지만 전체적으로는 빠름
  const processingTime = Math.random() * 3000 + 2000 + (posts.length * 200)
  await new Promise(resolve => setTimeout(resolve, processingTime))
  
  // 가상의 분석 결과 생성
  const results = posts.map((post, index) => ({
    index,
    hookingTitle: `${post.content.slice(0, 15)}... 특가!`,
    hookingContent: `매력적인 상품 ${index + 1} - 지금 바로 주문하세요!`,
    productCategory: ['SEAFOOD', 'MEAT', 'AGRICULTURE', 'PROCESSED', 'OTHER'][index % 5],
    priceInfo: { 
      originalPrice: 10000 + (index * 1000), 
      salePrice: 8000 + (index * 800) 
    },
    shippingFee: 3000,
    hasDeadline: Math.random() > 0.7,
    deadlineInfo: Math.random() > 0.7 ? '오늘 마감!' : null,
    batchProcessed: true,
    originalPostId: post.id
  }))
  
  const endTime = Date.now()
  const totalProcessingTime = endTime - startTime
  
  console.log(`✅ 배치 AI 분석 완료: ${posts.length}개 (${totalProcessingTime}ms)`)
  console.log(`   - 평균 처리 시간: ${totalProcessingTime / posts.length}ms/개`)
  
  return {
    results,
    batchSize: posts.length,
    processingTime: totalProcessingTime,
    averageTime: totalProcessingTime / posts.length,
    tokensUsed: posts.reduce((sum, post) => sum + post.content.length, 0) // 토큰 사용량 추정
  }
}

// 배치 방식 상품 수집 함수
async function collectProductsWithBatch(bandId, dateRange) {
  const startTime = Date.now()
  console.log('🚀 배치 처리 방식 상품 수집 시작')
  
  try {
    // 1단계: 상품 수집
    console.log('📦 1단계: 상품 수집 중...')
    const collectionStartTime = Date.now()
    
    const posts = await collectPostsOnly(bandId, dateRange)
    
    const collectionTime = Date.now() - collectionStartTime
    console.log(`📦 상품 수집 완료: ${posts.length}개 (${collectionTime}ms)`)
    
    // 2단계: 배치 AI 분석
    console.log('🤖 2단계: 배치 AI 분석 시작...')
    const analysisStartTime = Date.now()
    
    // 게시물을 배치 크기로 분할
    const batches = []
    for (let i = 0; i < posts.length; i += BATCH_SIZE) {
      batches.push(posts.slice(i, i + BATCH_SIZE))
    }
    
    console.log(`📦 ${posts.length}개 게시물을 ${batches.length}개 배치로 분할 (배치 크기: ${BATCH_SIZE})`)
    
    const allBatchResults = []
    let totalTokensUsed = 0
    
    // 각 배치를 순차적으로 처리 (너무 많은 동시 요청 방지)
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex]
      console.log(`🚀 배치 ${batchIndex + 1}/${batches.length} 처리 중... (${batch.length}개 게시물)`)
      
      const batchResult = await analyzeBatchProducts(batch, '마진율 50% 적용')
      allBatchResults.push(batchResult)
      totalTokensUsed += batchResult.tokensUsed
      
      // 배치 간 간격 (API 제한 방지)
      if (batchIndex < batches.length - 1) {
        console.log('⏳ 배치 간 대기 중... (1초)')
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    
    // 모든 분석 결과 수집
    const allResults = allBatchResults.flatMap(batch => batch.results)
    
    const analysisTime = Date.now() - analysisStartTime
    
    // 3단계: 데이터베이스 업데이트
    console.log('💾 3단계: 데이터베이스 일괄 업데이트 중...')
    const updateStartTime = Date.now()
    
    // DB 업데이트 시뮬레이션 (실제로는 배치 업데이트 사용)
    for (const result of allResults) {
      // 실제 환경에서는 prisma.collectedPost.update 또는 배치 업데이트
      await new Promise(resolve => setTimeout(resolve, 50)) // DB 업데이트 시간 시뮬레이션
    }
    
    const updateTime = Date.now() - updateStartTime
    const totalTime = Date.now() - startTime
    
    console.log(`✅ 배치 처리 완료!`)
    console.log(`📊 성능 결과:`)
    console.log(`   - 상품 수집: ${collectionTime}ms`)
    console.log(`   - AI 분석 (배치): ${analysisTime}ms`)
    console.log(`   - DB 업데이트: ${updateTime}ms`)
    console.log(`   - 총 시간: ${totalTime}ms`)
    console.log(`   - 처리된 상품: ${allResults.length}개`)
    console.log(`   - 배치 수: ${batches.length}개`)
    console.log(`   - 평균 배치 크기: ${allResults.length / batches.length}개`)
    console.log(`   - 토큰 사용량: ${totalTokensUsed.toLocaleString()}자`)
    
    // 배치별 성능 통계
    const batchStats = allBatchResults.map((batch, index) => ({
      batchIndex: index + 1,
      size: batch.batchSize,
      processingTime: batch.processingTime,
      averageTime: batch.averageTime,
      tokensUsed: batch.tokensUsed
    }))
    
    return {
      method: '배치 처리',
      totalTime,
      collectionTime,
      analysisTime,
      updateTime,
      productCount: allResults.length,
      batchCount: batches.length,
      averageBatchSize: allResults.length / batches.length,
      totalTokensUsed,
      averageProcessingTime: analysisTime / batches.length, // 배치당 평균 시간
      averageItemTime: analysisTime / allResults.length, // 아이템당 평균 시간
      throughput: allResults.length / (totalTime / 1000),
      batchStats,
      costEfficiency: {
        tokensPerItem: totalTokensUsed / allResults.length,
        timePerItem: analysisTime / allResults.length,
        itemsPerSecond: allResults.length / (analysisTime / 1000)
      }
    }
    
  } catch (error) {
    console.error('❌ 배치 처리 실패:', error)
    throw error
  }
}

// 개별 vs 배치 처리 비교 함수
async function compareIndividualVsBatch(posts) {
  console.log('\n🔄 개별 vs 배치 처리 비교 테스트\n')
  
  // 개별 처리 테스트
  console.log('1️⃣ 개별 AI 분석 테스트')
  const individualStartTime = Date.now()
  
  const individualResults = []
  for (let i = 0; i < posts.length; i++) {
    const startTime = Date.now()
    
    // 개별 분석 시뮬레이션 (실제 AI 호출과 유사)
    const processingTime = Math.random() * 2000 + 1000
    await new Promise(resolve => setTimeout(resolve, processingTime))
    
    const result = {
      index: i,
      hookingTitle: `${posts[i].content.slice(0, 15)}... 특가!`,
      processingTime: Date.now() - startTime,
      tokensUsed: posts[i].content.length
    }
    
    individualResults.push(result)
    
    // API 제한 방지를 위한 대기
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  const individualTime = Date.now() - individualStartTime
  const individualTokens = individualResults.reduce((sum, r) => sum + r.tokensUsed, 0)
  
  // 배치 처리 테스트
  console.log('\n2️⃣ 배치 AI 분석 테스트')
  const batchStartTime = Date.now()
  
  const batches = []
  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    batches.push(posts.slice(i, i + BATCH_SIZE))
  }
  
  let batchTokens = 0
  const batchResults = []
  
  for (const batch of batches) {
    const batchResult = await analyzeBatchProducts(batch, '마진율 50% 적용')
    batchResults.push(...batchResult.results)
    batchTokens += batchResult.tokensUsed
    
    // 배치 간 대기
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  const batchTime = Date.now() - batchStartTime
  
  // 결과 비교
  console.log('\n📊 비교 결과:')
  console.log(`개별 처리: ${individualTime}ms (평균: ${individualTime / posts.length}ms)`)
  console.log(`배치 처리: ${batchTime}ms (평균: ${batchTime / posts.length}ms)`)
  console.log(`성능 개선: ${((individualTime - batchTime) / individualTime * 100).toFixed(1)}% 빨라짐`)
  console.log(`토큰 효율성: 개별 ${individualTokens} vs 배치 ${batchTokens} (${((individualTokens - batchTokens) / individualTokens * 100).toFixed(1)}% 절약)`)
  
  return {
    individual: {
      totalTime: individualTime,
      averageTime: individualTime / posts.length,
      tokensUsed: individualTokens,
      throughput: posts.length / (individualTime / 1000)
    },
    batch: {
      totalTime: batchTime,
      averageTime: batchTime / posts.length,
      tokensUsed: batchTokens,
      batchCount: batches.length,
      throughput: posts.length / (batchTime / 1000)
    },
    improvement: {
      timeReduction: individualTime - batchTime,
      percentageImprovement: ((individualTime - batchTime) / individualTime * 100).toFixed(1),
      tokenSaving: ((individualTokens - batchTokens) / individualTokens * 100).toFixed(1),
      costEfficiency: batchTokens / individualTokens
    }
  }
}

// AI 분석 없이 게시물만 수집하는 함수 (재사용)
async function collectPostsOnly(bandId, dateRange) {
  console.log('📝 게시물 수집 중 (AI 분석 제외)...')
  
  const mockPosts = []
  const postCount = 15 // 배치 테스트용 게시물 수 (3배치 * 5개)
  
  for (let i = 0; i < postCount; i++) {
    const post = {
      id: `test-post-${i}`,
      content: `테스트 상품 ${i} - 신선한 ${['해산물', '축산물', '농산물', '가공식품', '기타상품'][i % 5]}을 도매가격으로 판매합니다. 품질보장, 당일발송, 전국배송 가능합니다. 대량주문 환영합니다.`,
      comments: JSON.stringify([
        "좋은 상품이네요", 
        "가격 문의드립니다", 
        "배송 언제 되나요?",
        "대량 주문 가능한가요?",
        "품질은 어떤가요?"
      ]),
      pricingPolicy: '마진율 50% 적용, 배송비 별도, 대량주문 할인',
      createdAt: new Date()
    }
    mockPosts.push(post)
  }
  
  return mockPosts
}

module.exports = {
  collectProductsWithBatch,
  compareIndividualVsBatch,
  testBatchProcessing: async () => {
    console.log('\n🧪 가설 3: 배치 처리 테스트 시작\n')
    
    try {
      const result = await collectProductsWithBatch('test-band', {
        startDate: '2025-09-06',
        endDate: '2025-09-06'
      })
      
      // 개별 vs 배치 비교도 수행
      const posts = await collectPostsOnly('test-band', {})
      const comparison = await compareIndividualVsBatch(posts)
      
      return {
        batchResult: result,
        comparison: comparison
      }
    } catch (error) {
      console.error('테스트 실패:', error)
      return null
    }
  }
}

// 직접 실행 시 테스트 수행
if (require.main === module) {
  const { testBatchProcessing } = require(__filename)
  testBatchProcessing()
    .then(result => {
      if (result) {
        console.log('\n📊 배치 처리 테스트 결과:', result)
      }
      process.exit(0)
    })
    .catch(error => {
      console.error('테스트 오류:', error)
      process.exit(1)
    })
}