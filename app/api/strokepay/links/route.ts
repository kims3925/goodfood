import { NextRequest, NextResponse } from 'next/server'
import { chromium } from 'playwright'

const STROKEPAY_ID = process.env.STROKEPAY_ID || ''
const STROKEPAY_PW = process.env.STROKEPAY_PW || ''
const STROKEPAY_URL = 'https://srookpay.com/newsrp/Main/Index'

export async function GET(request: NextRequest) {
  let browser = null
  
  try {
    // Playwright 브라우저 시작
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    })

    const page = await context.newPage()
    
    // 결과 저장용
    const paymentLinks = []

    try {
      // 1. 스룩페이 로그인
      await page.goto(STROKEPAY_URL, { waitUntil: 'networkidle' })
      
      // 로그인 상태 확인 및 로그인
      const isLoggedIn = await checkLoginStatus(page)
      
      if (!isLoggedIn) {
        await performLogin(page, STROKEPAY_ID, STROKEPAY_PW)
      }

      // 2. 상품 목록 페이지로 이동
      await page.waitForTimeout(2000)
      await page.click('text=상품관리')
      await page.waitForTimeout(1000)
      await page.click('text=상품목록')
      await page.waitForTimeout(2000)

      // 3. 상품 목록 수집 (페이지네이션 고려)
      let hasNextPage = true
      let pageNum = 1
      const maxPages = 5 // 최대 5페이지까지만 수집

      while (hasNextPage && pageNum <= maxPages) {
        // 현재 페이지의 상품들 수집
        const products = await page.$$eval('.product-row', (rows: any[]) => {
          return rows.map(row => {
            const productCode = row.querySelector('.product-code')?.textContent || ''
            const productName = row.querySelector('.product-name')?.textContent || ''
            const price = row.querySelector('.product-price')?.textContent || ''
            const status = row.querySelector('.product-status')?.textContent || ''
            const linkElement = row.querySelector('.payment-link')
            const paymentLink = linkElement?.getAttribute('href') || ''
            const shortLink = linkElement?.getAttribute('data-short-link') || ''
            const createdAt = row.querySelector('.created-date')?.textContent || ''
            
            return {
              productCode,
              productName,
              price,
              status,
              paymentLink,
              shortLink,
              createdAt
            }
          })
        })

        // 수집한 상품들을 결과에 추가
        products.forEach((product, index) => {
          // 상태 판단
          let linkStatus = 'active'
          if (product.status?.includes('품절')) {
            linkStatus = 'expired'
          } else if (product.status?.includes('판매종료')) {
            linkStatus = 'used'
          }

          paymentLinks.push({
            id: `${pageNum}-${index}`,
            productName: product.productName,
            productCode: product.productCode,
            link: product.paymentLink || `https://strokepay.com/pay/${product.productCode}`,
            shortLink: product.shortLink || `strk.pay/${product.productCode}`,
            price: parseInt(product.price?.replace(/[^0-9]/g, '') || '0'),
            status: linkStatus,
            createdAt: product.createdAt,
            usedCount: Math.floor(Math.random() * 20), // 임시 데이터
            maxUse: 100,
            expiresAt: getExpireDate(product.createdAt)
          })
        })

        // 다음 페이지 확인
        const nextButton = await page.$('.pagination .next:not(.disabled)')
        if (nextButton) {
          await nextButton.click()
          await page.waitForTimeout(2000)
          pageNum++
        } else {
          hasNextPage = false
        }
      }

    } catch (pageError) {
      console.error('Page interaction error:', pageError)
    }

    await browser.close()

    return NextResponse.json({
      success: true,
      links: paymentLinks,
      total: paymentLinks.length
    })

  } catch (error) {
    console.error('Link collection error:', error)
    
    if (browser) {
      await browser.close()
    }

    return NextResponse.json(
      { error: '결제 링크 수집 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 로그인 상태 확인
async function checkLoginStatus(page: any): Promise<boolean> {
  try {
    const logoutButton = await page.$('text=로그아웃')
    return !!logoutButton
  } catch {
    return false
  }
}

// 로그인 수행
async function performLogin(page: any, id: string, password: string) {
  try {
    await page.fill('input[name="userid"]', id)
    await page.fill('input[name="password"]', password)
    await page.click('button[type="submit"]')
    await page.waitForNavigation({ waitUntil: 'networkidle' })
  } catch (error) {
    console.error('Login error:', error)
    throw new Error('로그인에 실패했습니다.')
  }
}

// 만료일 계산 (생성일로부터 30일)
function getExpireDate(createdAt: string): string {
  const date = new Date(createdAt || Date.now())
  date.setDate(date.getDate() + 30)
  return date.toISOString().split('T')[0]
}