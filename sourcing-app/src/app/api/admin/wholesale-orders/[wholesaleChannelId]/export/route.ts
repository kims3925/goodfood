export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import ExcelJS from 'exceljs'

// 엑셀 행 데이터 타입
interface ExcelRowData {
  timestamp: string          // 타임스탬프(날짜,시간)
  productName: string        // 상품및 제품명
  quantity: number           // 수량
  productAmount: number      // 상품금액 (도매가 × 수량)
  shippingFee: number        // 배송비 (합배송 단위 계산)
  totalAmount: number        // 합산금액 (상품금액 + 배송비)
  recipientName: string      // 배송받는분 이름
  recipientPhone: string     // 받는분 연락처
  fullAddress: string        // 배송지 주소
  senderName: string         // 보내는 사람(받는분과 다른경우)
  cashReceipt: string        // 현금영수증 신청
  email: string              // 이메일주소
  dateKey: string            // YYYY-MM-DD 형식의 날짜 키 (그룹화용)
}

/**
 * GET /api/admin/wholesale-orders/:wholesaleChannelId/export
 * 도매처별 발주서 엑셀 다운로드 (회원 + 비회원 주문 통합)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ wholesaleChannelId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const { wholesaleChannelId } = await params
    const channelId = parseInt(wholesaleChannelId)

    // 전체 이력 조회 (날짜 필터 제거)

    // 도매처 정보 조회
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      select: { id: true, name: true },
    })

    if (!channel) {
      return NextResponse.json(
        { success: false, error: '도매처를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 배송 시작 전 주문만 조회 (발주 대상)
    // PAID, PREPARING 상태만 포함 (SHIPPED 이후는 발주 완료)

    // 공통 쿼리 조건 (Product의 channelId 참조 - 소싱 출처인 도매처)
    const productCondition = {
      userId: user.userId,
      product: {
        channelId: channelId,
      },
    }

    // 1. 회원 주문 조회 (배송 시작 전)
    const memberItems = await prisma.orderItem.findMany({
      where: {
        order: {
          status: { in: ['PAID', 'PREPARING'] },
          paidAt: { not: null },
        },
        publishedProduct: productCondition,
      },
      include: {
        order: {
          select: {
            orderNumber: true,
            orderedAt: true,
            user: {
              select: {
                name: true,
                email: true,
              },
            },
            shippingAddress: {
              select: {
                recipientName: true,
                recipientPhone: true,
                postalCode: true,
                address: true,
                addressDetail: true,
              },
            },
          },
        },
        publishedProduct: {
          include: {
            product: {
              select: {
                shippingFee: true,
                bundleMaxQty: true,
                variants: {
                  select: {
                    optionSummary: true,
                    wholesalePrice: true,
                    bundleUnit: true,
                  },
                },
              },
            },
          },
        },
        variant: {
          select: {
            wholesalePrice: true,
            optionSummary: true,
            bundleUnit: true,
          },
        },
      },
      orderBy: {
        order: {
          orderedAt: 'desc',
        },
      },
    })

    // 2. 비회원 주문 조회 (배송 시작 전)
    const guestItems = await prisma.guestOrderItem.findMany({
      where: {
        guestOrder: {
          status: { in: ['PAID', 'PREPARING'] },
          paidAt: { not: null },
        },
        publishedProduct: productCondition,
      },
      include: {
        guestOrder: {
          select: {
            orderNumber: true,
            orderedAt: true,
            guestName: true,
            guestPhone: true,
            guestEmail: true,
            shippingAddress: {
              select: {
                recipientName: true,
                recipientPhone: true,
                postalCode: true,
                address: true,
                addressDetail: true,
              },
            },
          },
        },
        publishedProduct: {
          include: {
            product: {
              select: {
                shippingFee: true,
                bundleMaxQty: true,
                variants: {
                  select: {
                    optionSummary: true,
                    wholesalePrice: true,
                    bundleUnit: true,
                  },
                },
              },
            },
          },
        },
        variant: {
          select: {
            wholesalePrice: true,
            optionSummary: true,
            bundleUnit: true,
          },
        },
      },
      orderBy: {
        guestOrder: {
          orderedAt: 'desc',
        },
      },
    })

    // 통합 데이터 준비
    const excelRows: ExcelRowData[] = []

    // 회원 주문 변환
    for (const item of memberItems) {
      const wholesalePrice = getWholesalePrice(item)
      const productAmount = Number(wholesalePrice) * item.quantity
      const shippingFee = calculateShippingFee(item)
      const totalAmount = productAmount + shippingFee

      const addr = item.order.shippingAddress
      const fullAddress = addr?.addressDetail
        ? `(${addr.postalCode}) ${addr.address} ${addr.addressDetail}`
        : `(${addr?.postalCode || ''}) ${addr?.address || ''}`

      const orderDate = new Date(item.order.orderedAt)
      const dateKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}-${String(orderDate.getDate()).padStart(2, '0')}`
      const timestamp = `${dateKey} ${String(orderDate.getHours()).padStart(2, '0')}:${String(orderDate.getMinutes()).padStart(2, '0')}`

      const recipientName = addr?.recipientName || ''
      const orderUserName = (item.order as any).user?.name || ''
      const senderName = recipientName !== orderUserName && orderUserName ? orderUserName : ''

      excelRows.push({
        timestamp,
        productName: item.productName,
        quantity: item.quantity,
        productAmount,
        shippingFee,
        totalAmount,
        recipientName,
        recipientPhone: addr?.recipientPhone || '',
        fullAddress,
        senderName,
        cashReceipt: '',
        email: (item.order as any).user?.email || '',
        dateKey,
      })
    }

    // 비회원 주문 변환
    for (const item of guestItems) {
      const wholesalePrice = getWholesalePrice(item)
      const productAmount = Number(wholesalePrice) * item.quantity
      const shippingFee = calculateShippingFee(item)
      const totalAmount = productAmount + shippingFee

      const addr = item.guestOrder.shippingAddress
      const fullAddress = addr?.addressDetail
        ? `(${addr.postalCode}) ${addr.address} ${addr.addressDetail}`
        : `(${addr?.postalCode || ''}) ${addr?.address || ''}`

      const orderDate = new Date(item.guestOrder.orderedAt)
      const dateKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}-${String(orderDate.getDate()).padStart(2, '0')}`
      const timestamp = `${dateKey} ${String(orderDate.getHours()).padStart(2, '0')}:${String(orderDate.getMinutes()).padStart(2, '0')}`

      const recipientName = addr?.recipientName || item.guestOrder.guestName
      const guestName = item.guestOrder.guestName
      const senderName = recipientName !== guestName ? guestName : ''

      excelRows.push({
        timestamp,
        productName: item.productName,
        quantity: item.quantity,
        productAmount,
        shippingFee,
        totalAmount,
        recipientName,
        recipientPhone: addr?.recipientPhone || item.guestOrder.guestPhone,
        fullAddress,
        senderName,
        cashReceipt: '',
        email: item.guestOrder.guestEmail || '',
        dateKey,
      })
    }

    // 날짜순 정렬 (내림차순)
    excelRows.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    // 날짜별로 그룹화
    const groupedByDate = new Map<string, ExcelRowData[]>()
    for (const row of excelRows) {
      const existing = groupedByDate.get(row.dateKey) || []
      existing.push(row)
      groupedByDate.set(row.dateKey, existing)
    }

    // 날짜 키를 내림차순 정렬
    const sortedDateKeys = Array.from(groupedByDate.keys()).sort((a, b) => b.localeCompare(a))

    // 엑셀 생성
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('발주견적서')

    // 스타일 정의
    const headerStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, size: 11 },
      alignment: { horizontal: 'center', vertical: 'middle' },
      fill: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      },
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      },
    }

    const dateSeparatorStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, size: 12, color: { argb: 'FFFFFFFF' } },
      alignment: { horizontal: 'left', vertical: 'middle' },
      fill: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' },
      },
    }

    const subtotalStyle: Partial<ExcelJS.Style> = {
      font: { bold: true },
      fill: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD9E1F2' },
      },
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      },
    }

    const totalStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, size: 12 },
      fill: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFF0C0' },
      },
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      },
    }

    // 열 너비 설정
    sheet.getColumn(1).width = 18  // 타임스탬프
    sheet.getColumn(2).width = 40  // 상품및 제품명
    sheet.getColumn(3).width = 8   // 수량
    sheet.getColumn(4).width = 12  // 상품금액
    sheet.getColumn(5).width = 10  // 배송비
    sheet.getColumn(6).width = 12  // 합계
    sheet.getColumn(7).width = 12  // 배송받는분 이름
    sheet.getColumn(8).width = 15  // 받는분 연락처
    sheet.getColumn(9).width = 50  // 배송지 주소
    sheet.getColumn(10).width = 12 // 보내는 사람
    sheet.getColumn(11).width = 20 // 현금영수증 신청
    sheet.getColumn(12).width = 25 // 이메일주소

    // 타이틀
    sheet.mergeCells('A1:L1')
    const titleCell = sheet.getCell('A1')
    titleCell.value = '도매 발주견적서'
    titleCell.font = { bold: true, size: 16 }
    titleCell.alignment = { horizontal: 'center' }

    // 정보
    sheet.getCell('A2').value = `도매처: ${channel.name}`
    sheet.getCell('A3').value = `생성일시: ${new Date().toLocaleString('ko-KR')}`
    sheet.getCell('A4').value = `총 주문: 회원 ${memberItems.length}건 + 비회원 ${guestItems.length}건 = ${excelRows.length}건`
    sheet.getCell('A5').value = `총 발주일수: ${sortedDateKeys.length}일`

    let rowIndex = 7
    let grandTotalQty = 0
    let grandTotalProductAmount = 0
    let grandTotalShippingFee = 0
    let grandTotalAmount = 0

    // 날짜별 그룹 출력
    for (const dateKey of sortedDateKeys) {
      const dateRows = groupedByDate.get(dateKey) || []

      // 요일 계산
      const date = new Date(dateKey)
      const dayNames = ['일', '월', '화', '수', '목', '금', '토']
      const dayName = dayNames[date.getDay()]

      // 날짜 구분선
      sheet.mergeCells(`A${rowIndex}:L${rowIndex}`)
      const dateCell = sheet.getCell(`A${rowIndex}`)
      dateCell.value = `▼ ${dateKey} (${dayName}) - ${dateRows.length}건`
      Object.assign(dateCell, { style: dateSeparatorStyle })
      rowIndex++

      // 테이블 헤더
      const headerRow = sheet.getRow(rowIndex)
      headerRow.values = ['타임스탬프', '상품및 제품명', '수량', '상품금액', '배송비', '합계', '배송받는분 이름', '받는분 연락처', '배송지 주소', '보내는사람(받는분과 다른경우만 작성)', '현금영수증 신청', '이메일주소']
      headerRow.eachCell((cell) => {
        Object.assign(cell, { style: headerStyle })
      })
      rowIndex++

      // 해당 날짜의 데이터
      let dateTotalQty = 0
      let dateTotalProductAmount = 0
      let dateTotalShippingFee = 0
      let dateTotalAmount = 0

      for (const rowData of dateRows) {
        dateTotalQty += rowData.quantity
        dateTotalProductAmount += rowData.productAmount
        dateTotalShippingFee += rowData.shippingFee
        dateTotalAmount += rowData.totalAmount
        grandTotalQty += rowData.quantity
        grandTotalProductAmount += rowData.productAmount
        grandTotalShippingFee += rowData.shippingFee
        grandTotalAmount += rowData.totalAmount

        const row = sheet.getRow(rowIndex)
        row.values = [
          rowData.timestamp,
          rowData.productName,
          rowData.quantity,
          rowData.productAmount,
          rowData.shippingFee,
          rowData.totalAmount,
          rowData.recipientName,
          rowData.recipientPhone,
          rowData.fullAddress,
          rowData.senderName,
          rowData.cashReceipt,
          rowData.email,
        ]

        // 숫자 포맷
        row.getCell(3).numFmt = '#,##0'
        row.getCell(4).numFmt = '#,##0'
        row.getCell(5).numFmt = '#,##0'
        row.getCell(6).numFmt = '#,##0'

        // 테두리
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          }
        })

        rowIndex++
      }

      // 일별 소계
      const subtotalRow = sheet.getRow(rowIndex)
      subtotalRow.values = [`소계 (${dateKey})`, '', dateTotalQty, dateTotalProductAmount, dateTotalShippingFee, dateTotalAmount, '', '', '', '', '', '']
      subtotalRow.eachCell((cell) => {
        Object.assign(cell, { style: subtotalStyle })
      })
      subtotalRow.getCell(3).numFmt = '#,##0'
      subtotalRow.getCell(4).numFmt = '#,##0'
      subtotalRow.getCell(5).numFmt = '#,##0'
      subtotalRow.getCell(6).numFmt = '#,##0'
      rowIndex++

      // 빈 줄 추가 (날짜 그룹 사이)
      rowIndex++
    }

    // 총합계
    const totalRow = sheet.getRow(rowIndex)
    totalRow.values = ['총합계', '', grandTotalQty, grandTotalProductAmount, grandTotalShippingFee, grandTotalAmount, '', '', '', '', '', '']
    totalRow.eachCell((cell) => {
      Object.assign(cell, { style: totalStyle })
    })
    totalRow.getCell(3).numFmt = '#,##0'
    totalRow.getCell(4).numFmt = '#,##0'
    totalRow.getCell(5).numFmt = '#,##0'
    totalRow.getCell(6).numFmt = '#,##0'

    // 엑셀 파일 생성
    const buffer = await workbook.xlsx.writeBuffer()

    // 파일명 생성
    const today = new Date().toISOString().split('T')[0]
    const fileName = encodeURIComponent(`발주견적서_${channel.name}_${today}.xlsx`)

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${fileName}`,
      },
    })
  } catch (error) {
    console.error('발주서 엑셀 생성 실패:', error)
    return NextResponse.json(
      { success: false, error: '발주서 생성에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// 도매가 추출 헬퍼 함수
function getWholesalePrice(item: {
  variant?: { wholesalePrice: unknown } | null
  optionSummary?: string | null
  publishedProduct?: {
    product?: {
      variants?: { optionSummary: string | null; wholesalePrice: unknown }[]
    } | null
  } | null
}): number {
  let wholesalePrice = Number(item.variant?.wholesalePrice || 0)

  // variantId가 null인 경우 Product의 variants에서 찾기
  if (!item.variant && item.publishedProduct?.product?.variants?.length) {
    if (item.optionSummary) {
      const matchedVariant = item.publishedProduct.product.variants.find(
        v => v.optionSummary === item.optionSummary
      )
      if (matchedVariant) {
        wholesalePrice = Number(matchedVariant.wholesalePrice || 0)
      }
    }
    if (wholesalePrice === 0) {
      wholesalePrice = Number(item.publishedProduct.product.variants[0].wholesalePrice || 0)
    }
  }

  return wholesalePrice
}

// 합배송 단위 배송비 계산 헬퍼 함수
// 계산 공식: ceil((수량 * bundleUnit) / bundleMaxQty) * shippingFee
function calculateShippingFee(item: {
  quantity: number
  variant?: { bundleUnit?: number | null } | null
  publishedProduct?: {
    product?: {
      shippingFee?: number | null
      bundleMaxQty?: number | null
      variants?: { bundleUnit?: number | null }[]
    } | null
  } | null
}): number {
  const product = item.publishedProduct?.product
  if (!product) return 0

  const shippingFee = product.shippingFee || 0
  if (shippingFee === 0) return 0

  const bundleMaxQty = product.bundleMaxQty || 1
  const bundleUnit = item.variant?.bundleUnit || product.variants?.[0]?.bundleUnit || 1

  // 실제 묶음 단위 수량 계산 (예: 수량 3, bundleUnit 2 = 6개 단위)
  const totalUnits = item.quantity * bundleUnit

  // 합배송 묶음 수 계산 (예: 6개 / bundleMaxQty 4 = 2묶음)
  const bundleCount = Math.ceil(totalUnits / bundleMaxQty)

  return bundleCount * shippingFee
}
