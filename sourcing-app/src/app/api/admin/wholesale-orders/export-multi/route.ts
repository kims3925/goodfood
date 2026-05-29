export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import ExcelJS from 'exceljs'

// Excel 시트명 제약: 31자 제한 + 금지문자 escape
// 금지문자: \ / ? * [ ] :
const INVALID_SHEET_CHARS = /[\\/?*[\]:]/g
function sanitizeSheetName(name: string, fallback: string): string {
  const base = (name || fallback).replace(INVALID_SHEET_CHARS, '_').trim()
  return (base || fallback).slice(0, 31)
}

// 시트명 중복 방지 (같은 이름이면 #2, #3 등 접미사)
function uniqueSheetName(used: Set<string>, name: string): string {
  if (!used.has(name)) {
    used.add(name)
    return name
  }
  for (let i = 2; i < 1000; i++) {
    const suffix = ` #${i}`
    const candidate = name.slice(0, 31 - suffix.length) + suffix
    if (!used.has(candidate)) {
      used.add(candidate)
      return candidate
    }
  }
  // 극단적 폴백
  const fallback = `Sheet_${used.size + 1}`
  used.add(fallback)
  return fallback
}

interface MultiRowData {
  channelId: number
  channelName: string
  no: number
  productName: string
  optionSummary: string
  quantity: number
  unitPrice: number
  totalPrice: number
  recipientName: string
  address: string
  recipientPhone: string
  memo: string
}

