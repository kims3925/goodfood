import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/domain/auth'
import prisma from '@/lib/database/client'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    // 실제 사용자 ID 찾기 (ID 또는 이메일로)
    const userId = parseInt(session.user.id, 10)
    let actualUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true }
    })

    if (!actualUser) {
      actualUser = await prisma.user.findUnique({
        where: { email: session.user.email || '' },
        select: { id: true }
      })
    }

    if (!actualUser) {
      return NextResponse.json({
        success: false,
        error: '사용자를 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 해당 밴드가 사용자의 것인지 확인하고 정책 정보 조회
    const bandId = parseInt(params.id, 10)
    const wholesaleBand = await prisma.wholesaleBand.findFirst({
      where: {
        id: bandId,
        userId: actualUser.id
      },
      select: {
        id: true,
        name: true,
        pricingPolicy: true
      }
    })

    if (!wholesaleBand) {
      return NextResponse.json({
        success: false,
        error: '해당 밴드에 접근할 수 없습니다.'
      }, { status: 403 })
    }

    return NextResponse.json({
      success: true,
      policy: wholesaleBand
    })

  } catch (error) {
    console.error('정책 조회 실패:', error)
    return NextResponse.json({
      success: false,
      error: '정책을 조회할 수 없습니다.'
    }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    const bandId = parseInt(params.id, 10)
    const { pricingPolicy } = await request.json()

    // 실제 사용자 ID 찾기 (ID 또는 이메일로)
    const userId = parseInt(session.user.id, 10)
    let actualUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true }
    })

    if (!actualUser) {
      actualUser = await prisma.user.findUnique({
        where: { email: session.user.email || '' },
        select: { id: true }
      })
    }

    if (!actualUser) {
      return NextResponse.json({
        success: false,
        error: '사용자를 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 해당 밴드가 사용자의 것인지 확인
    const wholesaleBand = await prisma.wholesaleBand.findFirst({
      where: {
        id: bandId,
        userId: actualUser.id
      }
    })

    if (!wholesaleBand) {
      return NextResponse.json({
        success: false,
        error: '해당 밴드에 접근할 수 없습니다.'
      }, { status: 403 })
    }

    // 정책 업데이트
    const updatedBand = await prisma.wholesaleBand.update({
      where: {
        id: bandId
      },
      data: {
        pricingPolicy: pricingPolicy || null,
        updatedAt: new Date()
      },
      select: {
        id: true,
        name: true,
        pricingPolicy: true,
        updatedAt: true
      }
    })

    console.log(`✅ 정책 업데이트 완료 - 밴드: ${updatedBand.name}`)

    return NextResponse.json({
      success: true,
      message: '정책이 성공적으로 저장되었습니다.',
      policy: updatedBand
    })

  } catch (error) {
    console.error('정책 저장 실패:', error)
    return NextResponse.json({
      success: false,
      error: '정책을 저장할 수 없습니다.'
    }, { status: 500 })
  }
}