/**
 * 하이브리드 조합 방식 테스트
 * 
 * 4가지 조합 방식을 테스트합니다:
 * 1. Queue + 병렬 처리
 * 2. Queue + 배치 처리  
 * 3. 병렬 + 배치 처리
 * 4. Ultimate: Queue + 병렬 + 배치 (모든 방식 결합)
 */

const fs = require('fs').promises

// 가상 게시물 생성
async function generateMockPosts(count = 20) {
  const posts = []
  const categories = ['해산물', '축산물', '농산물', '가공식품', '기타상품']
  
  for (let i = 0; i < count; i++) {
    posts.push({
      id: `post-${i}`,
      content: `${categories[i % 5]} 상품 ${i + 1} - 신선하고 품질 좋은 상품을 도매가격으로 판매합니다. 전국배송 가능하며 대량주문 시 할인 혜택이 있습니다. 품질보장, 당일발송, 신선도 최상급을 자랑합니다.`,
      comments: JSON.stringify(['좋은 상품이네요', '가격 문의드립니다', '배송비는 얼마인가요?', '대량 주문 가능한가요?']),
      createdAt: new Date()
    })
  }
  
  return posts
}

// 배치 AI 분석 시뮬레이션 (향상된 버전)
async function analyzeBatchHybrid(posts, workerIndex, batchIndex) {
  const startTime = Date.now()
  console.log(`🤖 Worker ${workerIndex} - 배치 ${batchIndex} AI 분석 시작: ${posts.length}개`)
  
  // 배치 처리의 효율성을 고려한 시간 계산
  // 개별 처리 대비 30% 시간 절약 + 병렬 처리 효과
  const baseProcessingTime = posts.length * 300 // 개당 300ms (배치 효율성 적용)
  const batchOptimizationBonus = posts.length * 200 // 배치 처리 보너스
  const totalProcessingTime = baseProcessingTime + Math.random() * 1000 + 1500 // 기본 오버헤드
  
  await new Promise(resolve => setTimeout(resolve, totalProcessingTime))
  
  const results = posts.map((post, index) => ({
    index: batchIndex * 5 + index,
    hookingTitle: `${post.content.slice(0, 15)}... 특가!`,
    hookingContent: `Worker ${workerIndex}에서 배치 처리한 매력적인 상품 ${index + 1}`,
    productCategory: ['SEAFOOD', 'MEAT', 'AGRICULTURE', 'PROCESSED', 'OTHER'][index % 5],
    priceInfo: { originalPrice: 10000 + (index * 1000), salePrice: 8000 + (index * 800) },
    shippingFee: 3000,
    hasDeadline: Math.random() > 0.7,
    processingTime: totalProcessingTime / posts.length,
    workerIndex,
    batchProcessed: true,
    hybridProcessed: true
  }))
  
  const endTime = Date.now()
  console.log(`✅ Worker ${workerIndex} - 배치 ${batchIndex} 완료: ${endTime - startTime}ms (평균: ${(endTime - startTime) / posts.length}ms/개)`)
  
  return {
    results,
    processingTime: endTime - startTime,
    workerIndex,
    batchIndex,
    averageTime: (endTime - startTime) / posts.length,
    tokensUsed: posts.reduce((sum, post) => sum + post.content.length, 0),
    efficiency: 'BATCH_OPTIMIZED'
  }
}

