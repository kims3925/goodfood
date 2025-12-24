export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'

// 쿠폰 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const discountType = searchParams.get('discountType')
    const isActive = searchParams.get('isActive')

    const skip = (page - 1) * limit

    const where: any = {}

    if (search) {
      where.OR = [
        { code: { contains: search } },
        { name: { contains: search } },
      ]
    }

    if (discountType) {
      where.discountType = discountType
    }

    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true'
    }

    const [coupons, total] = await Promise.all([
      prisma.coupon.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.coupon.count({ where }),
    ])

    // 통계 조회
    const [allCoupons, activeCoupons, percentageCoupons, fixedCoupons, freeShippingCoupons] = await Promise.all([
      prisma.coupon.count(),
      prisma.coupon.count({ where: { isActive: true } }),
      prisma.coupon.count({ where: { discountType: 'PERCENTAGE' } }),
      prisma.coupon.count({ where: { discountType: 'FIXED' } }),
      prisma.coupon.count({ where: { discountType: 'FREE_SHIPPING' } }),
    ])

    return NextResponse.json({
      success: true,
      data: coupons,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        total: allCoupons,
        active: activeCoupons,
        inactive: allCoupons - activeCoupons,
        percentage: percentageCoupons,
        fixed: fixedCoupons,
        freeShipping: freeShippingCoupons,
      },
    })
  } catch (error) {
    console.error('쿠폰 목록 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '쿠폰 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}

// 쿠폰 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      code,
      name,
      description,
      discountType,
      discountValue,
      minPurchaseAmount,
      maxDiscountAmount,
      maxIssueCount,
      validFrom,
      validUntil,
      isActive,
    } = body

    // 코드 중복 체크
    const existingCoupon = await prisma.coupon.findUnique({
      where: { code },
    })

    if (existingCoupon) {
      return NextResponse.json(
        { success: false, error: '이미 사용 중인 쿠폰 코드입니다.' },
        { status: 400 }
      )
    }

    const coupon = await prisma.coupon.create({
      data: {
        code,
        name,
        description: description || null,
        discountType,
        discountValue: discountType === 'FREE_SHIPPING' ? 0 : discountValue,
        minPurchaseAmount: minPurchaseAmount || null,
        maxDiscountAmount: maxDiscountAmount || null,
        maxIssueCount: maxIssueCount || null,
        validFrom: new Date(validFrom),
        validUntil: new Date(validUntil),
        isActive: isActive ?? true,
      },
    })

    return NextResponse.json({
      success: true,
      data: coupon,
    })
  } catch (error) {
    console.error('쿠폰 생성 실패:', error)
    return NextResponse.json(
      { success: false, error: '쿠폰 생성에 실패했습니다.' },
      { status: 500 }
    )
  }
}
