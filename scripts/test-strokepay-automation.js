// 스룩페이 자동화 테스트 스크립트
require('dotenv').config({ path: '.env.local' })
const { StrokePayAutomation } = require('../lib/strokepay-automation')

async function testStrokePayAutomation() {
  const automation = new StrokePayAutomation()
  
  try {
    console.log('🚀 스룩페이 자동화 테스트 시작')
    
    // 브라우저 시작 (화면을 보여줌)
    await automation.startBrowser({ headless: false })
    console.log('✅ 브라우저 시작 완료')
    
    // 로그인 페이지로 이동
    await automation.navigateToLogin()
    console.log('✅ 로그인 페이지 이동 완료')
    
    console.log('')
    console.log('📋 사용 방법:')
    console.log('1. 브라우저에서 로그인을 진행하세요')
    console.log('2. 상품 등록 페이지로 이동하세요')  
    console.log('3. 엑셀 파일을 업로드하고 상품을 등록하세요')
    console.log('4. 모든 과정이 완료되면 이 터미널에서 Ctrl+C를 눌러주세요')
    console.log('')
    console.log('💡 모든 클릭, 입력, 이동이 자동으로 기록됩니다!')
    console.log('⏳ 프로세스를 완료할 때까지 기다리는 중...')
    
    // 사용자가 Ctrl+C를 누를 때까지 대기
    await new Promise((resolve) => {
      process.on('SIGINT', async () => {
        console.log('\n🛑 사용자 인터럽트 감지됨')
        
        // 기록된 액션들 가져오기
        console.log('📋 기록된 액션 가져오는 중...')
        const actions = await automation.getRecordedActions()
        
        if (actions.length > 0) {
          console.log(`✅ ${actions.length}개의 액션이 기록됨`)
          
          // 액션 요약 출력
          const summary = actions.reduce((acc, action) => {
            acc[action.type] = (acc[action.type] || 0) + 1
            return acc
          }, {})
          
          console.log('📊 액션 요약:', summary)
          
          // 자동화 스크립트 생성
          console.log('🤖 자동화 스크립트 생성 중...')
          const script = await automation.generateAutomationScript(actions)
          
          // 스크립트 저장
          const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')
          const filename = `strokepay-recorded-${timestamp}.js`
          const scriptPath = await automation.saveAutomationScript(script, filename)
          
          console.log(`💾 스크립트 저장 완료: ${scriptPath}`)
          
          // 액션 상세 내용 출력
          console.log('\n📝 기록된 액션 목록:')
          actions.forEach((action, index) => {
            const time = new Date(action.timestamp).toLocaleTimeString()
            let desc = ''
            
            switch (action.type) {
              case 'click':
                desc = `클릭: ${action.textContent || action.tagName}`
                break
              case 'input':
                desc = `입력: "${action.value}"`
                break
              case 'keydown':
                desc = `키: ${action.key}`
                break
              case 'navigation':
                desc = `이동: ${action.url}`
                break
              default:
                desc = action.type
            }
            
            console.log(`  ${index + 1}. [${time}] ${desc}`)
          })
          
        } else {
          console.log('❌ 기록된 액션이 없습니다.')
        }
        
        await automation.closeBrowser()
        resolve(null)
      })
    })
    
    console.log('🔚 테스트 완료')
    
  } catch (error) {
    console.error('❌ 테스트 실행 중 오류:', error)
  }
}

// 스크립트 직접 실행
if (require.main === module) {
  testStrokePayAutomation()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ 치명적 오류:', error)
      process.exit(1)
    })
}

module.exports = { testStrokePayAutomation }