// 조합 1: Queue + 병렬 처리
async function testQueuePlusParallel() {
  console.log('\n🟡🟢 조합 1: Queue + 병렬 처리 테스트')
  
  const startTime = Date.now()
  const posts = await generateMockPosts(20)
  
  // 1단계: 빠른 수집
  console.log('📦 상품 수집 (초고속)...')
  const collectionTime = 250 // Queue 방식의 빠른 수집
  await new Promise(resolve => setTimeout(resolve, collectionTime))
  
  // 2단계: Queue 등록 (개별 작업으로)
  console.log('📝 Queue에 개별 작업 등록...')
  const queueTime = 80
  await new Promise(resolve => setTimeout(resolve, queueTime))
  
  // 3단계: 병렬 Worker 처리
  console.log('🤖 다중 Worker 병렬 AI 분석...')
  const analysisStartTime = Date.now()
  
  const workerCount = 6 // Queue 환경에서 더 많은 Worker 가능
  const batches = []
  for (let i = 0; i < posts.length; i += workerCount) {
    batches.push(posts.slice(i, i + workerCount))
  }
  
  const results = []
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex]
    console.log(`병렬 처리 중 - 배치 ${batchIndex + 1}: ${batch.length}개 작업`)
    
    // 각 Worker가 개별 게시물을 처리 (병렬)
    const workerPromises = batch.map(async (post, workerIndex) => {
      const processingTime = Math.random() * 1500 + 800 // Queue 최적화로 더 빠름
      await new Promise(resolve => setTimeout(resolve, processingTime))
      return {
        index: results.length + workerIndex,
        processingTime,
        hookingTitle: `${post.content.slice(0, 15)}... 특가!`,
        queueProcessed: true,
        parallelProcessed: true
      }
    })
    
    const batchResults = await Promise.all(workerPromises)
    results.push(...batchResults)
  }
  
  const analysisTime = Date.now() - analysisStartTime
  const totalTime = Date.now() - startTime
  
  return {
    method: 'Queue + 병렬 처리',
    totalTime,
    collectionTime,
    queueTime,
    analysisTime,
    productCount: posts.length,
    workerCount,
    averageAnalysisTime: results.reduce((sum, r) => sum + r.processingTime, 0) / results.length,
    throughput: posts.length / (totalTime / 1000),
    efficiency: 'VERY_HIGH',
    combination: ['Queue', 'Parallel']
  }
}

// 조합 2: Queue + 배치 처리
async function testQueuePlusBatch() {
  console.log('\n🟡🔵 조합 2: Queue + 배치 처리 테스트')
  
  const startTime = Date.now()
  const posts = await generateMockPosts(20)
  
  // 1단계: 빠른 수집
  console.log('📦 상품 수집 (초고속)...')
  const collectionTime = 250
  await new Promise(resolve => setTimeout(resolve, collectionTime))
  
  // 2단계: Queue에 배치 작업 등록
  console.log('📝 Queue에 배치 작업 등록...')
  const queueTime = 60 // 배치 단위라 등록이 더 빠름
  await new Promise(resolve => setTimeout(resolve, queueTime))
  
  // 3단계: 배치 처리
  console.log('🤖 Queue Worker - 배치 AI 분석...')
  const analysisStartTime = Date.now()
  
  const batchSize = 5
  const batches = []
  for (let i = 0; i < posts.length; i += batchSize) {
    batches.push(posts.slice(i, i + batchSize))
  }
  
  const allResults = []
  let totalTokensUsed = 0
  
  // Queue Worker가 순차적으로 배치 처리
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex]
    console.log(`배치 처리 중 ${batchIndex + 1}/${batches.length}: ${batch.length}개`)
    
    const batchResult = await analyzeBatchHybrid(batch, 1, batchIndex)
    allResults.push(...batchResult.results)
    totalTokensUsed += batchResult.tokensUsed
    
    // Queue 환경에서는 배치 간 간격이 짧음
    if (batchIndex < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 300))
    }
  }
  
  const analysisTime = Date.now() - analysisStartTime
  const totalTime = Date.now() - startTime
  
  return {
    method: 'Queue + 배치 처리',
    totalTime,
    collectionTime,
    queueTime,
    analysisTime,
    productCount: posts.length,
    batchCount: batches.length,
    batchSize,
    totalTokensUsed,
    averageAnalysisTime: analysisTime / batches.length,
    throughput: posts.length / (totalTime / 1000),
    efficiency: 'HIGH',
    costEfficiency: 'VERY_HIGH',
    combination: ['Queue', 'Batch']
  }
}

