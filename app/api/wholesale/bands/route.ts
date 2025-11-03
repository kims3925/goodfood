import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    // 실제 사용자 ID 찾기 (ID 또는 이메일로)
    let actualUser = await prisma.user.findUnique({
      where: { id: session.user.id },
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

    // 사용자의 등록된 도매 밴드 목록 조회
    const wholesaleBands = await prisma.wholesaleBand.findMany({
      where: {
        userId: actualUser.id,
        isActive: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({
      success: true,
      bands: wholesaleBands
    })

  } catch (error) {
    console.error('도매 밴드 목록 조회 실패:', error)
    return NextResponse.json({
      success: false,
      error: '밴드 목록을 조회할 수 없습니다.'
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

    const { selectedBands } = await request.json()

    if (!Array.isArray(selectedBands) || selectedBands.length === 0) {
      return NextResponse.json({
        success: false,
        error: '선택된 밴드가 없습니다.'
      }, { status: 400 })
    }

    // 실제 사용자 ID 찾기 (ID 또는 이메일로)
    let actualUser = await prisma.user.findUnique({
      where: { id: session.user.id },
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

    // 선택된 밴드들을 데이터베이스에 저장
    const savedBands = []
    
    for (const band of selectedBands) {
      // 이미 등록된 밴드인지 확인
      const existingBand = await prisma.wholesaleBand.findFirst({
        where: {
          userId: actualUser.id,
          bandKey: band.band_key
        }
      })

      if (!existingBand) {
        // 새 밴드 등록
        const newBand = await prisma.wholesaleBand.create({
          data: {
            userId: actualUser.id,
            name: band.name,
            bandKey: band.band_key,
            description: band.description || null,
            memberCount: band.member_count || null,
            isActive: true
          }
        })
        savedBands.push(newBand)
      }
    }

    return NextResponse.json({
      success: true,
      message: `${savedBands.length}개의 밴드가 등록되었습니다.`,
      savedBands
    })

  } catch (error) {
    console.error('도매 밴드 등록 실패:', error)
    return NextResponse.json({
      success: false,
      error: '밴드를 등록할 수 없습니다.'
    }, { status: 500 })
  }
}

// 일괄 밴드 삭제
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    const { bandIds } = await request.json()

    if (!Array.isArray(bandIds) || bandIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: '삭제할 밴드를 선택해주세요.'
      }, { status: 400 })
    }

    // 실제 사용자 ID 찾기
    let actualUser = await prisma.user.findUnique({
      where: { id: session.user.id },
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

    // 모든 밴드가 현재 사용자의 것인지 확인
    const bands = await prisma.wholesaleBand.findMany({
      where: {
        id: { in: bandIds },
        userId: actualUser.id
      }
    })

    if (bands.length !== bandIds.length) {
      return NextResponse.json({
        success: false,
        error: '일부 밴드를 삭제할 권한이 없습니다.'
      }, { status: 403 })
    }

    // 연관된 게시물 수 확인
    const relatedPostsCount = await prisma.collectedPost.count({
      where: { wholesaleBandId: { in: bandIds } }
    })

    // 밴드 일괄 삭제
    const deleteResult = await prisma.wholesaleBand.deleteMany({
      where: {
        id: { in: bandIds },
        userId: actualUser.id
      }
    })

    return NextResponse.json({
      success: true,
      message: `${deleteResult.count}개의 밴드가 삭제되었습니다.`,
      deletedCount: deleteResult.count,
      deletedPostsCount: relatedPostsCount
    })

  } catch (error: any) {
    console.error('밴드 일괄 삭제 실패:', error)
    return NextResponse.json({
      success: false,
      error: '밴드 삭제 중 오류가 발생했습니다.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 })
  }
}