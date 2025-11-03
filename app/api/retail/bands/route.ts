import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    // 데이터베이스에서 소매밴드 목록 조회
    const retailBands = await prisma.retailBand.findMany({
      where: {
        userId: session.user.id,
        isActive: true
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({
      success: true,
      bands: retailBands
    })
  } catch (error) {
    console.error('Failed to load retail bands:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load retail bands',
      },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    const { bandKey, bandName, description, memberCount } = await req.json()

    if (!bandKey || !bandName) {
      return NextResponse.json(
        {
          success: false,
          error: 'Band key and name are required',
        },
        { status: 400 }
      )
    }

    // 중복 확인
    const existingBand = await prisma.retailBand.findFirst({
      where: {
        userId: session.user.id,
        bandKey: bandKey
      }
    })

    if (existingBand) {
      return NextResponse.json(
        {
          success: false,
          error: 'This band is already added to retail bands',
        },
        { status: 400 }
      )
    }

    // 새 소매밴드 추가
    const newRetailBand = await prisma.retailBand.create({
      data: {
        userId: session.user.id,
        bandKey,
        bandName,
        description: description || '',
        memberCount: memberCount || 0,
        isActive: true,
      }
    })

    return NextResponse.json({
      success: true,
      message: `"${bandName}" 밴드가 소매밴드로 추가되었습니다.`,
      band: newRetailBand
    })

  } catch (error) {
    console.error('Failed to add retail band:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to add retail band',
      },
      { status: 500 }
    )
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const bandId = searchParams.get('id')

    if (!bandId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Band ID is required',
        },
        { status: 400 }
      )
    }

    // 소매밴드 제거 (실제로는 isActive를 false로 변경)
    const retailBand = await prisma.retailBand.findFirst({
      where: {
        id: bandId,
        userId: session.user.id
      }
    })

    if (!retailBand) {
      return NextResponse.json(
        {
          success: false,
          error: 'Retail band not found',
        },
        { status: 404 }
      )
    }

    // 소프트 삭제 (isActive를 false로 변경)
    await prisma.retailBand.update({
      where: { id: bandId },
      data: { isActive: false }
    })

    return NextResponse.json({
      success: true,
      message: `"${retailBand.bandName}" 밴드가 소매밴드에서 제거되었습니다.`,
    })

  } catch (error) {
    console.error('Failed to remove retail band:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to remove retail band',
      },
      { status: 500 }
    )
  }
}