export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'

// 쿠폰 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const couponId = parseInt(id)

    const coupon = await prisma.coupon.findUnique({
      where: { id: couponId },
      include: {
        _count: {
          select: { userCoupons: true },
        },
      },
    })

    if (!coupon) {
      return NextResponse.json(
        { success: false, error: '쿠폰을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: coupon,
    })
  } catch (error) {
    console.error('쿠폰 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '쿠폰을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}

// 쿠폰 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const couponId = parseInt(id)
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

    // 쿠폰 존재 여부 확인
    const existingCoupon = await prisma.coupon.findUnique({
      where: { id: couponId },
    })

    if (!existingCoupon) {
      return NextResponse.json(
        { success: false, error: '쿠폰을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 코드 중복 체크 (자신 제외)
    if (code !== existingCoupon.code) {
      const duplicateCoupon = await prisma.coupon.findUnique({
        where: { code },
      })

      if (duplicateCoupon) {
        return NextResponse.json(
          { success: false, error: '이미 사용 중인 쿠폰 코드입니다.' },
          { status: 400 }
        )
      }
    }

    const coupon = await prisma.coupon.update({
      where: { id: couponId },
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
        isActive,
      },
    })

    return NextResponse.json({
      success: true,
      data: coupon,
    })
  } catch (error) {
    console.error('쿠폰 수정 실패:', error)
    return NextResponse.json(
      { success: false, error: '쿠폰 수정에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// 쿠폰 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const couponId = parseInt(id)

    // 쿠폰 존재 여부 확인
    const existingCoupon = await prisma.coupon.findUnique({
      where: { id: couponId },
    })

    if (!existingCoupon) {
      return NextResponse.json(
        { success: false, error: '쿠폰을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 쿠폰 삭제 (연관된 UserCoupon도 cascade로 삭제됨)
    await prisma.coupon.delete({
      where: { id: couponId },
    })

    return NextResponse.json({
      success: true,
      message: '쿠폰이 삭제되었습니다.',
    })
  } catch (error) {
    console.error('쿠폰 삭제 실패:', error)
    return NextResponse.json(
      { success: false, error: '쿠폰 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
}
