import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/domain/auth'
import prisma from '@/lib/database/client'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    const userId = parseInt(session.user.id, 10)

    const sourcingSites = await prisma.sourcingSite.findMany({
      where: {
        userId: userId
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({
      success: true,
      sites: sourcingSites
    })

  } catch (error) {
    console.error('소싱 사이트 조회 실패:', error)
    return NextResponse.json({
      success: false,
      error: '소싱 사이트를 조회할 수 없습니다.'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    const userId = parseInt(session.user.id, 10)

    const {
      name,
      type,
      category,
      url,
      customsBaseAmount,
      shippingCost,
      bandKey,
      bandAccessToken,
      apiKey,
      secretKey,
      sellerId
    } = await request.json()

    // 필수 필드 검증
    if (!name || !type) {
      return NextResponse.json({
        success: false,
        error: '사이트명과 타입은 필수입니다.'
      }, { status: 400 })
    }

    // 중복 확인 (같은 사용자, 같은 이름의 사이트)
    const existingSite = await prisma.sourcingSite.findFirst({
      where: {
        userId: userId,
        name: name,
        type: type
      }
    })

    if (existingSite) {
      return NextResponse.json({
        success: false,
        error: '이미 등록된 소싱 사이트입니다.'
      }, { status: 400 })
    }

    const newSite = await prisma.sourcingSite.create({
      data: {
        userId: userId,
        name,
        type,
        category: category || null,
        url: url || null,
        customsBaseAmount: customsBaseAmount ? parseFloat(customsBaseAmount) : null,
        shippingCost: shippingCost ? parseFloat(shippingCost) : null,
        bandKey: bandKey || null,
        bandAccessToken: bandAccessToken || null,
        apiKey: apiKey || null,
        secretKey: secretKey || null,
        sellerId: sellerId || null
      }
    })

    return NextResponse.json({
      success: true,
      message: '소싱 사이트가 성공적으로 등록되었습니다.',
      site: newSite
    })

  } catch (error) {
    console.error('소싱 사이트 등록 실패:', error)
    return NextResponse.json({
      success: false,
      error: '소싱 사이트를 등록할 수 없습니다.'
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    const userId = parseInt(session.user.id, 10)
    const { searchParams } = new URL(request.url)
    const siteIdsStr = searchParams.get('ids')?.split(',') || []
    const siteIds = siteIdsStr.map(id => parseInt(id, 10))

    if (siteIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: '삭제할 사이트를 선택해주세요.'
      }, { status: 400 })
    }

    // 사용자 소유의 사이트만 삭제
    const deletedSites = await prisma.sourcingSite.deleteMany({
      where: {
        id: {
          in: siteIds
        },
        userId: userId
      }
    })

    return NextResponse.json({
      success: true,
      message: `${deletedSites.count}개의 소싱 사이트가 삭제되었습니다.`,
      deletedCount: deletedSites.count
    })

  } catch (error) {
    console.error('소싱 사이트 삭제 실패:', error)
    return NextResponse.json({
      success: false,
      error: '소싱 사이트를 삭제할 수 없습니다.'
    }, { status: 500 })
  }
}