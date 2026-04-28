export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/products/fix-shipping-type
 *
 * 모순 상태 Product 일괄 수정:
 *   shippingFee > 0  +  bundleShippingType = INCLUDED  →  SEPARATE 로 정정
 *
 * 배경:
 * 2026-04-28 fab052f 커밋 이전에 가공된 상품 중, AI 가 description 의
 * "배송비 포함" 텍스트를 shippingInfo 에 잘못 복제하여 키워드 추론이
 * INCLUDED 로 판정한 케이스. 실제 shippingFee 는 4,000 원 등 양수로 추출됐는데
 * 합배송 타입이 INCLUDED 라 발행 시 배송비가 합산되지 않는 사고.
 *
 * 안전장치:
 * - shippingFee 가 0/null 인 진짜 배송비 포함 상품은 건드리지 않음
 * - bundleShippingType=NONE 도 건드리지 않음 (기본 NONE 은 의도일 수 있음)
 * - body.dryRun=true 면 카운트만 반환 (실제 수정 안 함)
 *
 * Body:
 *   { dryRun?: boolean }   기본 false
 *
 * 응답:
 *   { success, summary: { matched, updated, dryRun }, sampleIds }
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma, { BundleShippingType } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const dryRun = !!body?.dryRun

    // 모순 케이스: shippingFee > 0 인데 INCLUDED
    const where = {
      userId: currentUser.userId,
      deletedAt: null,
      bundleShippingType: BundleShippingType.INCLUDED,
      shippingFee: { gt: 0 },
    }

    const matched = await prisma.product.count({ where })

    // 진단용 샘플 (최대 10건) — id, name, shippingFee
    const samples = await prisma.product.findMany({
      where,
      orderBy: { id: 'desc' },
      take: 10,
      select: {
        id: true,
        name: true,
        shippingFee: true,
        bundleShippingType: true,
      },
    })

    let updated = 0
    if (!dryRun && matched > 0) {
      const result = await prisma.product.updateMany({
        where,
        data: { bundleShippingType: BundleShippingType.SEPARATE },
      })
      updated = result.count
    }

    return NextResponse.json({
      success: true,
      summary: {
        matched,
        updated,
        dryRun,
      },
      samples,
      note: dryRun
        ? `dryRun=true — 실제 수정은 안 됨. body={"dryRun":false} 로 호출 시 ${matched}건 수정 예정.`
        : `${updated}건 수정 완료. 변경: bundleShippingType INCLUDED → SEPARATE (shippingFee>0 인 모순 케이스만).`,
    })
  } catch (error: any) {
    console.error('[fix-shipping-type] 실패:', error)
    return NextResponse.json(
      { success: false, error: error?.message || '실행 실패' },
      { status: 500 }
    )
  }
}
