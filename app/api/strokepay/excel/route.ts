import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import path from 'path'
import fs from 'fs/promises'

// 스룩페이 엑셀 양식에 맞춘 헤더
const STROKEPAY_HEADERS = [
  '순번',
  '카테고리',
  '상품명', 
  '상품요약정보',
  '판매상태',
  '재고수량',
  '공급가',
  '판매가',
  '배송비타입',
  '배송비',
  '몇개당 배송비반복',
  '옵션여부',
  '옵션값/공급가/판매가',
  '상품이미지URL',
  '상품상세정보',
  '과세유형'
]

export async function POST(request: NextRequest) {
  try {
    const { products } = await request.json()

    if (!products || products.length === 0) {
      return NextResponse.json(
        { error: '상품이 선택되지 않았습니다.' },
        { status: 400 }
      )
    }

    // 워크북 생성
    const wb = XLSX.utils.book_new()
    
    // 데이터 준비
    const data = products.map((product: any, index: number) => {
      // 옵션 정보 포맷팅 (옵션명/공급가/판매가 형식)
      let optionString = ''
      if (product.options && product.options.length > 0) {
        optionString = product.options
          .map((opt: any) => `${opt.name}/${opt.supplyPrice}/${opt.salePrice}`)
          .join('|')
      }

      // 이미지 URL 포맷팅 (여러 이미지는 | 로 구분)
      let imageUrls = ''
      if (product.images && product.images.length > 0) {
        imageUrls = product.images.join('|')
      }

      return [
        index + 1,                                    // 순번
        product.category || '기타',                   // 카테고리
        product.title,                                 // 상품명
        product.summary || product.title.substring(0, 50), // 상품요약정보
        '판매중',                                      // 판매상태
        product.stock || 100,                          // 재고수량
        product.originalPrice || 0,                    // 공급가
        product.salePrice || 0,                        // 판매가
        product.shippingType || '무료배송',           // 배송비타입
        product.shippingFee || 0,                      // 배송비
        1,                                              // 몇개당 배송비반복
        product.hasOptions ? 'Y' : 'N',                // 옵션여부
        optionString,                                   // 옵션값/공급가/판매가
        imageUrls,                                      // 상품이미지URL
        product.detailContent || product.aiContent || '', // 상품상세정보
        '과세'                                          // 과세유형
      ]
    })

    // 헤더를 첫 번째 행에 추가
    data.unshift(STROKEPAY_HEADERS)

    // 워크시트 생성
    const ws = XLSX.utils.aoa_to_sheet(data)

    // 컬럼 너비 설정
    ws['!cols'] = [
      { wch: 5 },   // 순번
      { wch: 15 },  // 카테고리
      { wch: 30 },  // 상품명
      { wch: 40 },  // 상품요약정보
      { wch: 10 },  // 판매상태
      { wch: 10 },  // 재고수량
      { wch: 12 },  // 공급가
      { wch: 12 },  // 판매가
      { wch: 12 },  // 배송비타입
      { wch: 10 },  // 배송비
      { wch: 15 },  // 몇개당 배송비반복
      { wch: 10 },  // 옵션여부
      { wch: 40 },  // 옵션값
      { wch: 50 },  // 상품이미지URL
      { wch: 100 }, // 상품상세정보
      { wch: 10 },  // 과세유형
    ]

    // 워크북에 워크시트 추가
    XLSX.utils.book_append_sheet(wb, ws, '상품목록')

    // 파일 생성
    const fileName = `strokepay_products_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`
    const filePath = path.join(process.cwd(), 'public', 'downloads', fileName)
    
    // downloads 디렉토리가 없으면 생성
    const downloadDir = path.join(process.cwd(), 'public', 'downloads')
    try {
      await fs.access(downloadDir)
    } catch {
      await fs.mkdir(downloadDir, { recursive: true })
    }

    // 파일 저장
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    await fs.writeFile(filePath, buffer)

    return NextResponse.json({
      success: true,
      fileName,
      downloadUrl: `/downloads/${fileName}`,
      productCount: products.length
    })

  } catch (error) {
    console.error('Excel generation error:', error)
    return NextResponse.json(
      { error: '엑셀 파일 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}