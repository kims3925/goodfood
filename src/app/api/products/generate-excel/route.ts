import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/domain/auth'
import prisma from '@/lib/database/client'
import * as XLSX from 'xlsx'

// 소싱처별 순번 매핑 - 더 포괄적인 매핑 규칙
const SOURCING_SITE_CODES = {
  '요한이네♧소매방': '01',
  'S  D  푸드': '02',
  'SD푸드': '02',
  '가족도매방': '03',
  '나은VIP소매방': '04',
  '초록이네 도매방': '05',
  '제이와이터 RETAIL BAND': '06',
  // 추가 소싱처들 매핑
  'DEFAULT': '01' // 기본값을 99에서 01로 변경
}

// 동적 순번 할당 함수
function getSourcingCode(wholesaleBandName: string, allBandNames: string[]): string {
  // 먼저 정적 매핑에서 확인
  for (const [bandName, code] of Object.entries(SOURCING_SITE_CODES)) {
    if (bandName !== 'DEFAULT' && wholesaleBandName.includes(bandName.replace(/[♧\s]/g, ''))) {
      return code
    }
  }
  
  // 정적 매핑에 없으면 동적으로 순번 할당
  const uniqueBandNames = [...new Set(allBandNames)].sort()
  const bandIndex = uniqueBandNames.indexOf(wholesaleBandName)
  
  if (bandIndex >= 0) {
    return String(bandIndex + 1).padStart(2, '0') // 1부터 시작하여 2자리로 패딩
  }
  
  return SOURCING_SITE_CODES.DEFAULT
}

// 카테고리 매핑 - B열용 (세부 카테고리)
const CATEGORY_MAPPING = {
  'SEAFOOD': '식품>수산물>생선>기타생선',
  'MEAT': '식품>축산물>기타육류', 
  'AGRICULTURE': '식품>농산물>과일>기타과일',
  'PROCESSED': '식품>가공식품>간편조리식',
  'OTHER': '식품>밀키트>세트요리'
}

// 전시 카테고리 매핑 - C열용 (기존 방식 유지)
const DISPLAY_CATEGORY_MAPPING = {
  'SEAFOOD': '수산품',
  'MEAT': '축산품', 
  'AGRICULTURE': '농산품',
  'PROCESSED': '가공품',
  'OTHER': '기타'
}

// 자체상품코드 생성 함수 (개선된 버전)
function generateProductCode(wholesaleBandName: string, date: Date, rowIndex: number, allBandNames: string[]): string {
  const siteCode = getSourcingCode(wholesaleBandName, allBandNames)
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '') // YYYYMMDD
  const rowStr = String(rowIndex).padStart(3, '0')
  return `${siteCode}${dateStr}${rowStr}`
}

// 옵션 정보 파싱 함수
function parseOptions(priceInfo: string | null) {
  if (!priceInfo) return { options: [], prices: [], originalPrices: [] }
  
  try {
    const data = JSON.parse(priceInfo)
    if (!data.processedPriceOptions || !Array.isArray(data.processedPriceOptions)) {
      return { options: [], prices: [], originalPrices: [] }
    }
    
    const options = data.processedPriceOptions.map((opt: any) => opt.option || opt.name || '기본옵션')
    const prices = data.processedPriceOptions.map((opt: any) => opt.salePrice || 0)
    const originalPrices = data.processedPriceOptions.map((opt: any) => opt.originalPrice || 0)
    
    return { options, prices, originalPrices }
  } catch (error) {
    return { options: [], prices: [], originalPrices: [] }
  }
}

// 배송비 유형 결정 함수
function getShippingType(shippingFee: number | null): string {
  if (!shippingFee || shippingFee === 0) {
    return '무료배송'
  }
  return `고정배송비/${shippingFee}`
}

// 배송비 결제 방식 결정 함수
function getShippingPaymentType(shippingFee: number | null): string {
  if (!shippingFee || shippingFee === 0) {
    return '' // 무료배송인 경우 빈 값
  }
  return '선결제' // 고정배송비인 경우 선결제
}

// 과세유형 결정 함수
function getTaxType(category: string | null): string {
  if (['SEAFOOD', 'MEAT', 'AGRICULTURE'].includes(category || '')) {
    return '영세'
  }
  return '과세'
}

