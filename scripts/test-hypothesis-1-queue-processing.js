/**
 * 가설 1: Queue 기반 분리 처리 테스트
 * 
 * 현재: 수집 -> AI 분석 (순차적)
 * 개선: 수집 -> Queue -> AI 분석 (비동기)
 */
const { PrismaClient } = require('@prisma/client')
const Bull = require('bull')

// 임시 큐 설정 (메모리 기반)
const aiAnalysisQueue = new Bull('AI Analysis Queue', {
  redis: {
    port: 6379,
    host: '127.0.0.1',
  },
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 5,
  }
})

const prisma = new PrismaClient()

// AI 분석 작업자 설정
aiAnalysisQueue.process('analyze-product', 5, async (job, done) => {
  const { postId, content, comments, pricingPolicy } = job.data
  
  try {
    console.log(`🤖 AI 분석 시작: ${postId}`)
    const startTime = Date.now()
    
    // 실제 AI 분석 호출 (Gemini API)
    const aiAnalysis = await analyzeProductWithQueue(content, comments, pricingPolicy)
    
    // 데이터베이스 업데이트
    await prisma.collectedPost.update({
      where: { id: postId },
      data: {
        aiAnalyzed: true,
        aiProcessedAt: new Date(),
        hookingTitle: aiAnalysis.hookingTitle,
        hookingContent: aiAnalysis.hookingContent,
        productCategory: aiAnalysis.productCategory,
        priceInfo: JSON.stringify(aiAnalysis.priceInfo),
        shippingFee: aiAnalysis.shippingFee,
        hasDeadline: aiAnalysis.hasDeadline,
        deadlineInfo: aiAnalysis.deadlineInfo
      }
    })
    
    const processingTime = Date.now() - startTime
    console.log(`✅ AI 분석 완료: ${postId} (${processingTime}ms)`)
    
    done(null, { postId, processingTime, success: true })
  } catch (error) {
    console.error(`❌ AI 분석 실패: ${postId}`, error)
    done(error)
  }
})

// 가상의 AI 분석 함수 (실제 Gemini 호출 시뮬레이션)
async function analyzeProductWithQueue(content, comments, pricingPolicy) {
  // 실제 AI 분석 시간을 시뮬레이션 (1-3초 랜덤)
  const processingTime = Math.random() * 2000 + 1000
  await new Promise(resolve => setTimeout(resolve, processingTime))
  
  return {
    hookingTitle: `${content.slice(0, 15)}... 특가!`,
    hookingContent: '매력적인 상품 설명...',
    productCategory: 'SEAFOOD',
    priceInfo: { originalPrice: 10000, salePrice: 8000 },
    shippingFee: 3000,
    hasDeadline: Math.random() > 0.5,
    deadlineInfo: '오늘까지 특가!'
  }
}

// Queue 방식 상품 수집 함수
async function collectProductsWithQueue(bandId, dateRange) {
  const startTime = Date.now()
  console.log('🚀 Queue 방식 상품 수집 시작')
  
  try {
    // 1단계: 상품 수집만 수행 (AI 분석 제외)
    console.log('📦 1단계: 상품 수집 중...')
    const collectionStartTime = Date.now()
    
    // 실제 밴드에서 게시물 수집 (AI 분석 없이)
    const posts = await collectPostsOnly(bandId, dateRange)
    
    const collectionTime = Date.now() - collectionStartTime
    console.log(`📦 상품 수집 완료: ${posts.length}개 (${collectionTime}ms)`)
    
    // 2단계: AI 분석 작업을 Queue에 추가
    console.log('🤖 2단계: AI 분석 Queue 등록 중...')
    const queueStartTime = Date.now()
    
    const jobs = []
    for (const post of posts) {
      const job = await aiAnalysisQueue.add('analyze-product', {
        postId: post.id,
        content: post.content,
        comments: JSON.parse(post.comments || '[]'),
        pricingPolicy: post.pricingPolicy
      })
      jobs.push(job)
    }
    
    const queueTime = Date.now() - queueStartTime
    console.log(`🤖 Queue 등록 완료: ${jobs.length}개 작업 (${queueTime}ms)`)
    
    // 3단계: 모든 AI 분석 작업 완료 대기
    console.log('⏳ 3단계: AI 분석 완료 대기 중...')
    const analysisStartTime = Date.now()
    
    const results = await Promise.all(jobs.map(job => job.finished()))
    
    const analysisTime = Date.now() - analysisStartTime
    const totalTime = Date.now() - startTime
    
    console.log(`✅ Queue 방식 완료!`)
    console.log(`📊 성능 결과:`)
    console.log(`   - 상품 수집: ${collectionTime}ms`)
    console.log(`   - Queue 등록: ${queueTime}ms`)
    console.log(`   - AI 분석: ${analysisTime}ms`)
    console.log(`   - 총 시간: ${totalTime}ms`)
    console.log(`   - 처리된 상품: ${results.length}개`)
    console.log(`   - 평균 분석 시간: ${analysisTime / results.length}ms`)
    
    return {
      method: 'Queue 기반 분리 처리',
      totalTime,
      collectionTime,
      analysisTime,
      productCount: results.length,
      averageAnalysisTime: analysisTime / results.length,
      throughput: results.length / (totalTime / 1000) // 초당 처리량
    }
    
  } catch (error) {
    console.error('❌ Queue 방식 처리 실패:', error)
    throw error
  } finally {
    // 큐 정리
    await aiAnalysisQueue.close()
  }
}

// AI 분석 없이 게시물만 수집하는 함수
async function collectPostsOnly(bandId, dateRange) {
  console.log('📝 게시물 수집 중 (AI 분석 제외)...')
  
  // 가상의 게시물 데이터 생성 (실제 환경에서는 Band API 호출)
  const mockPosts = []
  const postCount = 20 // 테스트용 게시물 수
  
  for (let i = 0; i < postCount; i++) {
    // 실제로는 데이터베이스에 저장
    const post = {
      id: `test-post-${i}`,
      content: `테스트 상품 ${i} - 신선한 해산물을 저렴한 가격에 판매합니다.`,
      comments: '["좋은 상품이네요", "가격 문의드립니다"]',
      pricingPolicy: '마진율 50% 적용',
      createdAt: new Date()
    }
    mockPosts.push(post)
  }
  
  return mockPosts
}

module.exports = {
  collectProductsWithQueue,
  testQueueProcessing: async () => {
    console.log('\n🧪 가설 1: Queue 기반 분리 처리 테스트 시작\n')
    
    try {
      const result = await collectProductsWithQueue('test-band', {
        startDate: '2025-09-06',
        endDate: '2025-09-06'
      })
      
      return result
    } catch (error) {
      console.error('테스트 실패:', error)
      return null
    }
  }
}

// 직접 실행 시 테스트 수행
if (require.main === module) {
  const { testQueueProcessing } = require(__filename)
  testQueueProcessing()
    .then(result => {
      if (result) {
        console.log('\n📊 Queue 테스트 결과:', result)
      }
      process.exit(0)
    })
    .catch(error => {
      console.error('테스트 오류:', error)
      process.exit(1)
    })
}