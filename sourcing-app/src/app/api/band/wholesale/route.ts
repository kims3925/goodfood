import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

const prisma = new PrismaClient()

// GET: 도매밴드 목록 조회
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    const where = {
      ...(search && {
        name: { contains: search },
      }),
    }

    const total = await prisma.wholesaleBand.count({ where })

    const bands = await prisma.wholesaleBand.findMany({
      where,
      include: {
        apiConfig: {
          select: {
            platform: true,
          },
        },
        user: {
          select: {
            email: true,
            name: true,
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
      data: bands,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('도매밴드 조회 실패:', error)
    return NextResponse.json(
      {
        success: false,
        error: '도매밴드 조회에 실패했습니다.',
      },
      { status: 500 }
    )
  }
}

// POST: 도매밴드 등록
export async function POST(request: NextRequest) {
  try {
    // 세션에서 userId 가져오기
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        {
          success: false,
          error: '로그인이 필요합니다.',
        },
        { status: 401 }
      )
    }
    const userId = currentUser.userId

    // 사용자의 Band API 설정 조회
    const apiConfig = await prisma.sourcingApiConfig.findFirst({
      where: {
        userId,
        platform: 'BAND',
        isActive: true,
      },
    })

    if (!apiConfig) {
      return NextResponse.json(
        {
          success: false,
          error: 'Band API 설정을 먼저 등록해주세요.',
        },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { bandKey, name, coverUrl } = body

    // 필수 필드 검증
    if (!bandKey || !name) {
      return NextResponse.json(
        {
          success: false,
          error: '필수 필드가 누락되었습니다.',
        },
        { status: 400 }
      )
    }

    // 중복 체크 (같은 사용자의 같은 bandKey)
    const existing = await prisma.wholesaleBand.findFirst({
      where: {
        userId: userId,
        bandKey: bandKey,
      },
    })

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: '이미 등록된 밴드입니다.',
        },
        { status: 409 }
      )
    }

    // 도매밴드 생성
    const band = await prisma.wholesaleBand.create({
      data: {
        userId: userId,
        apiConfigId: apiConfig.id,
        bandKey: bandKey,
        name,
        coverUrl: coverUrl,
      },
      include: {
        apiConfig: {
          select: {
            platform: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: band,
    })
  } catch (error) {
    console.error('도매밴드 등록 실패:', error)
    return NextResponse.json(
      {
        success: false,
        error: '도매밴드 등록에 실패했습니다.',
      },
      { status: 500 }
    )
  }
}

// PUT: 도매밴드 수정
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, isActive } = body

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: 'ID가 필요합니다.',
        },
        { status: 400 }
      )
    }

    // 밴드 존재 확인
    const existing = await prisma.wholesaleBand.findFirst({
      where: {
        id,
      },
    })

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: '밴드를 찾을 수 없습니다.',
        },
        { status: 404 }
      )
    }

    // 도매밴드 수정
    const band = await prisma.wholesaleBand.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(isActive !== undefined && { isActive: isActive }),
      },
      include: {
        apiConfig: {
          select: {
            platform: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: band,
    })
  } catch (error) {
    console.error('도매밴드 수정 실패:', error)
    return NextResponse.json(
      {
        success: false,
        error: '도매밴드 수정에 실패했습니다.',
      },
      { status: 500 }
    )
  }
}

// DELETE: 도매밴드 삭제
export async function DELETE(request: NextRequest) {
  try {
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

    // 밴드 존재 확인
    const existing = await prisma.wholesaleBand.findFirst({
      where: {
        id: parseInt(id),
      },
    })

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: '밴드를 찾을 수 없습니다.',
        },
        { status: 404 }
      )
    }

    // 밴드 삭제
    await prisma.wholesaleBand.delete({
      where: { id: parseInt(id) },
    })

    return NextResponse.json({
      success: true,
      message: '도매밴드가 삭제되었습니다.',
    })
  } catch (error) {
    console.error('도매밴드 삭제 실패:', error)
    return NextResponse.json(
      {
        success: false,
        error: '도매밴드 삭제에 실패했습니다.',
      },
      { status: 500 }
    )
  }
}
