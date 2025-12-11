import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import ExcelJS from 'exceljs'

// 엑셀 행 데이터 타입
interface ExcelRowData {
  productName: string
  optionSummary: string
  quantity: number
  wholesalePrice: number
  supplyAmount: number
  customerName: string
  customerPhone: string
  fullAddress: string
  orderedAt: string
  orderNumber: string
  isMember: boolean
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

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    if (!from || !to) {
      return NextResponse.json(
        { success: false, error: '기간(from, to)은 필수입니다.' },
        { status: 400 }
      )
    }

    const fromDate = new Date(from)
    fromDate.setHours(0, 0, 0, 0)
    const toDate = new Date(to)
    toDate.setHours(23, 59, 59, 999)

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

    // 결제완료(PAID)만 조회 (배송중/배송완료/취소 제외)

    // 공통 쿼리 조건
    const productCondition = {
      userId: user.userId,
      product: {
        collectedProduct: {
          post: {
            channelId: channelId,
          },
        },
      },
    }

    // 1. 회원 주문 조회
    const memberItems = await prisma.orderItem.findMany({
      where: {
        order: {
          status: 'PAID',
          paidAt: {
            not: null,
            gte: fromDate,
            lte: toDate,
          },
        },
        publishedProduct: productCondition,
      },
      include: {
        order: {
          select: {
            orderNumber: true,
            orderedAt: true,
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
              include: {
                variants: {
                  select: {
                    optionSummary: true,
                    wholesalePrice: true,
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
          },
        },
      },
      orderBy: {
        order: {
          orderedAt: 'desc',
        },
      },
    })

    // 2. 비회원 주문 조회
    const guestItems = await prisma.guestOrderItem.findMany({
      where: {
        guestOrder: {
          status: 'PAID',
          paidAt: {
            not: null,
            gte: fromDate,
            lte: toDate,
          },
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
              include: {
                variants: {
                  select: {
                    optionSummary: true,
                    wholesalePrice: true,
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
      const supplyAmount = Number(wholesalePrice) * item.quantity

      const addr = item.order.shippingAddress
      const fullAddress = addr?.addressDetail
        ? `(${addr.postalCode}) ${addr.address} ${addr.addressDetail}`
        : `(${addr?.postalCode || ''}) ${addr?.address || ''}`

      const orderDate = new Date(item.order.orderedAt)
      const orderedAt = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}-${String(orderDate.getDate()).padStart(2, '0')} ${String(orderDate.getHours()).padStart(2, '0')}:${String(orderDate.getMinutes()).padStart(2, '0')}`

      let optionSummary = item.optionSummary || item.variant?.optionSummary || null
      if (!optionSummary && item.publishedProduct?.product?.variants?.length) {
        optionSummary = item.publishedProduct.product.variants[0].optionSummary || null
      }

      excelRows.push({
        productName: item.productName,
        optionSummary: optionSummary || '-',
        quantity: item.quantity,
        wholesalePrice: Number(wholesalePrice),
        supplyAmount,
        customerName: addr?.recipientName || '',
        customerPhone: addr?.recipientPhone || '',
        fullAddress,
        orderedAt,
        orderNumber: item.order.orderNumber,
        isMember: true,
      })
    }

    // 비회원 주문 변환
    for (const item of guestItems) {
      const wholesalePrice = getWholesalePrice(item)
      const supplyAmount = Number(wholesalePrice) * item.quantity

      const addr = item.guestOrder.shippingAddress
      const fullAddress = addr?.addressDetail
        ? `(${addr.postalCode}) ${addr.address} ${addr.addressDetail}`
        : `(${addr?.postalCode || ''}) ${addr?.address || ''}`

      const orderDate = new Date(item.guestOrder.orderedAt)
      const orderedAt = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}-${String(orderDate.getDate()).padStart(2, '0')} ${String(orderDate.getHours()).padStart(2, '0')}:${String(orderDate.getMinutes()).padStart(2, '0')}`

      let optionSummary = item.optionSummary || item.variant?.optionSummary || null
      if (!optionSummary && item.publishedProduct?.product?.variants?.length) {
        optionSummary = item.publishedProduct.product.variants[0].optionSummary || null
      }

      const customerName = addr?.recipientName || item.guestOrder.guestName
      const customerPhone = addr?.recipientPhone || item.guestOrder.guestPhone

      excelRows.push({
        productName: item.productName,
        optionSummary: optionSummary || '-',
        quantity: item.quantity,
        wholesalePrice: Number(wholesalePrice),
        supplyAmount,
        customerName,
        customerPhone,
        fullAddress,
        orderedAt,
        orderNumber: item.guestOrder.orderNumber,
        isMember: false,
      })
    }

    // 날짜순 정렬
    excelRows.sort((a, b) => new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime())

    // 엑셀 생성
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('발주서')

    // 헤더 스타일
    const headerStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, size: 12 },
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

    // 타이틀
    sheet.mergeCells('A1:J1')
    const titleCell = sheet.getCell('A1')
    titleCell.value = '도매 발주서'
    titleCell.font = { bold: true, size: 16 }
    titleCell.alignment = { horizontal: 'center' }

    // 정보
    sheet.getCell('A2').value = `도매처: ${channel.name}`
    sheet.getCell('A3').value = `발주일: ${from}`
    sheet.getCell('A4').value = `생성일시: ${new Date().toLocaleString('ko-KR')}`
    sheet.getCell('A5').value = `총 주문: 회원 ${memberItems.length}건 + 비회원 ${guestItems.length}건 = ${excelRows.length}건`

    // 빈 줄
    sheet.getRow(6).values = []

    // 테이블 헤더
    const headerRow = sheet.getRow(7)
    headerRow.values = ['주문번호', '상품명', '옵션', '수량', '단가', '공급가액', '고객명', '연락처', '주소', '주문일시']
    headerRow.eachCell((cell) => {
      Object.assign(cell, { style: headerStyle })
    })

    // 열 너비 설정
    sheet.getColumn(1).width = 20 // 주문번호
    sheet.getColumn(2).width = 40 // 상품명
    sheet.getColumn(3).width = 20 // 옵션
    sheet.getColumn(4).width = 8  // 수량
    sheet.getColumn(5).width = 12 // 단가
    sheet.getColumn(6).width = 14 // 공급가액
    sheet.getColumn(7).width = 12 // 고객명
    sheet.getColumn(8).width = 15 // 연락처
    sheet.getColumn(9).width = 50 // 주소
    sheet.getColumn(10).width = 18 // 주문일시

    // 데이터
    let totalQty = 0
    let totalAmount = 0
    let rowIndex = 8

    for (const rowData of excelRows) {
      totalQty += rowData.quantity
      totalAmount += rowData.supplyAmount

      const row = sheet.getRow(rowIndex)
      row.values = [
        rowData.orderNumber,
        rowData.productName,
        rowData.optionSummary,
        rowData.quantity,
        rowData.wholesalePrice,
        rowData.supplyAmount,
        rowData.customerName,
        rowData.customerPhone,
        rowData.fullAddress,
        rowData.orderedAt,
      ]

      // 숫자 포맷
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

    // 합계
    const summaryRow = sheet.getRow(rowIndex)
    summaryRow.values = ['합계', '', '', totalQty, '', totalAmount, '', '', '', '']
    summaryRow.font = { bold: true }
    summaryRow.getCell(4).numFmt = '#,##0'
    summaryRow.getCell(6).numFmt = '#,##0'
    summaryRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFF0C0' },
      }
    })

    // 엑셀 파일 생성
    const buffer = await workbook.xlsx.writeBuffer()

    // 파일명 생성
    const fileName = encodeURIComponent(`발주서_${channel.name}_${from}_${to}.xlsx`)

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
