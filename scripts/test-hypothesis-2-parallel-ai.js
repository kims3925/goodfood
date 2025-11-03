/**
 * 가설 2: 병렬 AI 처리 테스트
 * 
 * 현재: 순차적 AI 분석 (await 하나씩)
 * 개선: Promise.all을 사용한 동시 AI 분석
 */
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

// 동시 처리할 최대 AI 요청 수
const MAX_CONCURRENT_ANALYSIS = 5

// 가상의 AI 분석 함수 (실제 Gemini 호출 시뮬레이션)
async function analyzeProductParallel(content, comments, pricingPolicy, index) {
  const startTime = Date.now()
  console.log(`🤖 AI 분석 시작 [${index}]: ${content.slice(0, 20)}...`)
  
  // 실제 AI 분석 시간을 시뮬레이션 (1-3초 랜덤)
  const processingTime = Math.random() * 2000 + 1000
  await new Promise(resolve => setTimeout(resolve, processingTime))
  
  const endTime = Date.now()
  console.log(`✅ AI 분석 완료 [${index}]: ${endTime - startTime}ms`)
  
  return {
    index,
    processingTime: endTime - startTime,
    hookingTitle: `${content.slice(0, 15)}... 특가!`,
    hookingContent: '매력적인 상품 설명...',
    productCategory: ['SEAFOOD', 'MEAT', 'AGRICULTURE', 'PROCESSED', 'OTHER'][index % 5],
    priceInfo: { originalPrice: 10000 + (index * 1000), salePrice: 8000 + (index * 800) },
    shippingFee: 3000,
    hasDeadline: Math.random() > 0.5,
    deadlineInfo: '오늘까지 특가!'
  }
}

// 청크 단위로 병렬 처리하는 함수
async function processInChunks(posts, chunkSize = MAX_CONCURRENT_ANALYSIS) {
  const results = []
  const chunks = []
  
  // 게시물을 청크로 분할
  for (let i = 0; i < posts.length; i += chunkSize) {
    chunks.push(posts.slice(i, i + chunkSize))
  }
  
  console.log(`📦 ${posts.length}개 게시물을 ${chunks.length}개 청크로 분할 (청크 크기: ${chunkSize})`)
  
  // 각 청크를 병렬로 처리
  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const chunk = chunks[chunkIndex]
    console.log(`🚀 청크 ${chunkIndex + 1}/${chunks.length} 병렬 처리 시작 (${chunk.length}개 게시물)`)
    
    const chunkStartTime = Date.now()
    
    // 현재 청크의 모든 게시물을 동시에 AI 분석
    const chunkPromises = chunk.map((post, index) => 
      analyzeProductParallel(
        post.content, 
        JSON.parse(post.comments || '[]'),
        post.pricingPolicy,
        chunkIndex * chunkSize + index
      )
    )
    
    // 현재 청크의 모든 AI 분석 완료 대기
    const chunkResults = await Promise.all(chunkPromises)
    results.push(...chunkResults)
    
    const chunkTime = Date.now() - chunkStartTime
    console.log(`✅ 청크 ${chunkIndex + 1} 완료: ${chunkTime}ms (평균: ${chunkTime / chunk.length}ms)`)
    
    // 청크 간 간격 (API 제한 방지)
    if (chunkIndex < chunks.length - 1) {
      console.log('⏳ 청크 간 대기 중... (500ms)')
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }
  
  return results
}

// 병렬 방식 상품 수집 함수
async function collectProductsWithParallel(bandId, dateRange) {
  const startTime = Date.now()
  console.log('🚀 병렬 AI 처리 방식 상품 수집 시작')
  
  try {
    // 1단계: 상품 수집
    console.log('📦 1단계: 상품 수집 중...')
    const collectionStartTime = Date.now()
    
    const posts = await collectPostsOnly(bandId, dateRange)
    
    const collectionTime = Date.now() - collectionStartTime
    console.log(`📦 상품 수집 완료: ${posts.length}개 (${collectionTime}ms)`)
    
    // 2단계: 병렬 AI 분석
    console.log('🤖 2단계: 병렬 AI 분석 시작...')
    const analysisStartTime = Date.now()
    
    const aiResults = await processInChunks(posts, MAX_CONCURRENT_ANALYSIS)
    
    const analysisTime = Date.now() - analysisStartTime
    
    // 3단계: 데이터베이스 업데이트 (병렬)
    console.log('💾 3단계: 데이터베이스 일괄 업데이트 중...')
    const updateStartTime = Date.now()
    
    // 데이터베이스 업데이트도 병렬로 처리
    const updatePromises = aiResults.map(async (result, index) => {
      // 실제 환경에서는 prisma.collectedPost.update 사용
      return new Promise(resolve => {
        setTimeout(() => {
          console.log(`💾 DB 업데이트 완료 [${index}]`)
          resolve(true)
        }, Math.random() * 100 + 50) // DB 업데이트 시간 시뮬레이션
      })
    })
    
    await Promise.all(updatePromises)
    
    const updateTime = Date.now() - updateStartTime
    const totalTime = Date.now() - startTime
    
    console.log(`✅ 병렬 방식 완료!`)
    console.log(`📊 성능 결과:`)
    console.log(`   - 상품 수집: ${collectionTime}ms`)
    console.log(`   - AI 분석 (병렬): ${analysisTime}ms`)
    console.log(`   - DB 업데이트: ${updateTime}ms`)
    console.log(`   - 총 시간: ${totalTime}ms`)
    console.log(`   - 처리된 상품: ${aiResults.length}개`)
    console.log(`   - 평균 분석 시간: ${aiResults.reduce((sum, r) => sum + r.processingTime, 0) / aiResults.length}ms`)
    console.log(`   - 동시 처리 수: ${MAX_CONCURRENT_ANALYSIS}개`)
    
    return {
      method: '병렬 AI 처리',
      totalTime,
      collectionTime,
      analysisTime,
      updateTime,
      productCount: aiResults.length,
      averageAnalysisTime: aiResults.reduce((sum, r) => sum + r.processingTime, 0) / aiResults.length,
      concurrency: MAX_CONCURRENT_ANALYSIS,
      throughput: aiResults.length / (totalTime / 1000) // 초당 처리량
    }
    
  } catch (error) {
    console.error('❌ 병렬 처리 실패:', error)
    throw error
  }
}

