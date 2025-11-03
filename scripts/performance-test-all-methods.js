/**
 * BandAuto 상품 수집 성능 테스트 스크립트
 * 
 * 모든 가설들을 테스트하고 성능을 비교 분석합니다.
 * 1. 기존 방식 (순차적 AI 분석)
 * 2. Queue 기반 분리 처리
 * 3. 병렬 AI 처리  
 * 4. 배치 처리
 */

const fs = require('fs').promises
const path = require('path')

// 기존 방식 시뮬레이션
async function testCurrentMethod() {
  console.log('\n🔴 기존 방식 테스트 (순차적 AI 분석)')
  
  const startTime = Date.now()
  const posts = await generateMockPosts(20)
  
  console.log('📦 상품 수집 중...')
  const collectionTime = 500 // 수집 시간 시뮬레이션
  await new Promise(resolve => setTimeout(resolve, collectionTime))
  
  console.log('🤖 순차적 AI 분석 시작...')
  const analysisStartTime = Date.now()
  
  const results = []
  for (let i = 0; i < posts.length; i++) {
    console.log(`AI 분석 중 [${i + 1}/${posts.length}]: ${posts[i].content.slice(0, 30)}...`)
    
    // 실제 AI 분석 시간 (1-3초) + 대기시간 (1초)
    const aiTime = Math.random() * 2000 + 1000
    const waitTime = 1000
    
    await new Promise(resolve => setTimeout(resolve, aiTime))
    
    results.push({
      index: i,
      processingTime: aiTime,
      hookingTitle: `${posts[i].content.slice(0, 15)}... 특가!`
    })
    
    // API 제한 방지 대기
    if (i < posts.length - 1) {
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
  }
  
  const analysisTime = Date.now() - analysisStartTime
  const totalTime = Date.now() - startTime
  
  console.log(`✅ 기존 방식 완료!`)
  console.log(`   - 총 시간: ${totalTime}ms`)
  console.log(`   - 수집 시간: ${collectionTime}ms`)
  console.log(`   - AI 분석 시간: ${analysisTime}ms`)
  console.log(`   - 평균 분석 시간: ${analysisTime / posts.length}ms`)
  
  return {
    method: '기존 방식 (순차적)',
    totalTime,
    collectionTime,
    analysisTime,
    productCount: posts.length,
    averageAnalysisTime: analysisTime / posts.length,
    throughput: posts.length / (totalTime / 1000),
    efficiency: 'LOW'
  }
}

// 가상 게시물 생성
async function generateMockPosts(count = 20) {
  const posts = []
  const categories = ['해산물', '축산물', '농산물', '가공식품', '기타상품']
  
  for (let i = 0; i < count; i++) {
    posts.push({
      id: `post-${i}`,
      content: `${categories[i % 5]} 상품 ${i + 1} - 신선하고 품질 좋은 상품을 도매가격으로 판매합니다. 전국배송 가능하며 대량주문 시 할인 혜택이 있습니다.`,
      comments: JSON.stringify(['좋은 상품이네요', '가격 문의드립니다', '배송비는 얼마인가요?']),
      createdAt: new Date()
    })
  }
  
  return posts
}

// Queue 방식 시뮬레이션
async function testQueueMethod() {
  console.log('\n🟡 Queue 기반 분리 처리 테스트')
  
  const startTime = Date.now()
  const posts = await generateMockPosts(20)
  
  // 1단계: 빠른 수집
  console.log('📦 상품 수집 (빠른 수집)...')
  const collectionTime = 300
  await new Promise(resolve => setTimeout(resolve, collectionTime))
  
  // 2단계: Queue에 작업 등록 (즉시)
  console.log('📝 Queue 작업 등록...')
  const queueTime = 100
  await new Promise(resolve => setTimeout(resolve, queueTime))
  
  // 3단계: 병렬 AI 분석 (Queue Worker들이 병렬 처리)
  console.log('🤖 Queue Workers 병렬 AI 분석...')
  const analysisStartTime = Date.now()
  
  // 5개 Worker가 병렬로 처리한다고 가정
  const workerCount = 5
  const batches = []
  for (let i = 0; i < posts.length; i += workerCount) {
    batches.push(posts.slice(i, i + workerCount))
  }
  
  const results = []
  for (const batch of batches) {
    console.log(`병렬 처리 중: ${batch.length}개 작업`)
    
    // 배치의 모든 작업을 병렬로 처리 (가장 긴 작업 시간을 기준으로)
    const maxTime = Math.max(...batch.map(() => Math.random() * 2000 + 1000))
    await new Promise(resolve => setTimeout(resolve, maxTime))
    
    results.push(...batch.map((post, index) => ({
      index: results.length + index,
      processingTime: maxTime,
      hookingTitle: `${post.content.slice(0, 15)}... 특가!`
    })))
  }
  
  const analysisTime = Date.now() - analysisStartTime
  const totalTime = Date.now() - startTime
  
  console.log(`✅ Queue 방식 완료!`)
  console.log(`   - 총 시간: ${totalTime}ms`)
  console.log(`   - 수집 시간: ${collectionTime}ms`)
  console.log(`   - Queue 등록: ${queueTime}ms`)
  console.log(`   - AI 분석 시간: ${analysisTime}ms`)
  
  return {
    method: 'Queue 기반 분리 처리',
    totalTime,
    collectionTime,
    queueTime,
    analysisTime,
    productCount: posts.length,
    workerCount,
    averageAnalysisTime: analysisTime / batches.length,
    throughput: posts.length / (totalTime / 1000),
    efficiency: 'HIGH'
  }
}

// 병렬 처리 시뮬레이션
async function testParallelMethod() {
  console.log('\n🟢 병렬 AI 처리 테스트')
  
  const startTime = Date.now()
  const posts = await generateMockPosts(20)
  
  console.log('📦 상품 수집...')
  const collectionTime = 400
  await new Promise(resolve => setTimeout(resolve, collectionTime))
  
  console.log('🤖 병렬 AI 분석...')
  const analysisStartTime = Date.now()
  
  const concurrency = 5
  const batches = []
  for (let i = 0; i < posts.length; i += concurrency) {
    batches.push(posts.slice(i, i + concurrency))
  }
  
  const results = []
  for (const batch of batches) {
    console.log(`병렬 처리 중: ${batch.length}개`)
    
    // Promise.all로 병렬 처리 시뮬레이션
    const batchPromises = batch.map(async (post, index) => {
      const processingTime = Math.random() * 2000 + 1000
      await new Promise(resolve => setTimeout(resolve, processingTime))
      return {
        index: results.length + index,
        processingTime,
        hookingTitle: `${post.content.slice(0, 15)}... 특가!`
      }
    })
    
    const batchResults = await Promise.all(batchPromises)
    results.push(...batchResults)
    
    // 배치 간 간격
    if (batches.indexOf(batch) < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }
  
  const analysisTime = Date.now() - analysisStartTime
  const totalTime = Date.now() - startTime
  
  console.log(`✅ 병렬 방식 완료!`)
  console.log(`   - 총 시간: ${totalTime}ms`)
  console.log(`   - 동시 처리 수: ${concurrency}`)
  console.log(`   - AI 분석 시간: ${analysisTime}ms`)
  
  return {
    method: '병렬 AI 처리',
    totalTime,
    collectionTime,
    analysisTime,
    productCount: posts.length,
    concurrency,
    batchCount: batches.length,
    averageAnalysisTime: results.reduce((sum, r) => sum + r.processingTime, 0) / results.length,
    throughput: posts.length / (totalTime / 1000),
    efficiency: 'HIGH'
  }
}

// 배치 처리 시뮬레이션
async function testBatchMethod() {
  console.log('\n🔵 배치 처리 테스트')
  
  const startTime = Date.now()
  const posts = await generateMockPosts(20)
  
  console.log('📦 상품 수집...')
  const collectionTime = 400
  await new Promise(resolve => setTimeout(resolve, collectionTime))
  
  console.log('🤖 배치 AI 분석...')
  const analysisStartTime = Date.now()
  
  const batchSize = 5
  const batches = []
  for (let i = 0; i < posts.length; i += batchSize) {
    batches.push(posts.slice(i, i + batchSize))
  }
  
  const results = []
  for (const batch of batches) {
    console.log(`배치 분석 중: ${batch.length}개`)
    
    // 배치 분석은 더 오래 걸리지만 전체적으로 효율적
    const batchProcessingTime = 2000 + (batch.length * 300) // 기본 2초 + 개당 300ms
    await new Promise(resolve => setTimeout(resolve, batchProcessingTime))
    
    const batchResults = batch.map((post, index) => ({
      index: results.length + index,
      processingTime: batchProcessingTime / batch.length,
      batchProcessed: true,
      hookingTitle: `${post.content.slice(0, 15)}... 특가!`
    }))
    
    results.push(...batchResults)
    
    // 배치 간 간격
    if (batches.indexOf(batch) < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  
  const analysisTime = Date.now() - analysisStartTime
  const totalTime = Date.now() - startTime
  
  console.log(`✅ 배치 방식 완료!`)
  console.log(`   - 총 시간: ${totalTime}ms`)
  console.log(`   - 배치 수: ${batches.length}`)
  console.log(`   - 배치 크기: ${batchSize}`)
  
  return {
    method: '배치 처리',
    totalTime,
    collectionTime,
    analysisTime,
    productCount: posts.length,
    batchSize,
    batchCount: batches.length,
    averageAnalysisTime: analysisTime / batches.length,
    throughput: posts.length / (totalTime / 1000),
    efficiency: 'MEDIUM',
    costEfficiency: 'HIGH' // 토큰 사용량 측면에서
  }
}

// 메인 테스트 실행
async function runAllTests() {
  console.log('🧪 ===== BandAuto 성능 개선 가설 테스트 =====')
  console.log('📅 테스트 날짜: 2025-09-06')
  console.log('🎯 목표: 상품 수집 시 AI 분석 성능 최적화\n')
  
  const results = []
  
  try {
    // 1. 기존 방식 테스트
    const currentResult = await testCurrentMethod()
    results.push(currentResult)
    
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // 2. Queue 방식 테스트
    const queueResult = await testQueueMethod()
    results.push(queueResult)
    
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // 3. 병렬 처리 테스트
    const parallelResult = await testParallelMethod()
    results.push(parallelResult)
    
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // 4. 배치 처리 테스트
    const batchResult = await testBatchMethod()
    results.push(batchResult)
    
    console.log('\n📊 ===== 종합 성능 분석 =====\n')
    
    // 결과 정렬 (총 시간 기준)
    const sortedResults = [...results].sort((a, b) => a.totalTime - b.totalTime)
    
    console.log('🏆 성능 순위:')
    sortedResults.forEach((result, index) => {
      const rank = ['🥇', '🥈', '🥉', '4️⃣'][index] || `${index + 1}️⃣`
      console.log(`${rank} ${result.method}: ${result.totalTime}ms (${result.throughput.toFixed(2)} 상품/초)`)
    })
    
    console.log('\n📈 상세 비교:')
    console.log('방식'.padEnd(20) + '총시간(ms)'.padEnd(12) + 'AI분석(ms)'.padEnd(15) + '처리량(개/초)'.padEnd(12) + '효율성')
    console.log('-'.repeat(70))
    
    results.forEach(result => {
      console.log(
        result.method.padEnd(20) + 
        result.totalTime.toString().padEnd(12) + 
        result.analysisTime.toString().padEnd(15) + 
        result.throughput.toFixed(2).padEnd(12) + 
        result.efficiency
      )
    })
    
    // 개선율 계산
    const baseline = results.find(r => r.method.includes('기존'))
    if (baseline) {
      console.log('\n⚡ 개선율 (기존 방식 대비):')
      
      results.forEach(result => {
        if (result.method !== baseline.method) {
          const improvement = ((baseline.totalTime - result.totalTime) / baseline.totalTime * 100).toFixed(1)
          const timeReduction = ((baseline.totalTime - result.totalTime) / 1000).toFixed(1)
          console.log(`${result.method}: ${improvement}% 빨라짐 (${timeReduction}초 단축)`)
        }
      })
    }
    
    // 권장사항
    console.log('\n💡 권장사항:')
    const fastest = sortedResults[0]
    const mostEfficient = results.find(r => r.efficiency === 'HIGH') || fastest
    
    console.log(`🚀 가장 빠른 방식: ${fastest.method} (${fastest.totalTime}ms)`)
    console.log(`⚡ 가장 효율적: ${mostEfficient.method}`)
    
    if (results.find(r => r.costEfficiency === 'HIGH')) {
      const costEfficient = results.find(r => r.costEfficiency === 'HIGH')
      console.log(`💰 비용 효율적: ${costEfficient.method} (토큰 사용량 최적화)`)
    }
    
    // 리포트 저장
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const reportData = {
      timestamp: new Date().toISOString(),
      testDate: '2025-09-06',
      testConditions: {
        postCount: 20,
        testEnvironment: 'Development Simulation'
      },
      results: results,
      analysis: {
        fastest: fastest,
        mostEfficient: mostEfficient,
        baseline: baseline
      }
    }
    
    try {
      await fs.writeFile(`performance-report-${timestamp}.json`, JSON.stringify(reportData, null, 2))
      console.log(`\n📄 상세 리포트 저장됨: performance-report-${timestamp}.json`)
    } catch (error) {
      console.log('\n⚠️ 리포트 저장 실패 (권한 없음)')
    }
    
    return {
      results,
      fastest: fastest,
      baseline: baseline,
      improvements: results
        .filter(r => r.method !== baseline?.method)
        .map(r => ({
          method: r.method,
          improvement: ((baseline.totalTime - r.totalTime) / baseline.totalTime * 100).toFixed(1),
          timeReduction: (baseline.totalTime - r.totalTime) / 1000
        }))
    }
    
  } catch (error) {
    console.error('❌ 테스트 실행 중 오류:', error)
    throw error
  }
}

module.exports = {
  runAllTests,
  testCurrentMethod,
  testQueueMethod,
  testParallelMethod,
  testBatchMethod
}

// 직접 실행 시 모든 테스트 실행
if (require.main === module) {
  runAllTests()
    .then(result => {
      console.log('\n🎉 테스트 성공!')
      console.log(`🏆 최고 성능: ${result.fastest.method}`)
      console.log(`⏱️ 처리 시간: ${result.fastest.totalTime}ms`)
      console.log(`🚀 처리량: ${result.fastest.throughput.toFixed(2)} 상품/초`)
      
      if (result.improvements.length > 0) {
        console.log(`\n📈 개선 효과:`)
        result.improvements.forEach(imp => {
          console.log(`   - ${imp.method}: ${imp.improvement}% 성능 향상`)
        })
      }
      
      process.exit(0)
    })
    .catch(error => {
      console.error('❌ 테스트 실패:', error)
      process.exit(1)
    })
}