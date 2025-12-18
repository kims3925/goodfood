export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

/**
 * GET /api/shop
 * 쇼핑몰 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '100')
    const search = searchParams.get('search') || ''
    const isActive = searchParams.get('isActive')

    const where: any = {
      userId: currentUser.userId,
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { subdomain: { contains: search } },
      ]
    }

    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true'
    }

    const total = await prisma.shop.count({ where })

    const shops = await prisma.shop.findMany({
      where,
      include: {
        theme: true,
        _count: {
          select: {
            publishedProducts: true,
            orders: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: (page - 1) * limit,
      take: limit,
    })

    return NextResponse.json({
      success: true,
      data: shops,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('쇼핑몰 목록 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '쇼핑몰 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/shop
 * 쇼핑몰 생성
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const {
      subdomain,
      name,
      coverUrl,
      bankName,
      bankAccount,
      accountHolder,
      contactPhone,
      contactEmail,
    } = body

    // 필수 필드 검증
    if (!subdomain || !name) {
      return NextResponse.json(
        { success: false, error: '도메인과 쇼핑몰명은 필수입니다.' },
        { status: 400 }
      )
    }

    // 도메인 형식 검증 (영문, 숫자, 하이픈만 허용)
    const subdomainRegex = /^[a-z0-9-]+$/
    if (!subdomainRegex.test(subdomain)) {
      return NextResponse.json(
        { success: false, error: '도메인은 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.' },
        { status: 400 }
      )
    }

    // 도메인 중복 체크
    const existingShop = await prisma.shop.findUnique({
      where: { subdomain },
    })

    if (existingShop) {
      return NextResponse.json(
        { success: false, error: '이미 사용 중인 도메인입니다.' },
        { status: 400 }
      )
    }

    const shop = await prisma.shop.create({
      data: {
        userId: currentUser.userId,
        subdomain,
        name,
        coverUrl: coverUrl || null,
        bankName: bankName || null,
        bankAccount: bankAccount || null,
        accountHolder: accountHolder || null,
        contactPhone: contactPhone || null,
        contactEmail: contactEmail || null,
      },
      include: {
        theme: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: shop,
    })
  } catch (error) {
    console.error('쇼핑몰 생성 실패:', error)
    return NextResponse.json(
      { success: false, error: '쇼핑몰 생성에 실패했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/shop?id=1
 * 쇼핑몰 삭제
 */
export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: '쇼핑몰 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    const shop = await prisma.shop.findFirst({
      where: {
        id: parseInt(id),
        userId: currentUser.userId,
      },
    })

    if (!shop) {
      return NextResponse.json(
        { success: false, error: '쇼핑몰을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    await prisma.shop.delete({
      where: { id: parseInt(id) },
    })

    return NextResponse.json({
      success: true,
      message: '쇼핑몰이 삭제되었습니다.',
    })
  } catch (error) {
    console.error('쇼핑몰 삭제 실패:', error)
    return NextResponse.json(
      { success: false, error: '쇼핑몰 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
}
