/**
 * 외부주문 텍스트 → 자동 추출 + GuestOrder 생성 서비스
 * (BandAuto SaaS Phase 4 — 외부주문 간소화 입력 + AI 챗 자동 주문화)
 *
 * 입력: 자유 텍스트 (전화/카톡/밴드댓글로 받은 주문 문자열)
 *      예) "포항물회 2개 보내주세요. 김영자 010-1111-2222 서울시 강남구 ..."
 *
 * 처리:
 *   1) Claude API 로 텍스트에서 {items[], recipient{name, phone, address}, memo} 추출
 *   2) ShopProduct 매칭 시도 (productName contains 검색) — 매칭 실패면 customItem 으로 저장
 *   3) GuestOrder PENDING 으로 생성. source=MANUAL/CHAT/KAKAO 중 인자로 받음.
 *
 * 호출 경로:
 *   - /sourcing/order/external 페이지 (수동 텍스트 입력, source=MANUAL)
 *   - inbox.service.ts hook (AI 챗 자동변환, source=CHAT 또는 KAKAO)
 */

import prisma from '@bandauto/db'
import { callClaudeJson } from '@/modules/ai/claude.client'

export type ExternalOrderSource = 'MANUAL' | 'CHAT' | 'KAKAO'
export type ExternalOrderKind = 'RETAIL' | 'WHOLESALE'

export interface ExtractedItem {
  productName: string
  quantity: number
  unitPriceHint?: number | null
}

export interface ExtractedOrder {
  items: ExtractedItem[]
  recipient: {
    name?: string | null
    phone?: string | null
    address?: string | null
    addressDetail?: string | null
    postalCode?: string | null
  }
  memo?: string | null
}

const EXTRACT_SYSTEM = `당신은 한국 수산물/농산물/식품 셀러의 자동 주문 어시스턴트입니다.
고객이 자유 형식으로 보낸 주문 메시지에서 상품/수량/배송지 정보를 정확히 추출하세요.

추출 규칙:
- 상품명: 도매방 게시글의 상품명에 매칭되도록 가능한 한 핵심 키워드 보존 (예: "포항물회 1kg", "통영 굴 2팩")
- 수량: 정수. "한 개" → 1, "두 박스" → 2, "5kg" → 1 (kg 은 옵션이지 수량이 아님)
- 단가 힌트: 메시지에 명시된 금액이 있으면만 채움 (없으면 null)
- 수령인: "받는사람 / 받는분 / 수령" 등으로 표시된 이름 우선, 없으면 발신자 이름
- 전화번호: 010-XXXX-XXXX / 01XXXXXXXXX 패턴 모두 인식
- 주소: 시/도 단위부터 상세주소까지 합쳐서 address 1줄, 아파트 동/호수 등 상세는 addressDetail 분리
- 메모: 합배송/요청사항/도착희망일 등 자유 텍스트는 memo 에 보존`

/**
 * 자유 텍스트 → 구조화된 주문 데이터로 변환.
 * Claude API 키 미설정이거나 추출 실패 시 throw.
 */
