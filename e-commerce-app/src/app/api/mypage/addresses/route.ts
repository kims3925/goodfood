import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/modules/auth/auth.config'
import { PrismaClient } from '@bandauto/db'

const prisma = new PrismaClient()

// 배송지 목록 조회
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

    const addresses = await prisma.userAddress.findMany({
      where: {
        userId,
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    })

    return NextResponse.json({
      success: true,
      addresses,
    })
  } catch (error) {
    console.error('Failed to fetch addresses:', error)
    return NextResponse.json(
      { success: false, error: '배송지 목록을 불러오는데 실패했습니다' },
      { status: 500 }
    )
  }
}

// 배송지 추가
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

    const {
      label,
      recipientName,
      recipientPhone,
      postalCode,
      address,
      addressDetail,
      isDefault,
    } = await request.json()

    if (!recipientName || !recipientPhone || !postalCode || !address) {
      return NextResponse.json(
        { success: false, error: '필수 정보를 입력해주세요' },
        { status: 400 }
      )
    }

    // 배송지 개수 제한 확인 (5개)
    const count = await prisma.userAddress.count({
      where: { userId },
    })

    if (count >= 5) {
      return NextResponse.json(
        { success: false, error: '배송지는 최대 5개까지 등록할 수 있습니다' },
        { status: 400 }
      )
    }

    // 기본 배송지 설정 시 기존 기본 배송지 해제
    if (isDefault) {
      await prisma.userAddress.updateMany({
        where: {
          userId,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      })
    }

    const newAddress = await prisma.userAddress.create({
      data: {
        userId,
        label,
        recipientName,
        recipientPhone,
        postalCode,
        address,
        addressDetail,
        isDefault: isDefault || false,
      },
    })

    return NextResponse.json({
      success: true,
      message: '배송지가 등록되었습니다',
      address: newAddress,
    })
  } catch (error) {
    console.error('Failed to create address:', error)
    return NextResponse.json(
      { success: false, error: '배송지 등록에 실패했습니다' },
      { status: 500 }
    )
  }
}
