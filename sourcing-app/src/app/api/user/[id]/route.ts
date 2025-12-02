import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { UserRole } from '@bandauto/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    if (currentUser.role !== 'ADMIN') {
      return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })
    }

    const { id } = await params
    const userId = parseInt(id)

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        profileImage: true,
        oauthProvider: true,
        oauthProviderId: true,
        createdAt: true,
        updatedAt: true,
        marketingAgreedAt: true,
        privacyAgreedAt: true,
        signupCompletedAt: true,
        tosAgreedAt: true,
        orders: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            totalAmount: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        inquiries: {
          select: {
            id: true,
            inquiryType: true,
            title: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        reviews: {
          select: {
            id: true,
            rating: true,
            content: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        addresses: {
          select: {
            id: true,
            recipientName: true,
            recipientPhone: true,
            postalCode: true,
            address: true,
            addressDetail: true,
            isDefault: true,
          },
        },
        _count: {
          select: {
            orders: true,
            inquiries: true,
            reviews: true,
            wishlists: true,
            userCoupons: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error('사용자 상세 조회 오류:', error)
    return NextResponse.json(
      { error: '사용자 정보를 불러오는데 실패했습니다' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    if (currentUser.role !== 'ADMIN') {
      return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })
    }

    const { id } = await params
    const userId = parseInt(id)
    const body = await request.json()
    const { role, name, phone } = body

    const updateData: { role?: UserRole; name?: string; phone?: string } = {}
    if (role && ['SOURCING_USER', 'CUSTOMER', 'ADMIN'].includes(role)) {
      updateData.role = role as UserRole
    }
    if (name !== undefined) updateData.name = name
    if (phone !== undefined) updateData.phone = phone

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
      },
    })

    return NextResponse.json({ user })
  } catch (error) {
    console.error('사용자 수정 오류:', error)
    return NextResponse.json(
      { error: '사용자 정보 수정에 실패했습니다' },
      { status: 500 }
    )
  }
}
