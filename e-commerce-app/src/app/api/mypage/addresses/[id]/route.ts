import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/modules/auth/auth.config'
import { PrismaClient } from '@bandauto/db'

const prisma = new PrismaClient()

// 배송지 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다' },
        { status: 401 }
      )
    }

    const userId = typeof session.user.id === 'string' ? parseInt(session.user.id) : session.user.id

    const addressId = parseInt(params.id)

    if (isNaN(addressId)) {
      return NextResponse.json(
        { success: false, error: '잘못된 요청입니다' },
        { status: 400 }
      )
    }

    const {
      label,
      recipientName,
      recipientPhone,
      postalCode,
      address,
      addressDetail,
      isDefault,
    } = await request.json()

    // 본인의 배송지인지 확인
    const existingAddress = await prisma.userAddress.findUnique({
      where: { id: addressId },
    })

    if (!existingAddress) {
      return NextResponse.json(
        { success: false, error: '배송지를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    if (existingAddress.userId !== userId) {
      return NextResponse.json(
        { success: false, error: '권한이 없습니다' },
        { status: 403 }
      )
    }

    // 기본 배송지 설정 시 기존 기본 배송지 해제
    if (isDefault) {
      await prisma.userAddress.updateMany({
        where: {
          userId,
          isDefault: true,
          id: { not: addressId },
        },
        data: {
          isDefault: false,
        },
      })
    }

    const updatedAddress = await prisma.userAddress.update({
      where: { id: addressId },
      data: {
        label,
        recipientName,
        recipientPhone,
        postalCode,
        address,
        addressDetail,
        isDefault,
      },
    })

    return NextResponse.json({
      success: true,
      message: '배송지가 수정되었습니다',
      address: updatedAddress,
    })
  } catch (error) {
    console.error('Failed to update address:', error)
    return NextResponse.json(
      { success: false, error: '배송지 수정에 실패했습니다' },
      { status: 500 }
    )
  }
}

// 배송지 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다' },
        { status: 401 }
      )
    }

    const userId = typeof session.user.id === 'string' ? parseInt(session.user.id) : session.user.id

    const addressId = parseInt(params.id)

    if (isNaN(addressId)) {
      return NextResponse.json(
        { success: false, error: '잘못된 요청입니다' },
        { status: 400 }
      )
    }

    // 본인의 배송지인지 확인
    const address = await prisma.userAddress.findUnique({
      where: { id: addressId },
    })

    if (!address) {
      return NextResponse.json(
        { success: false, error: '배송지를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    if (address.userId !== userId) {
      return NextResponse.json(
        { success: false, error: '권한이 없습니다' },
        { status: 403 }
      )
    }

    await prisma.userAddress.delete({
      where: { id: addressId },
    })

    return NextResponse.json({
      success: true,
      message: '배송지가 삭제되었습니다',
    })
  } catch (error) {
    console.error('Failed to delete address:', error)
    return NextResponse.json(
      { success: false, error: '배송지 삭제에 실패했습니다' },
      { status: 500 }
    )
  }
}