export async function extractOrderFromText(
  userId: number,
  text: string
): Promise<ExtractedOrder> {
  const trimmed = (text || '').trim()
  if (!trimmed) {
    throw new Error('주문 텍스트가 비어 있습니다.')
  }

  const prompt = `다음 고객 주문 메시지에서 주문 정보를 추출해 주세요.

[고객 메시지]
${trimmed}

[응답 JSON 형식]
{
  "items": [
    { "productName": "string", "quantity": number, "unitPriceHint": number | null }
  ],
  "recipient": {
    "name": "string | null",
    "phone": "string | null",
    "address": "string | null",
    "addressDetail": "string | null",
    "postalCode": "string | null"
  },
  "memo": "string | null"
}`

  const result = await callClaudeJson<ExtractedOrder>(userId, prompt, {
    system: EXTRACT_SYSTEM,
    maxTokens: 1024,
  })

  // 검증 + 보정
  const items = Array.isArray(result?.items) ? result.items : []
  const cleanItems: ExtractedItem[] = items
    .map((i: any) => ({
      productName: String(i?.productName || '').trim(),
      quantity: Math.max(1, Math.floor(Number(i?.quantity) || 1)),
      unitPriceHint:
        Number.isFinite(Number(i?.unitPriceHint)) && Number(i?.unitPriceHint) > 0
          ? Number(i?.unitPriceHint)
          : null,
    }))
    .filter((i) => i.productName.length > 0)

  if (cleanItems.length === 0) {
    throw new Error('주문 상품을 추출하지 못했습니다. 다시 확인해 주세요.')
  }

  return {
    items: cleanItems,
    recipient: {
      name: result?.recipient?.name ?? null,
      phone: result?.recipient?.phone ?? null,
      address: result?.recipient?.address ?? null,
      addressDetail: result?.recipient?.addressDetail ?? null,
      postalCode: result?.recipient?.postalCode ?? null,
    },
    memo: result?.memo ?? null,
  }
}

export interface CreateExternalOrderArgs {
  userId: number
  shopId?: number | null
  source: ExternalOrderSource
  externalKind: ExternalOrderKind
  rawText: string
  extracted: ExtractedOrder
  // 발신자 정보 (메시지에서 추출되지 않으면 폴백)
  senderName?: string | null
  senderPhone?: string | null
  // AI 챗 변환 시 메시지 ID
  inboxMessageId?: number | null
}

export interface CreateExternalOrderResult {
  orderId: number
  orderNumber: string
  totalAmount: number
  matchedShopProductIds: number[]
  unmatchedNames: string[]
}

/**
 * 추출된 주문 데이터를 GuestOrder 로 영속화.
 * - source/externalKind/externalMemo/inboxMessageId 기록
 * - status = PENDING (입금 매칭 전까지 대기)
 * - ShopProduct 매칭 실패 시 isCustomItem=true 로 저장
 */
