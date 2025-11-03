// 엑셀 생성 테스트 스크립트
require('dotenv').config({ path: '.env.local' })
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function testExcelGeneration() {
  try {
    console.log('📊 엑셀 생성 테스트 시작...')
    
    // 현재 등록된 상품 수 확인
    const productCount = await prisma.product.count({
      where: {
        status: { not: 'DELETED' }
      }
    })
    
    console.log(`📦 현재 등록된 상품 수: ${productCount}개`)
    
    if (productCount === 0) {
      console.log('❌ 테스트할 상품이 없습니다.')
      return
    }
    
    // 상품 목록 조회
    const products = await prisma.product.findMany({
      where: {
        status: { not: 'DELETED' }
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        title: true,
        hookingTitle: true,
        productCategory: true,
        wholesaleBandName: true,
        productCode: true,
        priceInfo: true,
        images: true,
        originalPrice: true,
        salePrice: true
      }
    })
    
    console.log('\n📋 상품 목록:')
    products.forEach((product, index) => {
      console.log(`${index + 1}. ${product.hookingTitle || product.title}`)
      console.log(`   - 카테고리: ${product.productCategory}`)
      console.log(`   - 소싱처: ${product.wholesaleBandName || '직접입력'}`)
      console.log(`   - 상품코드: ${product.productCode || '미생성'}`)
      
      // 옵션 정보 확인
      if (product.priceInfo) {
        try {
          const priceData = JSON.parse(product.priceInfo)
          if (priceData.processedPriceOptions && priceData.processedPriceOptions.length > 0) {
            console.log(`   - 옵션: ${priceData.processedPriceOptions.length}개`)
            priceData.processedPriceOptions.forEach((opt, idx) => {
              console.log(`     ${idx + 1}) ${opt.option || opt.name} - ${opt.originalPrice}원 → ${opt.salePrice}원`)
            })
          } else {
            console.log(`   - 기본가격: ${product.originalPrice}원 → ${product.salePrice}원`)
          }
        } catch (e) {
          console.log(`   - 기본가격: ${product.originalPrice}원 → ${product.salePrice}원`)
        }
      } else {
        console.log(`   - 기본가격: ${product.originalPrice}원 → ${product.salePrice}원`)
      }
      console.log('')
    })
    
    // 엑셀 생성 API 테스트
    console.log('🔄 엑셀 생성 API 호출 중...')
    
    const response = await fetch('http://localhost:3000/api/products/generate-excel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 실제로는 세션 쿠키가 필요하지만 테스트용으로는 생략
      }
    })
    
    if (response.ok) {
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('spreadsheet')) {
        console.log('✅ 엑셀 파일 생성 성공!')
        console.log(`📁 파일 크기: ${response.headers.get('content-length')} bytes`)
        
        // 파일 저장 (테스트용)
        const buffer = await response.arrayBuffer()
        const fs = require('fs')
        const filename = `test_strokepay_products_${new Date().toISOString().slice(0,10).replace(/-/g,'')}.xlsx`
        fs.writeFileSync(filename, Buffer.from(buffer))
        console.log(`💾 테스트 파일 저장됨: ${filename}`)
      } else {
        const errorData = await response.json()
        console.log('❌ 엑셀 생성 실패:', errorData.error)
      }
    } else {
      console.log('❌ API 호출 실패:', response.status, response.statusText)
      const errorText = await response.text()
      console.log('오류 내용:', errorText)
    }
    
  } catch (error) {
    console.error('❌ 테스트 오류:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testExcelGeneration()