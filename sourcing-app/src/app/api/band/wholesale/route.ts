import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET: 도매밴드 목록 조회
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''

    const bands = await prisma.wholesaleBand.findMany({
      where: {
        deletedAt: null,
        ...(search && {
          OR: [
            { name: { contains: search } },
            { description: { contains: search } },
          ],
        }),
      },
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
    })

    return NextResponse.json({
      success: true,
      data: bands,
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
    const body = await request.json()
    const { userId, apiConfigId, bandKey, name, description, coverUrl, memberCount } = body

    // 필수 필드 검증
    if (!userId || !apiConfigId || !bandKey || !name) {
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
        userId,
        bandKey,
        deletedAt: null,
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
        userId,
        apiConfigId,
        bandKey,
        name,
        description,
        coverUrl,
        memberCount: memberCount || 0,
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
    const { id, name, description, isActive } = body

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
        deletedAt: null,
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
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
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

// DELETE: 도매밴드 삭제 (Soft Delete)
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
        deletedAt: null,
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

    // Soft Delete
    await prisma.wholesaleBand.update({
      where: { id: parseInt(id) },
      data: {
        deletedAt: new Date(),
      },
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
