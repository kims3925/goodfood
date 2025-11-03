import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { StrokePayAutomation } from '@/lib/strokepay-automation'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    const { excelFilePath, productIds } = await request.json()

    if (!excelFilePath || !productIds || !Array.isArray(productIds)) {
      return NextResponse.json({
        success: false,
        error: '필수 매개변수가 누락되었습니다.'
      }, { status: 400 })
    }

    // 스룩페이 자동화 인스턴스 생성
    const automation = new StrokePayAutomation()
    
    // 백그라운드에서 자동화 실행
    setImmediate(async () => {
      try {
        console.log('🚀 스룩페이 자동화 시작')
        
        // 1. 브라우저 시작
        await automation.startBrowser({ headless: true })
        
        // 2. 로그인 페이지로 이동
        await automation.navigateToLogin()
        
        // 3. 녹화된 자동화 스크립트 실행
        const { runStrokePayAutomation } = require('@/scripts/strokepay-recorded-20250904T123157.js')
        
        // 로그인 정보 설정
        const loginId = process.env.STROKEPAY_ID
        const loginPassword = process.env.STROKEPAY_PASSWORD
        
        if (!loginId || !loginPassword) {
          throw new Error('스룩페이 로그인 정보가 설정되지 않았습니다.')
        }

        // 사용자의 다운로드 폴더에서 엑셀 파일 찾기
        const os = require('os')
        const downloadsPath = path.join(os.homedir(), 'Downloads', excelFilePath)
        
        // 브라우저 컨텍스트에 파일 업로드를 위한 다운로드 경로 설정
        await automation.context?.addInitScript(`
          window.EXCEL_FILE_PATH = '${downloadsPath}';
          window.STROKEPAY_ID = '${loginId}';
          window.STROKEPAY_PASSWORD = '${loginPassword}';
        `)
        
        // 자동화 스크립트 실행 (수정된 버전)
        if (automation.page) {
          // 로그인 페이지로 이동
          await automation.page.goto('https://srookpay.com/member/login?ReturnUrl=%2fmember%2fadmin', {
            waitUntil: 'networkidle',
            timeout: 30000
          })
          await automation.page.waitForTimeout(2000)
          
          // 로그인 정보 입력
          await automation.page.fill('input[type="email"], input[name="email"], #email, #loginId', loginId)
          await automation.page.waitForTimeout(500)
          
          await automation.page.fill('input[type="password"], input[name="password"], #password, #loginPassword', loginPassword)
          await automation.page.waitForTimeout(500)
          
          // 로그인 버튼 클릭
          await automation.page.click('button[type="submit"], input[type="submit"], .login-btn, #loginBtn')
          await automation.page.waitForTimeout(3000)
          
          // 상품 업로드 페이지로 이동
          await automation.page.goto('https://srookpay.com/admin/product/upload', { 
            waitUntil: 'networkidle',
            timeout: 30000 
          })
          await automation.page.waitForTimeout(2000)
          
          // 파일 업로드
          const fileInput = await automation.page.$('input[type="file"]')
          if (fileInput) {
            await fileInput.setInputFiles(downloadsPath)
            console.log(`📤 엑셀 파일 업로드: ${downloadsPath}`)
            
            // 업로드 버튼 클릭
            await automation.page.click('button:has-text("업로드"), .upload-btn, #uploadBtn, [onclick*="upload"]')
            await automation.page.waitForTimeout(5000)
            
            console.log('✅ 엑셀 파일 업로드 완료')
          } else {
            throw new Error('파일 업로드 입력 요소를 찾을 수 없습니다.')
          }
        }
        
        // 6. 브라우저 종료
        await automation.closeBrowser()
        
        console.log(`🎯 ${productIds.length}개 상품 스룩페이 등록 완료`)
        
      } catch (error) {
        console.error('❌ 스룩페이 자동화 실행 오류:', error)
        await automation.closeBrowser()
      }
    })

    return NextResponse.json({
      success: true,
      message: `${productIds.length}개 상품의 스룩페이 등록을 시작했습니다.`,
      productCount: productIds.length
    })

  } catch (error) {
    console.error('스룩페이 자동화 API 오류:', error)
    return NextResponse.json({
      success: false,
      error: '스룩페이 자동화 실행에 실패했습니다.'
    }, { status: 500 })
  }
}