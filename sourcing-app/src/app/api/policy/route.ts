import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

const prisma = new PrismaClient()

// GET: 정책 목록 조회
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }
    const userId = currentUser.userId

    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    const where = {
      userId: userId,
      ...(search && {
        OR: [
          { name: { contains: search } },
          { description: { contains: search } },
        ],
      }),
    }

    const total = await prisma.pricingPolicy.count({ where })

    const policies = await prisma.pricingPolicy.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      skip: (page - 1) * limit,
      take: limit,
    })

    return NextResponse.json({
      success: true,
      data: policies,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('정책 조회 실패:', error)
    return NextResponse.json(
      {
        success: false,
        error: '정책 조회에 실패했습니다.',
      },
      { status: 500 }
    )
  }
}

// POST: 정책 등록
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }
    const userId = currentUser.userId

    const body = await request.json()
    const { name, description, content, isActive = true } = body

    // 필수 필드 검증
    if (!name || !content) {
      return NextResponse.json(
        {
          success: false,
          error: '정책 이름과 내용은 필수입니다.',
        },
        { status: 400 }
      )
    }

    // 정책 생성
    const policy = await prisma.pricingPolicy.create({
      data: {
        userId,
        name,
        description,
        content,
        isActive,
      },
    })

    return NextResponse.json({
      success: true,
      data: policy,
    })
  } catch (error) {
    console.error('정책 등록 실패:', error)
    return NextResponse.json(
      {
        success: false,
        error: '정책 등록에 실패했습니다.',
      },
      { status: 500 }
    )
  }
}

// PUT: 정책 수정
export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { id, name, description, content, isActive } = body

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: 'ID가 필요합니다.',
        },
        { status: 400 }
      )
    }

    // 정책 존재 확인
    const existing = await prisma.pricingPolicy.findFirst({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: '정책을 찾을 수 없습니다.',
        },
        { status: 404 }
      )
    }

    // 정책 수정
    const policy = await prisma.pricingPolicy.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(content && { content }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    return NextResponse.json({
      success: true,
      data: policy,
    })
  } catch (error) {
    console.error('정책 수정 실패:', error)
    return NextResponse.json(
      {
        success: false,
        error: '정책 수정에 실패했습니다.',
      },
      { status: 500 }
    )
  }
}

// DELETE: 정책 삭제
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
        {
          success: false,
          error: 'ID가 필요합니다.',
        },
        { status: 400 }
      )
    }

    // 정책 존재 확인
    const policy = await prisma.pricingPolicy.findFirst({
      where: { id: parseInt(id) },
    })

    if (!policy) {
      return NextResponse.json(
        {
          success: false,
          error: '정책을 찾을 수 없습니다.',
        },
        { status: 404 }
      )
    }

    // 정책 삭제
    await prisma.pricingPolicy.delete({
      where: { id: parseInt(id) },
    })

    return NextResponse.json({
      success: true,
      message: '정책이 삭제되었습니다.',
    })
  } catch (error) {
    console.error('정책 삭제 실패:', error)
    return NextResponse.json(
      {
        success: false,
        error: '정책 삭제에 실패했습니다.',
      },
      { status: 500 }
    )
  }
}
