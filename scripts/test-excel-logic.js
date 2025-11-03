// 엑셀 생성 로직 직접 테스트
require('dotenv').config({ path: '.env.local' })
const { PrismaClient } = require('@prisma/client')
const XLSX = require('xlsx')

const prisma = new PrismaClient()

// 소싱처별 순번 매핑
const SOURCING_SITE_CODES = {
  '요한이네♧소매방': '01',
  'S  D  푸드': '02',
  '가족도매방': '03',
  '폐쇄몰VIP도매': '04',
  '초록이네': '05',
  '나은 상품 공급방': '06',
  'DEFAULT': '99'
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

// 자체상품코드 생성 함수
function generateProductCode(wholesaleBandName, date, rowIndex) {
  const siteCode = SOURCING_SITE_CODES[wholesaleBandName] || SOURCING_SITE_CODES.DEFAULT
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '') // YYYYMMDD
  const rowStr = String(rowIndex).padStart(3, '0')
  return `${siteCode}${dateStr}${rowStr}`
}

// 옵션 정보 파싱 함수
function parseOptions(priceInfo) {
  if (!priceInfo) return { options: [], prices: [], originalPrices: [] }
  
  try {
    const data = JSON.parse(priceInfo)
    if (!data.processedPriceOptions || !Array.isArray(data.processedPriceOptions)) {
      return { options: [], prices: [], originalPrices: [] }
    }
    
    const options = data.processedPriceOptions.map(opt => opt.option || opt.name || '기본옵션')
    const prices = data.processedPriceOptions.map(opt => opt.salePrice || 0)
    const originalPrices = data.processedPriceOptions.map(opt => opt.originalPrice || 0)
    
    return { options, prices, originalPrices }
  } catch (error) {
    return { options: [], prices: [], originalPrices: [] }
  }
}

// 배송비 유형 결정 함수
function getShippingType(shippingFee) {
  if (!shippingFee || shippingFee === 0) {
    return '무료배송'
  }
  return `고정배송비/${shippingFee}`
}

// 배송비 결제 방식 결정 함수
function getShippingPaymentType(shippingFee) {
  if (!shippingFee || shippingFee === 0) {
    return '' // 무료배송인 경우 빈 값
  }
  return '선결제' // 고정배송비인 경우 선결제
}

// 과세유형 결정 함수
function getTaxType(category) {
  if (['SEAFOOD', 'MEAT', 'AGRICULTURE'].includes(category || '')) {
    return '영세'
  }
  return '과세'
}

// 이미지 URL 파싱 함수
function parseImages(images) {
  try {
    const parsed = JSON.parse(images)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// HTML 상세정보 생성 함수
function generateDetailedHTML(hookingContent, images) {
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

async function testExcelLogic() {
  try {
    console.log('📊 엑셀 로직 직접 테스트 시작...')
    
    // 상품 데이터 조회
    const products = await prisma.product.findMany({
      where: {
        status: { not: 'DELETED' }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    console.log(`📦 상품 수: ${products.length}개`)

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
      ...Array(11).fill(''), // V-AF
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

    console.log('\n📋 엑셀 데이터 생성 중...')

    // 각 상품을 엑셀 행으로 변환
    products.forEach((product, index) => {
      // 자체상품코드 생성 (2행부터 시작이므로 index + 2)
      const productCode = generateProductCode(product.wholesaleBandName || 'DEFAULT', currentDate, index + 2)
      
      // 옵션 정보 파싱
      const { options, prices, originalPrices } = parseOptions(product.priceInfo)
      
      // 최저가 찾기
      const minOriginalPrice = originalPrices.length > 0 ? Math.min(...originalPrices) : product.originalPrice
      const minSalePrice = prices.length > 0 ? Math.min(...prices) : product.salePrice
      
      // 이미지 파싱
      const images = parseImages(product.images)
      
      // 상품명 (후킹제목 우선)
      const productName = product.hookingTitle || product.title
      
      // 상품요약 (40자 이내)
      const summary = productName.slice(0, 40)
      
      // 카테고리 정보
      const detailedCategory = CATEGORY_MAPPING[product.productCategory] || '식품>밀키트>세트요리'
      const displayCategory = DISPLAY_CATEGORY_MAPPING[product.productCategory] || '기타'
      
      console.log(`${index + 1}. ${productName}`)
      console.log(`   코드: ${productCode}`)
      console.log(`   세부 카테고리: ${detailedCategory}`)
      console.log(`   전시 카테고리: ${displayCategory}`)
      console.log(`   옵션: ${options.join(', ')}`)
      console.log(`   최저가: ${minOriginalPrice}원 → ${minSalePrice}원`)
      console.log(`   배송비: ${getShippingType(product.shippingFee)}`)
      console.log(`   과세: ${getTaxType(product.productCategory)}`)
      console.log('')
      
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
        '일반', // P2: 옵션형태
        '종류', // Q2: 옵션명
        options.join(','), // R2: 옵션값
        '', // S2
        originalPrices.join(','), // T2: 옵션공급가
        prices.join(','), // U2: 옵션금액
        ...Array(11).fill(''), // V2-AF2
        '네이버페이,카카오페이,애플페이,신용카드,무통장입금', // AG2: 결제수단
        images[0] || '', // AH2: 상품이미지URL
        generateDetailedHTML(product.hookingContent, images), // AI2: 상품상세정보
        getShippingType(product.shippingFee), // AJ2: 배송비유형
        getShippingPaymentType(product.shippingFee), // AK2: 배송비결제
        getTaxType(product.productCategory) // AL2: 과세유형
      ]
      
      data.push(row)
    })

    // 워크시트 생성
    const worksheet = XLSX.utils.aoa_to_sheet(data)
    
    // 워크시트를 워크북에 추가
    XLSX.utils.book_append_sheet(workbook, worksheet, '상품목록')
    
    // 파일명 생성 (날짜 + 시간 포함)
    const fileName = `strokepay_products_updated_${currentDate.toISOString().slice(0, 10).replace(/-/g, '')}_${currentDate.getHours()}${currentDate.getMinutes()}.xlsx`
    
    // 엑셀 파일 저장
    XLSX.writeFile(workbook, fileName)
    
    console.log('✅ 엑셀 파일 생성 성공!')
    console.log(`📁 파일명: ${fileName}`)
    console.log(`📊 총 ${products.length}개 상품 처리 완료`)
    
    // 상품코드 DB 업데이트
    console.log('\n🔄 상품코드 DB 업데이트 중...')
    let updatedCount = 0
    
    for (let i = 0; i < products.length; i++) {
      const product = products[i]
      if (!product.productCode) {
        const productCode = generateProductCode(product.wholesaleBandName || 'DEFAULT', currentDate, i + 2)
        await prisma.product.update({
          where: { id: product.id },
          data: { productCode }
        })
        updatedCount++
      }
    }
    
    console.log(`✅ ${updatedCount}개 상품의 상품코드 업데이트 완료`)
    
  } catch (error) {
    console.error('❌ 테스트 오류:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testExcelLogic()