// 조합 3: 병렬 + 배치 처리
async function testParallelPlusBatch() {
  console.log('\n🟢🔵 조합 3: 병렬 + 배치 처리 테스트')
  
  const startTime = Date.now()
  const posts = await generateMockPosts(20)
  
  // 1단계: 상품 수집
  console.log('📦 상품 수집...')
  const collectionTime = 400
  await new Promise(resolve => setTimeout(resolve, collectionTime))
  
  // 2단계: 병렬 배치 처리
  console.log('🤖 병렬 배치 AI 분석...')
  const analysisStartTime = Date.now()
  
  const batchSize = 4
  const concurrentBatches = 3 // 3개 배치를 동시에 처리
  
  const batches = []
  for (let i = 0; i < posts.length; i += batchSize) {
    batches.push(posts.slice(i, i + batchSize))
  }
  
  const allResults = []
  let totalTokensUsed = 0
  
  // 배치들을 concurrentBatches 개씩 병렬 처리
  const batchGroups = []
  for (let i = 0; i < batches.length; i += concurrentBatches) {
    batchGroups.push(batches.slice(i, i + concurrentBatches))
  }
  
  for (let groupIndex = 0; groupIndex < batchGroups.length; groupIndex++) {
    const batchGroup = batchGroups[groupIndex]
    console.log(`병렬 배치 그룹 ${groupIndex + 1} 처리: ${batchGroup.length}개 배치 동시 실행`)
    
    // 현재 그룹의 배치들을 병렬로 처리
    const groupPromises = batchGroup.map((batch, workerIndex) => 
      analyzeBatchHybrid(batch, workerIndex, groupIndex * concurrentBatches + workerIndex)
    )
    
    const groupResults = await Promise.all(groupPromises)
    
    groupResults.forEach(result => {
      allResults.push(...result.results)
      totalTokensUsed += result.tokensUsed
    })
    
    // 그룹 간 간격
    if (groupIndex < batchGroups.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 400))
    }
  }
  
  const analysisTime = Date.now() - analysisStartTime
  const totalTime = Date.now() - startTime
  
  return {
    method: '병렬 + 배치 처리',
    totalTime,
    collectionTime,
    analysisTime,
    productCount: posts.length,
    batchSize,
    concurrentBatches,
    totalBatches: batches.length,
    totalTokensUsed,
    averageAnalysisTime: analysisTime / batches.length,
    throughput: posts.length / (totalTime / 1000),
    efficiency: 'VERY_HIGH',
    costEfficiency: 'HIGH',
    combination: ['Parallel', 'Batch']
  }
}

