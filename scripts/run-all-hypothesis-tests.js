// 모든 2단계 인증 우회 가설들을 순차적으로 테스트
const fs = require('fs')

// 각 가설 테스트 함수들 import
const { testHypothesis1UltraSlow } = require('./test-hypothesis-1-ultra-slow.js')
const { testHypothesis2NaturalBehavior } = require('./test-hypothesis-2-natural-behavior.js')
const { testHypothesis3FingerprintBypass } = require('./test-hypothesis-3-fingerprint-bypass.js')
const { testHypothesis4SessionReuse } = require('./test-hypothesis-4-session-reuse.js')
const { testHypothesis5HumanTyping } = require('./test-hypothesis-5-human-typing.js')

async function runAllHypothesisTests() {
  console.log('🧪 2단계 인증 우회 전체 가설 테스트 시작!')
  console.log('📊 5가지 다른 접근 방식을 순차적으로 테스트합니다.\n')
  
  const results = []
  const startTime = Date.now()
  
  const hypotheses = [
    {
      name: '가설 1: 초느린 속도 + 불규칙 딜레이',
      description: '인간의 불규칙한 행동 패턴을 극도로 느린 속도로 시뮬레이션',
      testFunction: testHypothesis1UltraSlow,
      estimatedTime: '10-15분'
    },
    {
      name: '가설 2: 자연스러운 마우스 패턴 + 페이지 탐색',
      description: '실제 사용자의 브라우징 행동을 완벽하게 시뮬레이션',
      testFunction: testHypothesis2NaturalBehavior,
      estimatedTime: '5-8분'
    },
    {
      name: '가설 3: 완전한 핑거프린팅 우회',
      description: 'WebGL, Canvas, Audio 등 모든 핑거프린팅 요소 완전 우회',
      testFunction: testHypothesis3FingerprintBypass,
      estimatedTime: '3-5분'
    },
    {
      name: '가설 4: 세션 재사용 방식',
      description: '기존 로그인 세션을 저장하고 재사용하여 인증 과정 완전 회피',
      testFunction: testHypothesis4SessionReuse,
      estimatedTime: '2-10분 (세션 상태에 따라)'
    },
    {
      name: '가설 5: 혼합 입력 방식 + 실수 시뮬레이션',
      description: '실제 사람의 타이핑 실수와 수정 과정을 포함한 자연스러운 입력',
      testFunction: testHypothesis5HumanTyping,
      estimatedTime: '5-7분'
    }
  ]
  
  console.log('📋 테스트 계획:')
  hypotheses.forEach((hyp, index) => {
    console.log(`${index + 1}. ${hyp.name}`)
    console.log(`   └─ ${hyp.description}`)
    console.log(`   └─ 예상 소요시간: ${hyp.estimatedTime}\n`)
  })
  
  console.log('⚠️ 주의사항:')
  console.log('- 각 테스트는 독립적으로 실행됩니다')
  console.log('- 테스트 중 브라우저가 열리며 자동으로 닫힙니다')
  console.log('- 일부 테스트는 수동 개입이 필요할 수 있습니다')
  console.log('- 전체 테스트 소요시간: 약 25-45분\n')
  
  // 사용자 확인
  console.log('🚀 테스트를 시작합니다...\n')
  
  for (let i = 0; i < hypotheses.length; i++) {
    const hypothesis = hypotheses[i]
    const testNumber = i + 1
    
    console.log('='.repeat(80))
    console.log(`🧪 ${testNumber}/5: ${hypothesis.name}`)
    console.log('='.repeat(80))
    console.log(`📝 설명: ${hypothesis.description}`)
    console.log(`⏰ 예상 시간: ${hypothesis.estimatedTime}`)
    console.log(`🔄 진행률: ${testNumber}/5 (${Math.round(testNumber / 5 * 100)}%)\n`)
    
    const testStartTime = Date.now()
    
    try {
      console.log(`🟢 ${hypothesis.name} 시작...`)
      const result = await hypothesis.testFunction()
      
      const testDuration = Math.round((Date.now() - testStartTime) / 1000)
      result.duration = testDuration
      result.hypothesis = hypothesis.name
      results.push(result)
      
      if (result.success) {
        console.log(`\n✅ ${hypothesis.name} 성공!`)
        console.log(`🎯 방법: ${result.method}`)
        console.log(`⏱️ 소요시간: ${testDuration}초`)
      } else {
        console.log(`\n❌ ${hypothesis.name} 실패`)
        console.log(`🔍 원인: ${result.error || '2단계 인증 발생'}`)
        console.log(`⏱️ 소요시간: ${testDuration}초`)
      }
      
    } catch (error) {
      console.error(`\n💥 ${hypothesis.name} 오류:`, error.message)
      results.push({
        success: false,
        hypothesis: hypothesis.name,
        method: hypothesis.description,
        error: error.message,
        duration: Math.round((Date.now() - testStartTime) / 1000)
      })
    }
    
    console.log(`\n⏸️ 다음 테스트까지 10초 대기...\n`)
    await new Promise(resolve => setTimeout(resolve, 10000))
  }
  
  // 최종 결과 분석
  console.log('\n' + '='.repeat(80))
  console.log('📊 전체 테스트 결과 분석')
  console.log('='.repeat(80))
  
  const totalDuration = Math.round((Date.now() - startTime) / 1000 / 60) // 분 단위
  const successfulTests = results.filter(r => r.success)
  const failedTests = results.filter(r => !r.success)
  
  console.log(`⏱️ 전체 테스트 소요시간: ${totalDuration}분`)
  console.log(`✅ 성공한 테스트: ${successfulTests.length}/${results.length}`)
  console.log(`❌ 실패한 테스트: ${failedTests.length}/${results.length}`)
  
  if (successfulTests.length > 0) {
    console.log('\n🏆 성공한 방법들:')
    successfulTests.forEach((result, index) => {
      console.log(`${index + 1}. ${result.hypothesis}`)
      console.log(`   ├─ 방법: ${result.method}`)
      console.log(`   ├─ 소요시간: ${result.duration}초`)
      if (result.inputActivity) {
        console.log(`   └─ 입력 활동: 키보드 ${result.inputActivity.keyEvents}, 마우스 ${result.inputActivity.mouseEvents}`)
      }
    })
    
    // 최적 방법 추천
    const fastest = successfulTests.reduce((prev, current) => 
      prev.duration < current.duration ? prev : current
    )
    
    console.log(`\n🥇 최적 방법 추천: ${fastest.hypothesis}`)
    console.log(`   ├─ 이유: 가장 빠른 성공 (${fastest.duration}초)`)
    console.log(`   └─ 방법: ${fastest.method}`)
    
  } else {
    console.log('\n❌ 모든 방법이 실패했습니다.')
    console.log('🔍 실패 원인 분석:')
    failedTests.forEach((result, index) => {
      console.log(`${index + 1}. ${result.hypothesis}: ${result.error}`)
    })
    
    console.log('\n💡 추가 조치 방안:')
    console.log('- VPN 또는 다른 네트워크 환경에서 시도')
    console.log('- 다른 시간대에 테스트 (서버 부하 고려)')
    console.log('- 더 긴 대기 시간 적용')
    console.log('- 수동 인증 후 세션 저장 방식 활용')
  }
  
  console.log('\n📄 실패한 방법들:')
  failedTests.forEach((result, index) => {
    console.log(`${index + 1}. ${result.hypothesis}`)
    console.log(`   ├─ 실패 원인: ${result.error || '2단계 인증 발생'}`)
    console.log(`   └─ 소요시간: ${result.duration}초`)
  })
  
  // 결과를 파일로 저장
  const reportPath = `./test-results-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    totalDuration: totalDuration,
    successRate: Math.round(successfulTests.length / results.length * 100),
    results: results
  }, null, 2))
  
  console.log(`\n💾 상세 결과가 저장되었습니다: ${reportPath}`)
  
  return {
    successful: successfulTests,
    failed: failedTests,
    optimalMethod: successfulTests.length > 0 ? successfulTests.reduce((prev, current) => 
      prev.duration < current.duration ? prev : current
    ) : null
  }
}

// 스크립트 실행
if (require.main === module) {
  runAllHypothesisTests()
    .then((finalResults) => {
      if (finalResults.optimalMethod) {
        console.log(`\n🎯 최종 결론: ${finalResults.optimalMethod.hypothesis}이(가) 가장 효과적입니다.`)
      } else {
        console.log('\n⚠️ 모든 방법이 실패했습니다. 추가 연구가 필요합니다.')
      }
      process.exit(0)
    })
    .catch(error => {
      console.error('\n💥 전체 테스트 실행 오류:', error)
      process.exit(1)
    })
}

module.exports = { runAllHypothesisTests }