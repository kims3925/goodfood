import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'

interface ExportItem {
  orderItemId: number
  orderNumber: string
  productName: string
  optionSummary: string | null
  quantity: number
  unitPrice: number
  totalAmount: number
  memo: string
}

interface ExportRequest {
  wholesaleChannelId: number
  wholesaleChannelName: string
  periodStart: string | null
  periodEnd: string | null
  items: ExportItem[]
}

/**
 * 도매처 발주서 엑셀 생성 API (테스트용)
 */
export async function POST(request: NextRequest) {
  try {
    const body: ExportRequest = await request.json()
    const { wholesaleChannelName, periodStart, periodEnd, items } = body

    if (!items || items.length === 0) {
      return NextResponse.json(
        { success: false, error: '발주 항목이 없습니다.' },
        { status: 400 }
      )
    }

    // 엑셀 워크북 생성
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Bandauto'
    workbook.created = new Date()

    const sheet = workbook.addWorksheet('발주서')

    // 컬럼 너비 설정
    sheet.columns = [
      { width: 5 },   // A: 번호
      { width: 20 },  // B: 주문번호
      { width: 40 },  // C: 상품명
      { width: 25 },  // D: 옵션
      { width: 10 },  // E: 수량
      { width: 15 },  // F: 단가
      { width: 15 },  // G: 공급금액
      { width: 25 },  // H: 비고
    ]

    // 스타일 정의
    const titleStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, size: 16 },
      alignment: { horizontal: 'center', vertical: 'middle' },
    }

    const headerStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, size: 11, color: { argb: 'FFFFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      fill: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4A5568' },
      },
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      },
    }

    const cellStyle: Partial<ExcelJS.Style> = {
      alignment: { vertical: 'middle' },
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      },
    }

    const totalStyle: Partial<ExcelJS.Style> = {
      font: { bold: true },
      alignment: { vertical: 'middle' },
      fill: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEDF2F7' },
      },
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      },
    }

    // 제목
    sheet.mergeCells('A1:H1')
    const titleCell = sheet.getCell('A1')
    titleCell.value = '도매 발주서'
    titleCell.style = titleStyle
    sheet.getRow(1).height = 30

    // 발주 정보
    let currentRow = 3

    sheet.getCell(`A${currentRow}`).value = '도매처:'
    sheet.getCell(`A${currentRow}`).font = { bold: true }
    sheet.getCell(`B${currentRow}`).value = wholesaleChannelName

    currentRow++
    sheet.getCell(`A${currentRow}`).value = '발주기간:'
    sheet.getCell(`A${currentRow}`).font = { bold: true }
    const periodText = periodStart && periodEnd
      ? `${periodStart} ~ ${periodEnd}`
      : periodStart || periodEnd || '전체'
    sheet.getCell(`B${currentRow}`).value = periodText

    currentRow++
    sheet.getCell(`A${currentRow}`).value = '생성일시:'
    sheet.getCell(`A${currentRow}`).font = { bold: true }
    sheet.getCell(`B${currentRow}`).value = new Date().toLocaleString('ko-KR')

    currentRow++
    sheet.getCell(`A${currentRow}`).value = '발주건수:'
    sheet.getCell(`A${currentRow}`).font = { bold: true }
    sheet.getCell(`B${currentRow}`).value = `${items.length}건`

    // 빈 행
    currentRow += 2

    // 테이블 헤더
    const headerRow = sheet.getRow(currentRow)
    const headers = ['번호', '주문번호', '상품명', '옵션', '수량', '단가', '공급금액', '비고']
    headers.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1)
      cell.value = header
      cell.style = headerStyle
    })
    headerRow.height = 25
    currentRow++

    // 데이터 행
    let totalQuantity = 0
    let totalAmount = 0

    items.forEach((item, index) => {
      const row = sheet.getRow(currentRow)
      row.getCell(1).value = index + 1
      row.getCell(1).style = { ...cellStyle, alignment: { horizontal: 'center', vertical: 'middle' } }

      row.getCell(2).value = item.orderNumber || ''
      row.getCell(2).style = cellStyle

      row.getCell(3).value = item.productName || ''
      row.getCell(3).style = cellStyle

      row.getCell(4).value = item.optionSummary || '-'
      row.getCell(4).style = cellStyle

      row.getCell(5).value = item.quantity
      row.getCell(5).style = { ...cellStyle, alignment: { horizontal: 'center', vertical: 'middle' } }

      row.getCell(6).value = item.unitPrice
      row.getCell(6).style = { ...cellStyle, alignment: { horizontal: 'right', vertical: 'middle' } }
      row.getCell(6).numFmt = '#,##0'

      row.getCell(7).value = item.totalAmount
      row.getCell(7).style = { ...cellStyle, alignment: { horizontal: 'right', vertical: 'middle' } }
      row.getCell(7).numFmt = '#,##0'

      row.getCell(8).value = item.memo || ''
      row.getCell(8).style = cellStyle

      totalQuantity += item.quantity
      totalAmount += item.totalAmount

      currentRow++
    })

    // 합계 행
    const totalRow = sheet.getRow(currentRow)
    totalRow.getCell(1).value = ''
    totalRow.getCell(2).value = ''
    totalRow.getCell(3).value = ''
    totalRow.getCell(4).value = '합계'
    totalRow.getCell(4).style = { ...totalStyle, alignment: { horizontal: 'right', vertical: 'middle' } }

    totalRow.getCell(5).value = totalQuantity
    totalRow.getCell(5).style = { ...totalStyle, alignment: { horizontal: 'center', vertical: 'middle' } }

    totalRow.getCell(6).value = ''
    totalRow.getCell(6).style = totalStyle

    totalRow.getCell(7).value = totalAmount
    totalRow.getCell(7).style = { ...totalStyle, alignment: { horizontal: 'right', vertical: 'middle' } }
    totalRow.getCell(7).numFmt = '#,##0'

    totalRow.getCell(8).value = ''
    totalRow.getCell(8).style = totalStyle

    // 1~4번 컬럼 합계행에도 스타일 적용
    for (let i = 1; i <= 3; i++) {
      totalRow.getCell(i).style = totalStyle
    }

    totalRow.height = 25

    // 엑셀 파일을 버퍼로 생성
    const buffer = await workbook.xlsx.writeBuffer()

    // 파일명 생성
    const today = new Date().toISOString().split('T')[0]
    const filename = encodeURIComponent(`발주서_${wholesaleChannelName}_${today}.xlsx`)

    // 응답 반환
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('엑셀 생성 실패:', error)
    return NextResponse.json(
      { success: false, error: '엑셀 생성에 실패했습니다.' },
      { status: 500 }
    )
  }
}
