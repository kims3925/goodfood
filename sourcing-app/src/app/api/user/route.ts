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

    // ADMIN만 사용자 목록 조회 가능
    if (currentUser.role !== 'ADMIN') {
      return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const roleParam = searchParams.get('role')
    const role = roleParam && validRoles.includes(roleParam as UserRole) ? roleParam as UserRole : null

    const skip = (page - 1) * limit

    const where: Prisma.UserWhereInput = {
      // ADMIN 제외, USER/MANAGER만 조회
      role: role ? role : { in: ['USER', 'MANAGER'] },
      ...(search && {
        OR: [
          { email: { contains: search } },
          { name: { contains: search } },
          { phone: { contains: search } },
        ],
      }),
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          profileImage: true,
          createdAt: true,
          signupCompletedAt: true,
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
    ])

    return NextResponse.json({
      users,
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
