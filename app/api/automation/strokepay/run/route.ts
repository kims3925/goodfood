import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import StrokePayAutomation from '@/lib/strokepay-automation'
import path from 'path'
import fs from 'fs'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    const { scriptFilename, excelFilePath } = await request.json()

    if (!scriptFilename) {
      return NextResponse.json({
        success: false,
        error: '실행할 스크립트 파일명이 필요합니다.'
      }, { status: 400 })
    }

    console.log('🤖 자동화 스크립트 실행 시작')
    console.log('📄 스크립트:', scriptFilename)
    console.log('📊 엑셀파일:', excelFilePath || '없음')

    // 스크립트 파일 경로
    const scriptPath = path.join(process.cwd(), 'scripts', scriptFilename)
    
    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json({
        success: false,
        error: `스크립트 파일을 찾을 수 없습니다: ${scriptFilename}`
      }, { status: 400 })
    }

    // 새로운 자동화 인스턴스 생성 (실행용)
    const automation = new StrokePayAutomation()
    
    try {
      // 브라우저 시작 (헤드리스 모드로 실행)
      const page = await automation.startBrowser({ headless: false })
      
      // 동적으로 스크립트 로드 및 실행
      const scriptContent = fs.readFileSync(scriptPath, 'utf8')
      
      // 스크립트를 평가하여 함수 추출
      const scriptFunction = eval(`(${scriptContent.replace('module.exports = { runStrokePayAutomation }', 'runStrokePayAutomation')})`)
      
      // 엑셀 파일 경로가 있으면 전달
      if (excelFilePath && fs.existsSync(excelFilePath)) {
        console.log(`📤 엑셀 파일 준비: ${excelFilePath}`)
        // 스크립트에서 파일 업로드 처리 시 사용할 수 있도록 페이지에 파일 경로 저장
        await page.evaluate((filePath) => {
          window.excelFilePath = filePath
        }, excelFilePath)
      }

      // 스크립트 실행
      console.log('▶️  자동화 스크립트 실행 중...')
      await scriptFunction(page)
      
      console.log('✅ 자동화 스크립트 실행 완료')
      
      // 결과 스크린샷 저장
      const screenshotPath = await automation.takeScreenshot(`automation_result_${Date.now()}.png`)

      // 브라우저 종료 (선택적)
      setTimeout(async () => {
        await automation.closeBrowser()
      }, 5000) // 5초 후 자동 종료

      return NextResponse.json({
        success: true,
        message: '자동화 스크립트가 성공적으로 실행되었습니다.',
        data: {
          scriptFilename,
          screenshotPath,
          executionTime: new Date().toISOString()
        }
      })

    } catch (executionError) {
      console.error('❌ 스크립트 실행 중 오류:', executionError)
      
      // 오류 발생 시 스크린샷 저장
      await automation.takeScreenshot(`automation_error_${Date.now()}.png`)
      await automation.closeBrowser()
      
      return NextResponse.json({
        success: false,
        error: '스크립트 실행 중 오류가 발생했습니다.',
        details: executionError instanceof Error ? executionError.message : String(executionError)
      }, { status: 500 })
    }

  } catch (error) {
    console.error('❌ 자동화 실행 실패:', error)
    return NextResponse.json({
      success: false,
      error: '자동화 실행에 실패했습니다.',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}