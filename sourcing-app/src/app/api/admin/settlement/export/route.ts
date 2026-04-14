export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import ExcelJS from 'exceljs'

/**
 * 정산서 양식 타입
 * - jangter: 장터사회적협동조합 (수익 10%, 과세/면세 구분)
 * - haeyang: 해양수산 (수익 + 수수료 1,500원 고정, 날짜 구분)
 */
type SettlementType = 'jangter' | 'haeyang'

interface SettlementRow {
  productName: string
  optionSummary: string | null
  quantity: number
  recipientName: string
  recipientPhone: string
  fullAddress: string
  saleAmount: number        // 판매가 (고객이 낸 금액)
  paymentMethod: string     // CARD or BANK_TRANSFER 등
  orderDate: Date
  remark: string
}

/**
 * GET /api/admin/settlement/export
 * 정산서 Excel 다운로드
 *
 * Query params:
 *   - channelId: 도매 채널 ID
 *   - startDate: 시작일 (YYYY-MM-DD)
 *   - endDate: 종료일 (YYYY-MM-DD)
 *   - type: 'jangter' | 'haeyang'
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const channelId = parseInt(searchParams.get('channelId') || '0')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const type = (searchParams.get('type') || 'jangter') as SettlementType

    if (!channelId || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'channelId, startDate, endDate 파라미터가 필요합니다.' },
        { status: 400 }
      )
    }

    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      select: { id: true, name: true, kind: true },
    })

    if (!channel) {
      return NextResponse.json({ success: false, error: '채널을 찾을 수 없습니다.' }, { status: 404 })
    }

    const start = new Date(startDate)
    start.setHours(0, 0, 0, 0)
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)

    const productCondition = {
      userId: user.userId,
      product: { channelId },
    }

    const dateFilter = { gte: start, lte: end }

    // 회원 주문 조회
    const memberItems = await prisma.orderItem.findMany({
      where: {
        order: {
          paidAt: { not: null },
          orderedAt: dateFilter,
          status: { notIn: ['PENDING', 'CANCELLED'] },
        },
        shopProduct: productCondition,
      },
      include: {
        order: {
          select: {
            orderNumber: true, orderedAt: true, status: true,
            payment: { select: { method: true } },
            shippingAddress: {
              select: {
                recipientName: true, recipientPhone: true,
                postalCode: true, address: true, addressDetail: true,
              },
            },
          },
        },
        shopProduct: {
          include: {
            product: {
              select: { wholesalePrice: true },
            },
          },
        },
      },
      orderBy: { order: { orderedAt: 'asc' } },
    })

    // 비회원 주문 조회
    const guestItems = await prisma.guestOrderItem.findMany({
      where: {
        guestOrder: {
          paidAt: { not: null },
          orderedAt: dateFilter,
          status: { notIn: ['PENDING', 'CANCELLED'] },
        },
        shopProduct: productCondition,
      },
      include: {
        guestOrder: {
          select: {
            orderNumber: true, orderedAt: true, status: true,
            payment: { select: { method: true } },
            shippingAddress: {
              select: {
                recipientName: true, recipientPhone: true,
                postalCode: true, address: true, addressDetail: true,
              },
            },
          },
        },
        shopProduct: {
          include: {
            product: {
              select: { wholesalePrice: true },
            },
          },
        },
      },
      orderBy: { guestOrder: { orderedAt: 'asc' } },
    })

    // 통합 데이터
    const rows: SettlementRow[] = []

    for (const item of memberItems) {
      const addr = item.order.shippingAddress
      const fullAddress = addr
        ? `[${addr.postalCode}] ${addr.address}${addr.addressDetail ? ` ${addr.addressDetail}` : ''}`
        : ''

      const method = item.order.payment?.method || 'BANK_TRANSFER'
      const isCard = method === 'CARD'

      rows.push({
        productName: item.productName + (item.optionSummary ? ` ${item.optionSummary}` : ''),
        optionSummary: item.optionSummary,
        quantity: item.quantity,
        recipientName: addr?.recipientName || '',
        recipientPhone: addr?.recipientPhone || '',
        fullAddress,
        saleAmount: Number(item.totalPrice),
        paymentMethod: isCard ? 'CARD' : 'BANK',
        orderDate: new Date(item.order.orderedAt),
        remark: isCard ? '카드 당사에서 정산' : '',
      })
    }

    for (const item of guestItems) {
      const addr = item.guestOrder.shippingAddress
      const fullAddress = addr
        ? `[${addr.postalCode}] ${addr.address}${addr.addressDetail ? ` ${addr.addressDetail}` : ''}`
        : ''

      const method = item.guestOrder.payment?.method || 'BANK_TRANSFER'
      const isCard = method === 'CARD'

      rows.push({
        productName: item.productName + (item.optionSummary ? ` ${item.optionSummary}` : ''),
        optionSummary: item.optionSummary,
        quantity: item.quantity,
        recipientName: addr?.recipientName || '',
        recipientPhone: addr?.recipientPhone || '',
        fullAddress,
        saleAmount: Number(item.totalPrice),
        paymentMethod: isCard ? 'CARD' : 'BANK',
        orderDate: new Date(item.guestOrder.orderedAt),
        remark: isCard ? '카드 당사에서 정산' : '',
      })
    }

    rows.sort((a, b) => a.orderDate.getTime() - b.orderDate.getTime())

    let buffer: Buffer
    if (type === 'haeyang') {
      buffer = await generateHaeyangSettlement(channel.name, startDate, endDate, rows)
    } else {
      buffer = await generateJangterSettlement(channel.name, startDate, endDate, rows)
    }

    const dateLabel = `${startDate.replace(/-/g, '').slice(2)}`
    const fileName = encodeURIComponent(`${channel.name}정산서_${dateLabel}.xlsx`)

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${fileName}`,
      },
    })
  } catch (error) {
    console.error('정산서 생성 실패:', error)
    return NextResponse.json({ success: false, error: '정산서 생성에 실패했습니다.' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────
// 스타일 공통
// ─────────────────────────────────────────────────

const NUM_FMT = '_-* #,##0_-;\\-* #,##0_-;_-* "-"_-;_-@_-'
const FONT_NAME = '맑은 고딕'

function thinBorder(): Partial<ExcelJS.Borders> {
  const s: Partial<ExcelJS.Border> = { style: 'thin' }
  return { top: s, left: s, bottom: s, right: s }
}

function headerFont(bold = false, size = 11): Partial<ExcelJS.Font> {
  return { name: FONT_NAME, size, bold }
}

function centerAlign(): Partial<ExcelJS.Alignment> {
  return { horizontal: 'center', vertical: 'middle', wrapText: true }
}

function vcenterAlign(): Partial<ExcelJS.Alignment> {
  return { vertical: 'middle', wrapText: true }
}

function formatDateKr(d: Date): string {
  return `${d.getMonth() + 1}월${d.getDate()}일`
}

function formatPeriodTitle(startDate: string, endDate: string): string {
  const s = new Date(startDate)
  const e = new Date(endDate)
  return `${formatDateKr(s)}~${formatDateKr(e)}`
}

// ─────────────────────────────────────────────────
// 장터 정산서 생성
// ─────────────────────────────────────────────────

async function generateJangterSettlement(
  channelName: string,
  startDate: string,
  endDate: string,
  rows: SettlementRow[]
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const sheetName = endDate.replace(/-/g, '').slice(2)
  const ws = wb.addWorksheet(sheetName)

  // 열 너비
  ws.getColumn('A').width = 4.4
  ws.getColumn('B').width = 5.3
  ws.getColumn('C').width = 34
  ws.getColumn('D').width = 5.3
  ws.getColumn('E').width = 7.1
  ws.getColumn('F').width = 15.6
  ws.getColumn('G').width = 57
  ws.getColumn('H').width = 12
  ws.getColumn('I').width = 10.5
  ws.getColumn('J').width = 9.5
  ws.getColumn('K').width = 8.4
  ws.getColumn('L').width = 20

  // Row 1: 타이틀
  ws.mergeCells('A1:L1')
  const titleCell = ws.getCell('A1')
  titleCell.value = `${formatPeriodTitle(startDate, endDate)} ${channelName} 정산서`
  titleCell.font = { name: FONT_NAME, size: 16, bold: true }
  titleCell.alignment = centerAlign()
  ws.getRow(1).height = 39.75

  // Row 2: 빈 행
  ws.getRow(2).height = 22.5

  // Row 3-4: 헤더
  ws.getRow(3).height = 26.25
  ws.getRow(4).height = 26.25

  const headerCells = [
    { cell: 'A3', value: 'NO', merge: 'A3:A4' },
    { cell: 'B3', value: '구분', merge: 'B3:B4' },
    { cell: 'C3', value: '상품명', merge: 'C3:C4' },
    { cell: 'D3', value: '수량', merge: 'D3:D4' },
    { cell: 'E3', value: '받는분', merge: 'E3:E4' },
    { cell: 'F3', value: '전화번호', merge: 'F3:F4' },
    { cell: 'G3', value: '주소', merge: 'G3:G4' },
    { cell: 'H3', value: '판매', merge: 'H3:I3' },
    { cell: 'J3', value: '정산\n내역', merge: 'J3:J4' },
    { cell: 'K3', value: `${channelName}\n수익`, merge: 'K3:K4' },
    { cell: 'L3', value: '비고', merge: 'L3:L4' },
  ]

  for (const h of headerCells) {
    if (h.merge) ws.mergeCells(h.merge)
    const c = ws.getCell(h.cell)
    c.value = h.value
    c.font = headerFont(h.cell === 'J3')
    c.alignment = centerAlign()
    c.border = thinBorder()
    if (['H3', 'J3', 'K3'].includes(h.cell)) c.numFmt = NUM_FMT
  }

  // Row 4 sub-headers
  const subHeaders = [
    { cell: 'H4', value: '계좌이체' },
    { cell: 'I4', value: '카드' },
  ]
  for (const sh of subHeaders) {
    const c = ws.getCell(sh.cell)
    c.value = sh.value
    c.font = headerFont()
    c.alignment = centerAlign()
    c.border = thinBorder()
    c.numFmt = NUM_FMT
  }

  // 데이터 행
  const dataStartRow = 5
  let rowIdx = dataStartRow

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const row = ws.getRow(rowIdx)
    row.height = 30.75

    const isCard = r.paymentMethod === 'CARD'
    // 장터 수익 = 판매가의 약 10% (반올림 500단위)
    const profit = Math.round(r.saleAmount * 0.1 / 500) * 500
    // 카드 결제는 정산내역이 음수 (당사에서 카드수수료 부담)
    const settlementFormula = isCard
      ? -profit   // 카드: 음수 (수수료 3.5% 반영된 금액)
      : `=+H${rowIdx}-K${rowIdx}` // 계좌: 판매가 - 수익

    ws.getCell(`A${rowIdx}`).value = i + 1
    ws.getCell(`B${rowIdx}`).value = '면세'
    ws.getCell(`C${rowIdx}`).value = r.productName
    ws.getCell(`D${rowIdx}`).value = r.quantity > 1 ? r.quantity : null
    ws.getCell(`E${rowIdx}`).value = r.recipientName
    ws.getCell(`F${rowIdx}`).value = r.recipientPhone
    ws.getCell(`G${rowIdx}`).value = r.fullAddress

    if (isCard) {
      ws.getCell(`I${rowIdx}`).value = r.saleAmount
    } else {
      ws.getCell(`H${rowIdx}`).value = r.saleAmount
    }

    ws.getCell(`J${rowIdx}`).value = settlementFormula
    ws.getCell(`K${rowIdx}`).value = profit
    ws.getCell(`L${rowIdx}`).value = r.remark

    // 스타일 적용
    for (const col of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']) {
      const cell = ws.getCell(`${col}${rowIdx}`)
      cell.font = headerFont(['H', 'I', 'J'].includes(col))
      cell.border = thinBorder()
      cell.alignment = ['A', 'B', 'E', 'F'].includes(col) ? centerAlign() : vcenterAlign()
      if (['H', 'I', 'J', 'K'].includes(col)) cell.numFmt = NUM_FMT
    }

    rowIdx++
  }

  // 합계 행
  const sumRow = rowIdx
  ws.getRow(sumRow).height = 36.75
  ws.getCell(`G${sumRow}`).value = '합계'
  ws.getCell(`G${sumRow}`).font = headerFont(true)
  ws.getCell(`G${sumRow}`).alignment = centerAlign()
  ws.getCell(`G${sumRow}`).border = thinBorder()

  for (const col of ['H', 'I', 'J', 'K']) {
    const c = ws.getCell(`${col}${sumRow}`)
    c.value = { formula: `SUM(${col}${dataStartRow}:${col}${sumRow - 1})` }
    c.font = headerFont(true)
    c.numFmt = NUM_FMT
    c.alignment = vcenterAlign()
    c.border = thinBorder()
  }

  // 입금액 안내
  const noteRow1 = sumRow + 1
  ws.getRow(noteRow1).height = 31.9
  ws.getCell(`G${noteRow1}`).value = `* ${channelName}에서 입금할 금액은 아래 합계입니다`
  ws.getCell(`G${noteRow1}`).font = headerFont()
  // L열에 총 판매합계 (H합계 + I합계)
  ws.getCell(`L${noteRow1}`).value = { formula: `I${sumRow}+H${sumRow}` }
  ws.getCell(`L${noteRow1}`).numFmt = NUM_FMT

  const noteRow2 = sumRow + 2
  ws.getRow(noteRow2).height = 29.65
  ws.getCell(`G${noteRow2}`).value = '* 카드수수료(3.5%)는 저희가 부담하고 판매수익은 10%로 동일하게 했습니다'
  ws.getCell(`G${noteRow2}`).font = headerFont()

  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf)
}

// ─────────────────────────────────────────────────
// 해양수산 정산서 생성
// ─────────────────────────────────────────────────

async function generateHaeyangSettlement(
  channelName: string,
  startDate: string,
  endDate: string,
  rows: SettlementRow[]
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const sheetName = endDate.replace(/-/g, '').slice(2)
  const ws = wb.addWorksheet(sheetName)

  // 열 너비
  ws.getColumn('A').width = 4
  ws.getColumn('B').width = 9.3
  ws.getColumn('C').width = 37
  ws.getColumn('D').width = 5.3
  ws.getColumn('E').width = 10
  ws.getColumn('F').width = 14.4
  ws.getColumn('G').width = 55
  ws.getColumn('H').width = 11.5
  ws.getColumn('I').width = 10.5
  ws.getColumn('J').width = 10.5
  ws.getColumn('K').width = 9.8
  ws.getColumn('L').width = 9
  ws.getColumn('M').width = 17.5

  // Row 1: 타이틀
  ws.mergeCells('A1:M1')
  const titleCell = ws.getCell('A1')
  titleCell.value = `${formatPeriodTitle(startDate, endDate)} ${channelName} 정산서`
  titleCell.font = { name: FONT_NAME, size: 16, bold: true }
  titleCell.alignment = centerAlign()
  ws.getRow(1).height = 39.75

  // Row 2-3: 헤더
  ws.getRow(2).height = 26.25
  ws.getRow(3).height = 26.25

  const headerCells = [
    { cell: 'A2', value: 'NO', merge: 'A2:A3' },
    { cell: 'B2', value: '구분', merge: 'B2:B3' },
    { cell: 'C2', value: '상품명', merge: 'C2:C3' },
    { cell: 'D2', value: '수량', merge: 'D2:D3' },
    { cell: 'E2', value: '받는분', merge: 'E2:E3' },
    { cell: 'F2', value: '전화번호', merge: 'F2:F3' },
    { cell: 'G2', value: '주소', merge: 'G2:G3' },
    { cell: 'H2', value: '판매', merge: 'H2:I2' },
    { cell: 'J2', value: '정산 내역', merge: 'J2:K2' },
    { cell: 'L2', value: `${channelName}\n수익`, merge: 'L2:L3' },
    { cell: 'M2', value: '비고', merge: 'M2:M3' },
  ]

  for (const h of headerCells) {
    if (h.merge) ws.mergeCells(h.merge)
    const c = ws.getCell(h.cell)
    c.value = h.value
    c.font = headerFont(['H2', 'J2'].includes(h.cell))
    c.alignment = centerAlign()
    c.border = thinBorder()
    if (['H2', 'J2', 'L2'].includes(h.cell)) c.numFmt = NUM_FMT
  }

  // Row 3 sub-headers
  const subHeaders = [
    { cell: 'H3', value: '통장입금' },
    { cell: 'I3', value: '카드' },
    { cell: 'J3', value: '정산원가' },
    { cell: 'K3', value: '수수료' },
  ]
  for (const sh of subHeaders) {
    const c = ws.getCell(sh.cell)
    c.value = sh.value
    c.font = headerFont()
    c.alignment = centerAlign()
    c.border = thinBorder()
    if (['J3'].includes(sh.cell)) c.numFmt = NUM_FMT
  }

  // 데이터 행
  const dataStartRow = 4
  let rowIdx = dataStartRow
  const FEE_PER_ORDER = 1500

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const row = ws.getRow(rowIdx)
    row.height = 36

    const isCard = r.paymentMethod === 'CARD'
    const dateStr = formatDateKr(r.orderDate)

    // 해양수산 수익 계산 (판매가에서 적절한 마진)
    // 수수료 1,500원 고정 + 나머지가 수익
    // 정산원가 = 판매가 - 해양수익
    const profit = Math.round(r.saleAmount * 0.1 / 500) * 500
    const adjustedProfit = Math.max(profit, 1500)

    ws.getCell(`A${rowIdx}`).value = i + 1
    ws.getCell(`B${rowIdx}`).value = dateStr
    ws.getCell(`C${rowIdx}`).value = r.productName
    ws.getCell(`D${rowIdx}`).value = r.quantity > 1 ? r.quantity : null
    ws.getCell(`E${rowIdx}`).value = r.recipientName
    ws.getCell(`F${rowIdx}`).value = r.recipientPhone
    ws.getCell(`G${rowIdx}`).value = r.fullAddress

    if (isCard) {
      ws.getCell(`I${rowIdx}`).value = r.saleAmount
    } else {
      ws.getCell(`H${rowIdx}`).value = r.saleAmount
    }

    // 정산원가 = 판매가 - 해양수익
    ws.getCell(`J${rowIdx}`).value = { formula: isCard ? `0-L${rowIdx}` : `+H${rowIdx}-L${rowIdx}` }
    ws.getCell(`K${rowIdx}`).value = FEE_PER_ORDER
    ws.getCell(`L${rowIdx}`).value = adjustedProfit
    ws.getCell(`M${rowIdx}`).value = r.remark

    // 스타일 적용
    for (const col of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M']) {
      const cell = ws.getCell(`${col}${rowIdx}`)
      cell.font = headerFont(false)
      cell.border = thinBorder()
      cell.alignment = ['A', 'B', 'E', 'F', 'H', 'I', 'J', 'K', 'L', 'M'].includes(col)
        ? centerAlign()
        : { ...vcenterAlign(), horizontal: 'left' }
      if (['H', 'I', 'J', 'K', 'L'].includes(col)) cell.numFmt = NUM_FMT
    }

    rowIdx++
  }

  // 합계 행
  const sumRow = rowIdx
  ws.getRow(sumRow).height = 36
  ws.getCell(`G${sumRow}`).value = '합계'
  ws.getCell(`G${sumRow}`).font = headerFont(true)
  ws.getCell(`G${sumRow}`).alignment = centerAlign()
  ws.getCell(`G${sumRow}`).border = thinBorder()

  for (const col of ['H', 'I', 'J', 'K', 'L']) {
    const c = ws.getCell(`${col}${sumRow}`)
    c.value = { formula: `SUM(${col}${dataStartRow}:${col}${sumRow - 1})` }
    c.font = headerFont(true)
    c.numFmt = NUM_FMT
    c.alignment = centerAlign()
    c.border = thinBorder()
  }

  // 정산입금액 행
  const noteRow1 = sumRow + 1
  ws.getRow(noteRow1).height = 33.4
  ws.mergeCells(`H${noteRow1}:I${noteRow1}`)
  ws.getCell(`H${noteRow1}`).value = '정산입금액'
  ws.getCell(`H${noteRow1}`).font = headerFont(true)
  ws.getCell(`H${noteRow1}`).alignment = centerAlign()
  // 정산입금액 = 정산원가 합계 + 수수료 합계
  ws.getCell(`J${noteRow1}`).value = { formula: `+J${sumRow}+K${sumRow}` }
  ws.getCell(`J${noteRow1}`).numFmt = NUM_FMT
  ws.getCell(`J${noteRow1}`).font = headerFont(true)
  ws.getCell(`K${noteRow1}`).value = '(정산원가+수수료)'
  ws.getCell(`K${noteRow1}`).font = headerFont(false, 9)

  // 카드수수료 안내
  const noteRow2 = sumRow + 2
  ws.getRow(noteRow2).height = 25.15
  ws.getCell(`G${noteRow2}`).value = '* 카드수수료(3.5%)는 저희가 부담하고 판매수익은 10%로 동일하게 했습니다'
  ws.getCell(`G${noteRow2}`).font = headerFont()

  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf)
}