/**
 * GET /api/admin/wholesale-orders/export-multi?from=YYYY-MM-DD&to=YYYY-MM-DD&format=excel
 * 도매처별 발주 다중시트 엑셀 다운로드 (회원 + 비회원 주문 통합)
 * - 기간 내 WHOLESALE 채널별 주문을 시트로 분리
 * - 시트명 = 채널 이름 (31자/금지문자 escape)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const fromStr = searchParams.get('from')
    const toStr = searchParams.get('to')

    // 기간 파싱 (YYYY-MM-DD, KST 기준 자정 ~ 다음날 자정 직전)
    let fromDate: Date | null = null
    let toDate: Date | null = null
    if (fromStr) {
      const f = new Date(fromStr)
      if (!isNaN(f.getTime())) {
        f.setHours(0, 0, 0, 0)
        fromDate = f
      }
    }
    if (toStr) {
      const t = new Date(toStr)
      if (!isNaN(t.getTime())) {
        t.setHours(23, 59, 59, 999)
        toDate = t
      }
    }

    // paidAt 범위 필터
    const paidAtFilter: { gte?: Date; lte?: Date } = {}
    if (fromDate) paidAtFilter.gte = fromDate
    if (toDate) paidAtFilter.lte = toDate

    const productCondition = {
      userId: user.userId,
      product: {
        channel: {
          kind: 'WHOLESALE' as const,
          userId: user.userId,
        },
      },
    }

    // 1. 회원 주문 조회 (결제 완료, 기간 필터)
    const memberItems = await prisma.orderItem.findMany({
      where: {
        order: {
          paidAt:
            Object.keys(paidAtFilter).length > 0
              ? { ...paidAtFilter, not: null }
              : { not: null },
        },
        shopProduct: productCondition,
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
                deliveryMemo: true,
              },
            },
          },
        },
        shopProduct: {
          include: {
            product: {
              select: {
                channelId: true,
                channel: { select: { id: true, name: true } },
                variants: {
                  select: { optionSummary: true, wholesalePrice: true },
                },
              },
            },
          },
        },
        variant: {
          select: { optionSummary: true, wholesalePrice: true },
        },
      },
      orderBy: { order: { orderedAt: 'desc' } },
    })

    // 2. 비회원 주문 조회 (결제 완료, 기간 필터)
    const guestItems = await prisma.guestOrderItem.findMany({
      where: {
        guestOrder: {
          paidAt:
            Object.keys(paidAtFilter).length > 0
              ? { ...paidAtFilter, not: null }
              : { not: null },
        },
        shopProduct: productCondition,
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
                deliveryMemo: true,
              },
            },
          },
        },
        shopProduct: {
          include: {
            product: {
              select: {
                channelId: true,
                channel: { select: { id: true, name: true } },
                variants: {
                  select: { optionSummary: true, wholesalePrice: true },
                },
              },
            },
          },
        },
        variant: {
          select: { optionSummary: true, wholesalePrice: true },
        },
      },
      orderBy: { guestOrder: { orderedAt: 'desc' } },
    })

    // 채널별 그룹화
    const channelMap = new Map<
      number,
      { name: string; rows: MultiRowData[] }
    >()

    const addRow = (
      channelId: number,
      channelName: string,
      row: Omit<MultiRowData, 'channelId' | 'channelName' | 'no'>
    ) => {
      if (!channelMap.has(channelId)) {
        channelMap.set(channelId, { name: channelName, rows: [] })
      }
      const bucket = channelMap.get(channelId)!
      bucket.rows.push({
        channelId,
        channelName,
        no: bucket.rows.length + 1,
        ...row,
      })
    }

    // 회원 주문 변환
    for (const item of memberItems) {
      const channel = item.shopProduct?.product?.channel
      if (!channel) continue
      const wholesalePrice = getWholesalePrice(item)
      const totalPrice = wholesalePrice * item.quantity
      const addr = item.order.shippingAddress
      const fullAddress = addr
        ? `(${addr.postalCode || ''}) ${addr.address || ''}${addr.addressDetail ? ' ' + addr.addressDetail : ''}`.trim()
        : ''
      addRow(channel.id, channel.name, {
        productName: item.productName,
        optionSummary: item.optionSummary || '',
        quantity: item.quantity,
        unitPrice: wholesalePrice,
        totalPrice,
        recipientName: addr?.recipientName || '',
        address: fullAddress,
        recipientPhone: addr?.recipientPhone || '',
        memo: addr?.deliveryMemo || item.order.orderNumber,
      })
    }

    // 비회원 주문 변환
    for (const item of guestItems) {
      const channel = item.shopProduct?.product?.channel
      if (!channel) continue
      const wholesalePrice = getWholesalePrice(item)
      const totalPrice = wholesalePrice * item.quantity
      const addr = item.guestOrder.shippingAddress
      const fullAddress = addr
        ? `(${addr.postalCode || ''}) ${addr.address || ''}${addr.addressDetail ? ' ' + addr.addressDetail : ''}`.trim()
        : ''
      addRow(channel.id, channel.name, {
        productName: item.productName,
        optionSummary: item.optionSummary || '',
        quantity: item.quantity,
        unitPrice: wholesalePrice,
        totalPrice,
        recipientName: addr?.recipientName || item.guestOrder.guestName || '',
        address: fullAddress,
        recipientPhone:
          addr?.recipientPhone || item.guestOrder.guestPhone || '',
        memo: addr?.deliveryMemo || item.guestOrder.orderNumber,
      })
    }

    // 채널이 0개면 404
    if (channelMap.size === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '해당 기간 내 발주할 도매처 주문이 없습니다.',
        },
        { status: 404 }
      )
    }

    // 시트 순서: 주문 수가 많은 순 → 동률 시 이름 오름차순
    const sortedChannels = Array.from(channelMap.entries()).sort(
      ([, a], [, b]) => {
        if (b.rows.length !== a.rows.length) return b.rows.length - a.rows.length
        return a.name.localeCompare(b.name, 'ko')
      }
    )

    // 엑셀 워크북 생성
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'BandAuto'
    workbook.created = new Date()

    const usedNames = new Set<string>()

    for (let i = 0; i < sortedChannels.length; i++) {
      const [channelId, { name, rows }] = sortedChannels[i]
      const sheetNameBase = sanitizeSheetName(name, `채널_${channelId}`)
      const sheetName = uniqueSheetName(usedNames, sheetNameBase)
      const sheet = workbook.addWorksheet(sheetName)

      sheet.columns = [
        { header: '순번', key: 'no', width: 6 },
        { header: '상품명', key: 'productName', width: 30 },
        { header: '규격', key: 'optionSummary', width: 18 },
        { header: '수량', key: 'quantity', width: 6 },
        { header: '단가', key: 'unitPrice', width: 12 },
        { header: '합계', key: 'totalPrice', width: 12 },
        { header: '수령인', key: 'recipientName', width: 12 },
        { header: '배송지', key: 'address', width: 50 },
        { header: '연락처', key: 'recipientPhone', width: 15 },
        { header: '비고', key: 'memo', width: 24 },
      ]

      // 헤더 스타일링
      const headerRow = sheet.getRow(1)
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, size: 11 }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' },
        }
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        }
      })

      // 데이터 행
      let sumQty = 0
      let sumTotal = 0
      for (const r of rows) {
        const row = sheet.addRow({
          no: r.no,
          productName: r.productName,
          optionSummary: r.optionSummary,
          quantity: r.quantity,
          unitPrice: r.unitPrice,
          totalPrice: r.totalPrice,
          recipientName: r.recipientName,
          address: r.address,
          recipientPhone: r.recipientPhone,
          memo: r.memo,
        })
        row.getCell('quantity').numFmt = '#,##0'
        row.getCell('unitPrice').numFmt = '#,##0'
        row.getCell('totalPrice').numFmt = '#,##0'
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          }
          cell.alignment = { vertical: 'middle', wrapText: true }
        })
        sumQty += r.quantity
        sumTotal += r.totalPrice
      }

      // 합계 행
      const totalRow = sheet.addRow({
        no: '',
        productName: '합계',
        optionSummary: '',
        quantity: sumQty,
        unitPrice: '',
        totalPrice: sumTotal,
        recipientName: '',
        address: '',
        recipientPhone: '',
        memo: '',
      })
      totalRow.eachCell((cell) => {
        cell.font = { bold: true }
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFF0C0' },
        }
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        }
      })
      totalRow.getCell('quantity').numFmt = '#,##0'
      totalRow.getCell('totalPrice').numFmt = '#,##0'

      // 헤더 고정 + 자동필터
      sheet.views = [{ state: 'frozen', ySplit: 1 }]
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: sheet.columns.length },
      }
    }

    // 파일명 생성
    const fmtDate = (d: Date | null) => {
      if (!d) return ''
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }
    const fromTag = fromDate ? fmtDate(fromDate) : 'ALL'
    const toTag = toDate ? fmtDate(toDate) : 'ALL'
    const fileNameRaw = `BandAuto_발주_${fromTag}_${toTag}.xlsx`
    const fileName = encodeURIComponent(fileNameRaw)

    const buffer = await workbook.xlsx.writeBuffer()

    return new NextResponse(buffer, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${fileName}`,
      },
    })
  } catch (error) {
    console.error('다중시트 발주 엑셀 생성 실패:', error)
    return NextResponse.json(
      { success: false, error: '발주서 생성에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// 도매가 추출 헬퍼 (variantId가 null인 경우 product.variants에서 폴백)
function getWholesalePrice(item: {
  variant?: { wholesalePrice: unknown } | null
  optionSummary?: string | null
  shopProduct?: {
    product?: {
      variants?: { optionSummary: string | null; wholesalePrice: unknown }[]
    } | null
  } | null
}): number {
  let wholesalePrice = Number(item.variant?.wholesalePrice || 0)
  if (!item.variant && item.shopProduct?.product?.variants?.length) {
    if (item.optionSummary) {
      const matched = item.shopProduct.product.variants.find(
        (v) => v.optionSummary === item.optionSummary
      )
      if (matched) wholesalePrice = Number(matched.wholesalePrice || 0)
    }
    if (wholesalePrice === 0) {
      wholesalePrice = Number(
        item.shopProduct.product.variants[0].wholesalePrice || 0
      )
    }
  }
  return wholesalePrice
}
