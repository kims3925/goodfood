import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/modules/auth/auth.config'
import prisma from '@modules/common/utils/src/database/client'

// 내 쿠폰 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다' },
        { status: 401 }
      )
    }

    const userId = typeof session.user.id === 'string' ? parseInt(session.user.id) : session.user.id

    const { searchParams } = new URL(request.url)
    const isUsed = searchParams.get('isUsed')

    const where: any = {
      userId,
    }

    if (isUsed !== null) {
      where.isUsed = isUsed === 'true'
    }

    const userCoupons = await prisma.userCoupon.findMany({
      where,
      include: {
        coupon: true,
      },
      orderBy: {
        issuedAt: 'desc',
      },
    })

    // 만료된 쿠폰 필터링
    const now = new Date()
    const coupons = userCoupons.map((uc) => ({
      ...uc,
      isExpired: uc.expiredAt < now,
    }))

    return NextResponse.json({
      success: true,
      coupons,
    })
  } catch (error) {
    console.error('Failed to fetch coupons:', error)
    return NextResponse.json(
      { success: false, error: '쿠폰 목록을 불러오는데 실패했습니다' },
      { status: 500 }
    )
  }
}

// 쿠폰 발급 (쿠폰 코드로)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다' },
        { status: 401 }
      )
    }

    const userId = typeof session.user.id === 'string' ? parseInt(session.user.id) : session.user.id

    const { couponCode } = await request.json()

    if (!couponCode) {
      return NextResponse.json(
        { success: false, error: '쿠폰 코드를 입력해주세요' },
        { status: 400 }
      )
    }

    // 쿠폰 조회
    const coupon = await prisma.coupon.findUnique({
      where: { code: couponCode },
    })

    if (!coupon) {
      return NextResponse.json(
        { success: false, error: '존재하지 않는 쿠폰입니다' },
        { status: 404 }
      )
    }

    if (!coupon.isActive) {
      return NextResponse.json(
        { success: false, error: '사용할 수 없는 쿠폰입니다' },
        { status: 400 }
      )
    }

    const now = new Date()
    if (now < coupon.validFrom || now > coupon.validUntil) {
      return NextResponse.json(
        { success: false, error: '쿠폰 사용 기간이 아닙니다' },
        { status: 400 }
      )
    }

    // 이미 발급받은 쿠폰인지 확인
    const existingUserCoupon = await prisma.userCoupon.findUnique({
      where: {
        userId_couponId: {
          userId,
          couponId: coupon.id,
        },
      },
    })

    if (existingUserCoupon) {
      return NextResponse.json(
        { success: false, error: '이미 발급받은 쿠폰입니다' },
        { status: 400 }
      )
    }

    // 발급 수량 체크
    if (coupon.maxIssueCount && coupon.issuedCount >= coupon.maxIssueCount) {
      return NextResponse.json(
        { success: false, error: '쿠폰이 모두 소진되었습니다' },
        { status: 400 }
      )
    }

    // 쿠폰 발급
    const userCoupon = await prisma.userCoupon.create({
      data: {
        userId,
        couponId: coupon.id,
        expiredAt: coupon.validUntil,
      },
      include: {
        coupon: true,
      },
    })

    // 발급 수량 증가
    await prisma.coupon.update({
      where: { id: coupon.id },
      data: { issuedCount: { increment: 1 } },
    })

    return NextResponse.json({
      success: true,
      message: '쿠폰이 발급되었습니다',
      coupon: userCoupon,
    })
  } catch (error) {
    console.error('Failed to issue coupon:', error)
    return NextResponse.json(
      { success: false, error: '쿠폰 발급에 실패했습니다' },
      { status: 500 }
    )
  }
}