// 조합 4: Ultimate - Queue + 병렬 + 배치
async function testUltimateHybrid() {
  console.log('\n🟡🟢🔵 조합 4: Ultimate (Queue + 병렬 + 배치) 테스트')
  
  const startTime = Date.now()
  const posts = await generateMockPosts(20)
  
  // 1단계: 초고속 수집 (Queue 이점)
  console.log('📦 상품 수집 (울트라 고속)...')
  const collectionTime = 200 // 가장 빠른 수집
  await new Promise(resolve => setTimeout(resolve, collectionTime))
  
  // 2단계: Queue에 배치 작업 등록
  console.log('📝 Queue에 최적화된 배치 작업 등록...')
  const queueTime = 50 // 최적화된 등록
  await new Promise(resolve => setTimeout(resolve, queueTime))
  
  // 3단계: 다중 Worker가 병렬로 배치 처리
  console.log('🤖 Ultimate: 다중 Worker 병렬 배치 AI 분석...')
  const analysisStartTime = Date.now()
  
  const batchSize = 4 // 최적 배치 크기
  const workerCount = 4 // 4개 Worker가 병렬 처리
  
  const batches = []
  for (let i = 0; i < posts.length; i += batchSize) {
    batches.push(posts.slice(i, i + batchSize))
  }
  
  const allResults = []
  let totalTokensUsed = 0
  
  // Worker 수만큼 배치를 병렬로 처리
  const workerGroups = []
  for (let i = 0; i < batches.length; i += workerCount) {
    workerGroups.push(batches.slice(i, i + workerCount))
  }
  
  for (let groupIndex = 0; groupIndex < workerGroups.length; groupIndex++) {
    const workerGroup = workerGroups[groupIndex]
    console.log(`Ultimate 그룹 ${groupIndex + 1} 처리: ${workerGroup.length}개 Worker 동시 배치 처리`)
    
    // 현재 그룹의 모든 Worker가 각각 배치를 병렬 처리
    const workerPromises = workerGroup.map((batch, workerIndex) => 
      analyzeBatchHybrid(batch, workerIndex + 1, groupIndex * workerCount + workerIndex)
    )
    
    const workerResults = await Promise.all(workerPromises)
    
    workerResults.forEach(result => {
      allResults.push(...result.results)
      totalTokensUsed += result.tokensUsed
    })
    
    // Ultimate 방식에서는 그룹 간 간격 최소화
    if (groupIndex < workerGroups.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }
  
  const analysisTime = Date.now() - analysisStartTime
  const totalTime = Date.now() - startTime
  
  return {
    method: 'Ultimate (Queue + 병렬 + 배치)',
    totalTime,
    collectionTime,
    queueTime,
    analysisTime,
    productCount: posts.length,
    batchSize,
    workerCount,
    totalBatches: batches.length,
    totalWorkerGroups: workerGroups.length,
    totalTokensUsed,
    averageAnalysisTime: analysisTime / batches.length,
    throughput: posts.length / (totalTime / 1000),
    efficiency: 'ULTIMATE',
    costEfficiency: 'VERY_HIGH',
    scalability: 'EXCELLENT',
    combination: ['Queue', 'Parallel', 'Batch'],
    optimizations: [
      '초고속 수집',
      '최적화된 Queue 등록',
      '다중 Worker 병렬 처리',
      '배치 처리 효율성',
      '최소 대기 시간'
    ]
  }
}

// 메인 하이브리드 테스트 함수
async function runHybridCombinationTests() {
  console.log('🧪 ===== 하이브리드 조합 방식 테스트 =====')
  console.log('🎯 목표: 3가지 방식 조합의 시너지 효과 검증\n')
  
  const results = []
  
  try {
    // 조합 1: Queue + 병렬
    const combo1 = await testQueuePlusParallel()
    results.push(combo1)
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // 조합 2: Queue + 배치
    const combo2 = await testQueuePlusBatch()
    results.push(combo2)
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // 조합 3: 병렬 + 배치
    const combo3 = await testParallelPlusBatch()
    results.push(combo3)
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // 조합 4: Ultimate
    const combo4 = await testUltimateHybrid()
    results.push(combo4)
    
    return results
    
  } catch (error) {
    console.error('❌ 하이브리드 테스트 실행 중 오류:', error)
    throw error
  }
}

// 하이브리드 결과 분석
function analyzeHybridResults(hybridResults, originalResults) {
  console.log('\n📊 ===== 하이브리드 조합 성능 분석 =====\n')
  
  // 모든 결과 통합 (기존 + 하이브리드)
  const allResults = [...originalResults, ...hybridResults]
  const sortedResults = [...allResults].sort((a, b) => a.totalTime - b.totalTime)
  
  console.log('🏆 전체 성능 순위 (기존 + 하이브리드):')
  sortedResults.forEach((result, index) => {
    const rank = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'][index] || `${index + 1}️⃣`
    const isHybrid = result.combination ? ' 🔥' : ''
    console.log(`${rank} ${result.method}${isHybrid}: ${result.totalTime}ms (${result.throughput.toFixed(2)} 상품/초)`)
  })
  
  console.log('\n🔥 하이브리드 방식 상세 분석:')
  console.log('방식'.padEnd(25) + '총시간(ms)'.padEnd(12) + '처리량'.padEnd(12) + '효율성'.padEnd(15) + '조합')
  console.log('-'.repeat(80))
  
  hybridResults.forEach(result => {
    console.log(
      result.method.padEnd(25) + 
      result.totalTime.toString().padEnd(12) + 
      result.throughput.toFixed(2).padEnd(12) + 
      result.efficiency.padEnd(15) + 
      result.combination.join('+')
    )
  })
  
  // 기존 최고 성능과 비교
  const baseline = originalResults.find(r => r.method.includes('기존'))
  const bestHybrid = hybridResults.reduce((best, current) => 
    current.totalTime < best.totalTime ? current : best
  )
  
  console.log('\n⚡ 하이브리드 vs 기존 방식 개선율:')
  hybridResults.forEach(result => {
    const improvement = ((baseline.totalTime - result.totalTime) / baseline.totalTime * 100).toFixed(1)
    const timeReduction = ((baseline.totalTime - result.totalTime) / 1000).toFixed(1)
    console.log(`${result.method}: ${improvement}% 개선 (${timeReduction}초 단축)`)
  })
  
  console.log('\n💎 최고 성능 하이브리드 방식:')
  console.log(`🏆 ${bestHybrid.method}`)
  console.log(`⏱️ 총 처리시간: ${bestHybrid.totalTime}ms`)
  console.log(`🚀 처리량: ${bestHybrid.throughput.toFixed(2)} 상품/초`)
  console.log(`📈 개선율: ${((baseline.totalTime - bestHybrid.totalTime) / baseline.totalTime * 100).toFixed(1)}%`)
  console.log(`⚡ 시간 단축: ${((baseline.totalTime - bestHybrid.totalTime) / 1000).toFixed(1)}초`)
  
  if (bestHybrid.optimizations) {
    console.log(`🔧 적용된 최적화:`)
    bestHybrid.optimizations.forEach(opt => console.log(`   - ${opt}`))
  }
  
  return {
    allResults: sortedResults,
    bestHybrid: bestHybrid,
    baseline: baseline,
    hybridResults: hybridResults
  }
}

module.exports = {
  runHybridCombinationTests,
  testQueuePlusParallel,
  testQueuePlusBatch,
  testParallelPlusBatch,
  testUltimateHybrid,
  analyzeHybridResults
}

// 직접 실행 시
if (require.main === module) {
  // 기존 결과 시뮬레이션 (실제로는 이전 테스트 결과 사용)
  const originalResults = [
    {
      method: '기존 방식 (순차적)',
      totalTime: 55702,
      throughput: 0.36,
      efficiency: 'LOW'
    },
    {
      method: 'Queue 기반 분리 처리',
      totalTime: 10318,
      throughput: 1.94,
      efficiency: 'HIGH'
    },
    {
      method: '병렬 AI 처리',
      totalTime: 12266,
      throughput: 1.63,
      efficiency: 'HIGH'
    },
    {
      method: '배치 처리',
      totalTime: 17465,
      throughput: 1.15,
      efficiency: 'MEDIUM'
    }
  ]
  
  runHybridCombinationTests()
    .then(hybridResults => {
      const analysis = analyzeHybridResults(hybridResults, originalResults)
      
      console.log('\n🎯 최종 권장사항:')
      console.log(`🏆 최고 성능: ${analysis.bestHybrid.method}`)
      console.log(`📊 성능 순위에서 ${analysis.allResults.findIndex(r => r === analysis.bestHybrid) + 1}위`)
      
      process.exit(0)
    })
    .catch(error => {
      console.error('❌ 하이브리드 테스트 실패:', error)
      process.exit(1)
    })
}