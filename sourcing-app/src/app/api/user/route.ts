export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { Prisma } from '@bandauto/db'

// 스키마의 UserRole: USER, MANAGER, ADMIN
// 조회 대상은 USER, MANAGER만 (ADMIN 제외)
type UserRole = 'USER' | 'MANAGER'
const validRoles: UserRole[] = ['USER', 'MANAGER']

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const roleParam = searchParams.get('role')
    const role = roleParam && validRoles.includes(roleParam as UserRole) ? roleParam as UserRole : null
    const shopIdParam = searchParams.get('shopId')
    const shopId = shopIdParam ? parseInt(shopIdParam) : null

    const skip = (page - 1) * limit

    // 공통 필터 (검색어, 쇼핑몰)
    const commonFilters: Prisma.UserWhereInput = {
      ...(shopId && { shopId }),
      ...(search && {
        OR: [
          { email: { contains: search } },
          { name: { contains: search } },
          { phone: { contains: search } },
        ],
      }),
    }

    // 역할별 조회 조건 구성
    // - MANAGER: 항상 표시
    // - USER: 주문이 1개 이상 있는 경우만
    let where: Prisma.UserWhereInput

    if (role === 'MANAGER') {
      // MANAGER만 조회
      where = { role: 'MANAGER', ...commonFilters }
    } else if (role === 'USER') {
      // USER 중 주문이 있는 사용자만
      where = {
        role: 'USER',
        orders: { some: {} },
        ...commonFilters,
      }
    } else {
      // 전체: MANAGER + 주문이 있는 USER
      where = {
        AND: [
          commonFilters,
          {
            OR: [
              { role: 'MANAGER' },
              { role: 'USER', orders: { some: {} } },
            ],
          },
        ],
      }
    }

    const [users, total, shops, roleCounts] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          shopId: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          profileImage: true,
          createdAt: true,
          signupCompletedAt: true,
          registeredShop: {
            select: {
              id: true,
              name: true,
              subdomain: true,
            },
          },
          _count: {
            select: {
              orders: true,
              inquiries: true,
              reviews: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
      // 쇼핑몰 목록 (필터 드롭다운용)
      prisma.shop.findMany({
        select: {
          id: true,
          name: true,
          subdomain: true,
        },
        orderBy: { name: 'asc' },
      }),
      // 역할별 카운트 (MANAGER 전체 + 주문 있는 USER)
      Promise.all([
        // MANAGER 수
        prisma.user.count({
          where: {
            role: 'MANAGER',
            ...(shopId && { shopId }),
          },
        }),
        // 주문이 있는 USER 수
        prisma.user.count({
          where: {
            role: 'USER',
            orders: { some: {} },
            ...(shopId && { shopId }),
          },
        }),
      ]),
    ])

    // 역할별 카운트 (roleCounts = [managerCount, userCount])
    const [managerCount, userCount] = roleCounts

    return NextResponse.json({
      users,
      shops,
      stats: {
        total,
        USER: userCount,
        MANAGER: managerCount,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('사용자 목록 조회 오류:', error)
    return NextResponse.json(
      { error: '사용자 목록을 불러오는데 실패했습니다' },
      { status: 500 }
    )
  }
}
