import { NextRequest, NextResponse } from 'next/server'
import { chromium } from 'playwright'
import path from 'path'
import fs from 'fs/promises'

// 스룩페이 로그인 정보 (환경변수에서 가져오기)
const STROKEPAY_ID = process.env.STROKEPAY_ID || ''
const STROKEPAY_PW = process.env.STROKEPAY_PW || ''
const STROKEPAY_URL = 'https://srookpay.com/newsrp/Main/Index'

export async function POST(request: NextRequest) {
  let browser = null
  
  try {
    const { fileName } = await request.json()
    
    if (!fileName) {
      return NextResponse.json(
        { error: '업로드할 파일이 지정되지 않았습니다.' },
        { status: 400 }
      )
    }

    // 파일 경로 확인
    const filePath = path.join(process.cwd(), 'public', 'downloads', fileName)
    
    try {
      await fs.access(filePath)
    } catch {
      return NextResponse.json(
        { error: '파일을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // Playwright 브라우저 시작
    browser = await chromium.launch({
      headless: false, // 개발 중에는 false로 설정하여 브라우저 동작 확인
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    })

    const page = await context.newPage()
    
    // 결과 저장용
    const results = {
      totalProducts: 0,
      successCount: 0,
      failedCount: 0,
      paymentLinks: [] as any[],
      errors: [] as any[]
    }

    try {
      // 1. 스룩페이 로그인 페이지로 이동
      await page.goto(STROKEPAY_URL, { waitUntil: 'networkidle' })
      
      // 2. 로그인 처리
      const isLoggedIn = await checkLoginStatus(page)
      
      if (!isLoggedIn) {
        // 로그인 필요
        await performLogin(page, STROKEPAY_ID, STROKEPAY_PW)
      }

      // 3. 상품 관리 메뉴로 이동
      await page.waitForTimeout(2000)
      
      // 메뉴 클릭 (실제 셀렉터는 페이지 분석 후 수정 필요)
      await page.click('text=상품관리')
      await page.waitForTimeout(1000)
      
      // 4. 대량등록 메뉴 클릭
      await page.click('text=대량등록')
      await page.waitForTimeout(2000)

      // 5. 엑셀 파일 업로드
      const fileInput = await page.locator('input[type="file"]')
      await fileInput.setInputFiles(filePath)
      
      // 6. 업로드 버튼 클릭
      await page.click('button:has-text("업로드")')
      
      // 7. 처리 대기 (진행 상황 모니터링)
      await page.waitForTimeout(5000) // 처리 시간 대기
      
      // 8. 결과 확인
      const resultText = await page.textContent('.upload-result') // 실제 셀렉터 수정 필요
      
      // 결과 파싱
      if (resultText) {
        // 성공/실패 개수 추출 (실제 형식에 맞게 수정 필요)
        const successMatch = resultText.match(/성공: (\d+)/)
        const failMatch = resultText.match(/실패: (\d+)/)
        
        if (successMatch) results.successCount = parseInt(successMatch[1])
        if (failMatch) results.failedCount = parseInt(failMatch[1])
      }
      
      results.totalProducts = results.successCount + results.failedCount

      // 9. 생성된 상품의 결제 링크 수집
      await page.click('text=상품목록')
      await page.waitForTimeout(2000)
      
      // 최근 등록된 상품들의 링크 수집 (실제 구조에 맞게 수정 필요)
      const products = await page.$$('.product-list-item')
      
      for (let i = 0; i < Math.min(products.length, 10); i++) {
        const product = products[i]
        const productName = await product.$eval('.product-name', el => el.textContent)
        const paymentLink = await product.$eval('.payment-link', el => el.getAttribute('href'))
        
        if (productName && paymentLink) {
          results.paymentLinks.push({
            id: `sp-${Date.now()}-${i}`,
            title: productName,
            link: paymentLink
          })
        }
      }

    } catch (pageError) {
      console.error('Page interaction error:', pageError)
      results.errors.push({
        product: '업로드 처리 중',
        reason: pageError.message
      })
    }

    await browser.close()

    return NextResponse.json({
      success: true,
      ...results
    })

  } catch (error) {
    console.error('Upload error:', error)
    
    if (browser) {
      await browser.close()
    }

    return NextResponse.json(
      { error: '업로드 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 로그인 상태 확인
async function checkLoginStatus(page: any): Promise<boolean> {
  try {
    // 로그인 상태를 확인할 수 있는 요소 체크
    const logoutButton = await page.$('text=로그아웃')
    return !!logoutButton
  } catch {
    return false
  }
}

// 로그인 수행
async function performLogin(page: any, id: string, password: string) {
  try {
    // ID 입력
    await page.fill('input[name="userid"]', id) // 실제 셀렉터 수정 필요
    
    // 비밀번호 입력
    await page.fill('input[name="password"]', password) // 실제 셀렉터 수정 필요
    
    // 로그인 버튼 클릭
    await page.click('button[type="submit"]') // 실제 셀렉터 수정 필요
    
    // 로그인 완료 대기
    await page.waitForNavigation({ waitUntil: 'networkidle' })
    
  } catch (error) {
    console.error('Login error:', error)
    throw new Error('로그인에 실패했습니다.')
  }
}