export async function createExternalOrderFromExtracted(
  args: CreateExternalOrderArgs
): Promise<CreateExternalOrderResult> {
  const {
    userId,
    source,
    externalKind,
    rawText,
    extracted,
    senderName,
    senderPhone,
    inboxMessageId,
  } = args

  // 셀러의 활성 쇼핑몰 조회 (shopId 미지정 시 첫 활성 쇼핑몰)
  let shopId = args.shopId ?? null
  if (!shopId) {
    const shop = await prisma.shop.findFirst({
      where: { userId, isActive: true, deletedAt: null },
      select: { id: true },
      orderBy: { id: 'asc' },
    })
    shopId = shop?.id ?? null
  }
  if (!shopId) {
    throw new Error('활성 쇼핑몰이 없습니다. 먼저 쇼핑몰을 만들어 주세요.')
  }

  // 발신자/수령인 정보 정리
  const recipientName =
    extracted.recipient.name?.trim() || senderName?.trim() || `외부주문-${Date.now()}`
  const phoneRe = /^[\d\s\-]{9,15}$/
  const recipientPhone =
    extracted.recipient.phone?.trim() ||
    (senderPhone && phoneRe.test(senderPhone) ? senderPhone : '미입력')
  const guestName = senderName?.trim() || recipientName
  const guestPhone = senderPhone?.trim() || recipientPhone

  // 상품 매칭 (RETAIL 시에만 — WHOLESALE 은 발주 텍스트라 매칭 안 함)
  const matchedShopProductIds: number[] = []
  const unmatchedNames: string[] = []
  const itemsForCreate: Array<{
    shopProductId: number | null
    productName: string
    quantity: number
    unitPrice: number
    totalPrice: number
    isCustomItem: boolean
  }> = []

  for (const item of extracted.items) {
    let shopProductId: number | null = null
    let unitPrice = item.unitPriceHint ?? 0
    let productName = item.productName

    if (externalKind === 'RETAIL') {
      const shopProduct = await prisma.shopProduct.findFirst({
        where: {
          shopId,
          deletedAt: null,
          product: {
            userId,
            deletedAt: null,
            isActive: true,
            name: { contains: item.productName },
          },
        },
        select: {
          id: true,
          product: { select: { name: true, price: true } },
        },
      })
      if (shopProduct?.product) {
        shopProductId = shopProduct.id
        productName = shopProduct.product.name
        if (!unitPrice) {
          unitPrice = Number(shopProduct.product.price ?? 0)
        }
        matchedShopProductIds.push(shopProduct.id)
      } else {
        unmatchedNames.push(item.productName)
      }
    }

    const safeUnitPrice = Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice : 0
    const totalPrice = safeUnitPrice * item.quantity

    itemsForCreate.push({
      shopProductId,
      productName,
      quantity: item.quantity,
      unitPrice: safeUnitPrice,
      totalPrice,
      isCustomItem: shopProductId === null,
    })
  }

  const subtotal = itemsForCreate.reduce((sum, i) => sum + i.totalPrice, 0)
  const orderNumber = `XORD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

  const memoChunks: string[] = []
  if (extracted.memo) memoChunks.push(extracted.memo)
  memoChunks.push(`[원본 메시지]\n${rawText.trim()}`)
  if (unmatchedNames.length > 0) {
    memoChunks.push(`[미매칭 상품] ${unmatchedNames.join(', ')}`)
  }
  const memoText = memoChunks.join('\n\n')

  const result = await prisma.$transaction(async (tx) => {
    const order = await (tx as any).guestOrder.create({
      data: {
        shopId,
        orderNumber,
        status: 'PENDING',
        guestName: guestName.slice(0, 100),
        guestPhone: guestPhone.slice(0, 20),
        subtotalAmount: subtotal,
        discountAmount: 0,
        totalAmount: subtotal,
        source,
        externalKind,
        externalMemo: memoText,
        inboxMessageId: inboxMessageId ?? null,
      },
    })

    // ShippingAddress 생성 (recipient 정보가 있을 때만)
    const addrLine = extracted.recipient.address?.trim()
    if (addrLine) {
      await tx.shippingAddress.create({
        data: {
          guestOrderId: order.id,
          recipientName: recipientName.slice(0, 100),
          recipientPhone: recipientPhone.slice(0, 20),
          postalCode: extracted.recipient.postalCode?.slice(0, 20) || '00000',
          address: addrLine.slice(0, 500),
          addressDetail: extracted.recipient.addressDetail?.slice(0, 500) || '',
        },
      })
    }

    for (const i of itemsForCreate) {
      await tx.guestOrderItem.create({
        data: {
          guestOrderId: order.id,
          shopProductId: i.shopProductId ?? null,
          productName: i.productName.slice(0, 500),
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          totalPrice: i.totalPrice,
          isCustomItem: i.isCustomItem,
        },
      })
    }

    // inbox 메시지에 orderId 연결 (CHAT/KAKAO 변환 시)
    if (inboxMessageId) {
      try {
        await tx.inboxMessage.update({
          where: { id: inboxMessageId },
          data: { orderId: order.id },
        })
      } catch {
        // 메시지가 없으면 무시
      }
    }

    return order
  })

  return {
    orderId: result.id,
    orderNumber: result.orderNumber,
    totalAmount: subtotal,
    matchedShopProductIds,
    unmatchedNames,
  }
}

/**
 * 통합 흐름: 텍스트 → 추출 → GuestOrder 생성.
 * 외부주문 페이지 및 AI 챗 hook 양쪽에서 사용.
 */
export async function createExternalOrderFromText(args: {
  userId: number
  shopId?: number | null
  source: ExternalOrderSource
  externalKind: ExternalOrderKind
  rawText: string
  senderName?: string | null
  senderPhone?: string | null
  inboxMessageId?: number | null
}): Promise<CreateExternalOrderResult & { extracted: ExtractedOrder }> {
  const extracted = await extractOrderFromText(args.userId, args.rawText)
  const result = await createExternalOrderFromExtracted({
    ...args,
    extracted,
  })
  return { ...result, extracted }
}
