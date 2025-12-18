import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { deleteNotifications } from '@/services/notification.service'

/**
 * GET: 알림 목록 조회 (shop/sourcing 공통)
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
    const section = searchParams.get('section') || 'shop' // 'shop' | 'sourcing'
    const shopId = searchParams.get('shopId')
    const type = searchParams.get('type')
    const isRead = searchParams.get('isRead')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // where 조건 구성 - 사용자별 알림만 조회
    const where: any = {
      userId: user.userId, // 사용자별 필터 (필수)
      section, // section 필터 추가
    }

    // shop 섹션일 때 추가로 shopId 필터 적용 가능
    if (section === 'shop' && shopId) {
      where.shopId = parseInt(shopId)
    }

    // 타입 필터
    if (type) {
      where.type = type
    }

    // 읽음 상태 필터
    if (isRead === 'true') {
      where.isRead = true
    } else if (isRead === 'false') {
      where.isRead = false
    }

    // 날짜 범위 필터
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setDate(end.getDate() + 1)
        where.createdAt.lt = end
      }
    }

    // 검색어 필터
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { message: { contains: search } },
      ]
    }

    // 데이터 조회
    const [notifications, total, unreadCount, todayCount, shops] = await Promise.all([
      prisma.notification.findMany({
        where,
        include: {
          shop: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: { ...where, isRead: false },
      }),
      prisma.notification.count({
        where: {
          ...where,
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      prisma.shop.findMany({
        where: { userId: user.userId },
        select: { id: true, name: true },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        notifications,
        shops,
        stats: {
          total,
          unread: unreadCount,
          today: todayCount,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error('알림 목록 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '알림 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * DELETE: 알림 삭제 (다중)
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { ids } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: '삭제할 알림 ID를 제공해주세요.' },
        { status: 400 }
      )
    }

    const deletedCount = await deleteNotifications(ids)

    return NextResponse.json({
      success: true,
      message: `${deletedCount}개의 알림이 삭제되었습니다.`,
    })
  } catch (error) {
    console.error('알림 삭제 실패:', error)
    return NextResponse.json(
      { success: false, error: '알림 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
}