// AI 분석 없이 게시물만 수집하는 함수 (재사용)
async function collectPostsOnly(bandId, dateRange) {
  console.log('📝 게시물 수집 중 (AI 분석 제외)...')
  
  const mockPosts = []
  const postCount = 20 // 테스트용 게시물 수
  
  for (let i = 0; i < postCount; i++) {
    const post = {
      id: `test-post-${i}`,
      content: `테스트 상품 ${i} - 신선한 해산물을 저렴한 가격에 판매합니다. 도매가격으로 제공하며 품질을 보장합니다.`,
      comments: '["좋은 상품이네요", "가격 문의드립니다", "배송 언제 되나요?"]',
      pricingPolicy: '마진율 50% 적용, 배송비 별도',
      createdAt: new Date()
    }
    mockPosts.push(post)
  }
  
  return mockPosts
}

// 순차적 처리와 병렬 처리 비교 함수
async function compareSequentialVsParallel(posts) {
  console.log('\n🔄 순차 vs 병렬 처리 비교 테스트\n')
  
  // 순차적 처리 테스트
  console.log('1️⃣ 순차적 AI 분석 테스트')
  const sequentialStartTime = Date.now()
  
  const sequentialResults = []
  for (let i = 0; i < posts.length; i++) {
    const result = await analyzeProductParallel(
      posts[i].content, 
      JSON.parse(posts[i].comments || '[]'),
      posts[i].pricingPolicy,
      i
    )
    sequentialResults.push(result)
    
    // 기존 방식의 1초 대기 시간 시뮬레이션
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  const sequentialTime = Date.now() - sequentialStartTime
  
  // 병렬 처리 테스트
  console.log('\n2️⃣ 병렬 AI 분석 테스트')
  const parallelStartTime = Date.now()
  
  const parallelResults = await processInChunks(posts, MAX_CONCURRENT_ANALYSIS)
  
  const parallelTime = Date.now() - parallelStartTime
  
  // 결과 비교
  console.log('\n📊 비교 결과:')
  console.log(`순차적 처리: ${sequentialTime}ms (평균: ${sequentialTime / posts.length}ms)`)
  console.log(`병렬 처리: ${parallelTime}ms (평균: ${parallelTime / posts.length}ms)`)
  console.log(`성능 개선: ${((sequentialTime - parallelTime) / sequentialTime * 100).toFixed(1)}% 빨라짐`)
  console.log(`시간 단축: ${((sequentialTime - parallelTime) / 1000).toFixed(1)}초`)
  
  return {
    sequential: {
      totalTime: sequentialTime,
      averageTime: sequentialTime / posts.length,
      throughput: posts.length / (sequentialTime / 1000)
    },
    parallel: {
      totalTime: parallelTime,
      averageTime: parallelTime / posts.length,
      throughput: posts.length / (parallelTime / 1000)
    },
    improvement: {
      timeReduction: sequentialTime - parallelTime,
      percentageImprovement: ((sequentialTime - parallelTime) / sequentialTime * 100).toFixed(1)
    }
  }
}

module.exports = {
  collectProductsWithParallel,
  compareSequentialVsParallel,
  testParallelProcessing: async () => {
    console.log('\n🧪 가설 2: 병렬 AI 처리 테스트 시작\n')
    
    try {
      const result = await collectProductsWithParallel('test-band', {
        startDate: '2025-09-06',
        endDate: '2025-09-06'
      })
      
      // 순차 vs 병렬 비교도 수행
      const posts = await collectPostsOnly('test-band', {})
      const comparison = await compareSequentialVsParallel(posts.slice(0, 10)) // 샘플 10개만
      
      return {
        parallelResult: result,
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
  const { testParallelProcessing } = require(__filename)
  testParallelProcessing()
    .then(result => {
      if (result) {
        console.log('\n📊 병렬 처리 테스트 결과:', result)
      }
      process.exit(0)
    })
    .catch(error => {
      console.error('테스트 오류:', error)
      process.exit(1)
    })
}