// 이미지 URL 파싱 함수
function parseImages(images: string): string[] {
  try {
    const parsed = JSON.parse(images)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// HTML 상세정보 생성 함수
function generateDetailedHTML(hookingContent: string | null, images: string[]): string {
  let html = ''
  
  // 후킹 콘텐츠 추가 (폰트 15px, 가운데 정렬, 특정 문자에서 줄바꿈)
  if (hookingContent) {
    // 콤마, 느낌표, 마침표 뒤에서 줄바꿈
    const formattedContent = hookingContent
      .replace(/,/g, ',<br>')
      .replace(/!/g, '!<br>')
      .replace(/\./g, '.<br>')
      .replace(/\n/g, '<br>')
    
    html += `<div style="font-size: 15px; text-align: center; margin-bottom: 20px;">${formattedContent}</div>`
  }
  
  // 이미지 추가
  images.forEach(imageUrl => {
    html += `<img src="${imageUrl}" style="max-width: 100%; margin-bottom: 10px;" />`
  })
  
  return html
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    // 요청 본문에서 선택된 상품 ID 목록 가져오기
    const body = await request.json().catch(() => ({}))
    const { productIds } = body

    const userId = parseInt(session.user.id, 10)
    let products

    if (productIds && Array.isArray(productIds) && productIds.length > 0) {
      // 선택된 상품만 조회
      products = await prisma.product.findMany({
        where: {
          id: { in: productIds },
          userId: userId,
          status: { not: 'DELETED' }
        },
        include: {
          images: true,
          category: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
    } else {
      // 선택된 상품이 없으면 모든 활성 상품 조회
      products = await prisma.product.findMany({
        where: {
          userId: userId,
          status: { not: 'DELETED' }
        },
        include: {
          images: true,
          category: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
    }

    if (products.length === 0) {
      return NextResponse.json({
        success: false,
        error: '엑셀로 내보낼 상품이 없습니다.'
      }, { status: 400 })
    }

    // 엑셀 워크북 생성
    const workbook = XLSX.utils.book_new()
    
    // 헤더 행 (1행 - 필터용)
    const headers = [
      '자체상품코드', // A
      '카테고리분류', // B
      '전시카테고리', // C
      '상품명', // D
      '', // E
      '상품요약', // F
      '', // G
      '', // H
      '', // I
      '판매상태', // J
      '재고수량', // K
      '상품목록노출여부', // L
      '공급가', // M
      '판매가격', // N
      '', // O
      '옵션형태', // P
      '옵션명', // Q
      '옵션값', // R
      '', // S
      '옵션공급가', // T
      '옵션금액', // U
      '', '', '', '', '', '', '', '', '', '', '', // V-AF
      '결제수단', // AG
      '상품이미지URL', // AH
      '상품상세정보', // AI
      '배송비유형', // AJ
      '', // AK
      '과세유형' // AL
    ]

    // 데이터 배열 준비
    const data = [headers]
    const currentDate = new Date()
    
    // 모든 밴드 이름 목록 수집 (동적 순번 할당용)
    const allBandNames = products.map(product => product.wholesaleBandName || 'DEFAULT')

    // 각 상품을 엑셀 행으로 변환
    products.forEach((product, index) => {
      // 자체상품코드 생성 (2행부터 시작이므로 index + 2)
      const productCode = generateProductCode(product.wholesaleBandName || 'DEFAULT', currentDate, index + 2, allBandNames)
      
      // 옵션 정보 파싱
      const { options, prices, originalPrices } = parseOptions(product.priceInfo)
      
      // 최저가 찾기
      let minOriginalPrice = originalPrices.length > 0 ? Math.min(...originalPrices) : product.originalPrice
      let minSalePrice = prices.length > 0 ? Math.min(...prices) : product.salePrice
      
      // 이미지 파싱
      const images = product.images.map(img => img.url)
      
      // 상품명 (후킹제목 우선)
      const productName = product.hookingTitle || product.title
      
      // 상품요약 (40자 이내)
      const summary = productName.slice(0, 40)
      
      // 카테고리 정보
      const categoryCode = product.category?.code || 'OTHER'
      const detailedCategory = CATEGORY_MAPPING[categoryCode as keyof typeof CATEGORY_MAPPING] || '식품>밀키트>세트요리'
      const displayCategory = DISPLAY_CATEGORY_MAPPING[categoryCode as keyof typeof DISPLAY_CATEGORY_MAPPING] || '기타'
      
      // 옵션 처리 로직 개선
      let optionForm, optionName, optionValues, optionSupplyPrices, optionAmounts
      
      if (options.length <= 1) {
        // 옵션이 1개 이하인 경우 - P열을 비움
        optionForm = ''
        optionName = ''
        optionValues = ''
        optionSupplyPrices = ''
        optionAmounts = ''
      } else {
        // 옵션이 2개 이상인 경우 - 일반으로 입력
        optionForm = '일반'
        optionName = productName // 상품요약부분의 "제목" 사용
        
        // 가격 기준으로 옵션들을 오름차순 정렬
        type SortedOption = {option: string, originalPrice: number, salePrice: number}
        const sortedOptions = options.map((option: string, index: number) => ({
          option: option,
          originalPrice: originalPrices[index],
          salePrice: prices[index]
        })).sort((a: SortedOption, b: SortedOption) => a.salePrice - b.salePrice) // 판매가 기준으로 오름차순 정렬

        // 정렬된 옵션에서 데이터 추출
        const sortedOptionNames = sortedOptions.map((item: SortedOption) => item.option)
        const sortedOriginalPrices = sortedOptions.map((item: SortedOption) => item.originalPrice)
        const sortedSalePrices = sortedOptions.map((item: SortedOption) => item.salePrice)
        
        optionValues = sortedOptionNames.join(',')
        
        // 첫 번째 옵션(최저가)은 공급가와 판매가격을 "0"으로 설정
        const adjustedSupplyPrices = [0, ...sortedOriginalPrices.slice(1).map((price: number) =>
          price - sortedOriginalPrices[0] // 첫 번째 옵션 대비 추가 금액만
        )]

        const adjustedOptionAmounts = [0, ...sortedSalePrices.slice(1).map((price: number) =>
          price - sortedSalePrices[0] // 첫 번째 옵션 대비 추가 금액만
        )]
        
        optionSupplyPrices = adjustedSupplyPrices.join(',')
        optionAmounts = adjustedOptionAmounts.join(',')
        
        // 기준 가격을 정렬된 최저가로 업데이트
        minOriginalPrice = sortedOriginalPrices[0]
        minSalePrice = sortedSalePrices[0]
      }

      const row = [
        productCode, // A2: 자체상품코드
        detailedCategory, // B2: 카테고리분류 (세부 카테고리)
        displayCategory, // C2: 전시카테고리 (기존 방식)
        productName, // D2: 상품명
        '', // E2
        summary, // F2: 상품요약
        '', // G2
        '', // H2
        '', // I2
        '판매중', // J2: 판매상태
        9999, // K2: 재고수량
        'on', // L2: 상품목록노출여부
        minOriginalPrice, // M2: 공급가
        minSalePrice, // N2: 판매가격
        '', // O2
        optionForm, // P2: 옵션형태 (on/off)
        optionName, // Q2: 옵션명 (상품명)
        optionValues, // R2: 옵션값 (옵션 목록)
        '', // S2
        optionSupplyPrices, // T2: 옵션공급가 (첫번째는 0, 나머지는 차액)
        optionAmounts, // U2: 옵션금액 (첫번째는 0, 나머지는 차액)
        ...Array(11).fill(''), // V2-AF2
        '네이버페이,카카오페이,애플페이,신용카드,무통장입금', // AG2: 결제수단
        images[0] || '', // AH2: 상품이미지URL
        generateDetailedHTML(product.hookingContent, images), // AI2: 상품상세정보
        getShippingType(product.shippingFee), // AJ2: 배송비유형
        getShippingPaymentType(product.shippingFee), // AK2: 배송비결제
        getTaxType(product.category?.code || null) // AL2: 과세유형
      ]
      
      data.push(row)
      
      // 자체상품코드를 DB에 업데이트 (기존 코드가 없는 경우만)
      if (!product.productCode) {
        prisma.product.update({
          where: { id: product.id },
          data: { productCode }
        }).catch(console.error) // 비동기 실행
      }
    })

    // 워크시트 생성
    const worksheet = XLSX.utils.aoa_to_sheet(data)
    
    // 워크시트를 워크북에 추가
    XLSX.utils.book_append_sheet(workbook, worksheet, '상품목록')
    
    // 엑셀 파일을 Buffer로 생성
    const buffer = XLSX.write(workbook, { 
      bookType: 'xlsx', 
      type: 'buffer' 
    })

    // 파일명 생성 (날짜 포함)
    const fileName = `strokepay_products_${currentDate.toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`

    // 응답 반환
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`
      }
    })

  } catch (error) {
    console.error('엑셀 생성 오류:', error)
    return NextResponse.json({
      success: false,
      error: '엑셀 파일 생성에 실패했습니다.'
    }, { status: 500 })
  }
}