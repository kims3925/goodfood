import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET: 소매밴드 단일 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const bandId = parseInt(id)

    if (isNaN(bandId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 ID입니다.' },
        { status: 400 }
      )
    }

    const band = await prisma.retailBand.findUnique({
      where: { id: bandId },
      include: {
        apiConfig: {
          select: { platform: true },
        },
        user: {
          select: { email: true, name: true },
        },
      },
    })

    if (!band) {
      return NextResponse.json(
        { success: false, error: '밴드를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: band })
  } catch (error) {
    console.error('소매밴드 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '소매밴드 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// PUT: 소매밴드 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const bandId = parseInt(id)

    if (isNaN(bandId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 ID입니다.' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { name, orderUrl, isActive } = body

    const existing = await prisma.retailBand.findUnique({
      where: { id: bandId },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: '밴드를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const band = await prisma.retailBand.update({
      where: { id: bandId },
      data: {
        ...(name !== undefined && { name }),
        ...(orderUrl !== undefined && { orderUrl }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        apiConfig: {
          select: { platform: true },
        },
      },
    })

    return NextResponse.json({ success: true, data: band })
  } catch (error) {
    console.error('소매밴드 수정 실패:', error)
    return NextResponse.json(
      { success: false, error: '소매밴드 수정에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// DELETE: 소매밴드 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const bandId = parseInt(id)

    if (isNaN(bandId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 ID입니다.' },
        { status: 400 }
      )
    }

    const existing = await prisma.retailBand.findUnique({
      where: { id: bandId },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: '밴드를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    await prisma.retailBand.delete({
      where: { id: bandId },
    })

    return NextResponse.json({ success: true, message: '소매밴드가 삭제되었습니다.' })
  } catch (error) {
    console.error('소매밴드 삭제 실패:', error)
    return NextResponse.json(
      { success: false, error: '소매밴드 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
}
