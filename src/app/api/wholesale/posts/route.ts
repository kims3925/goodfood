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

    // 사용자의 수집된 게시물 조회
    const collectedPosts = await prisma.collectedPost.findMany({
      where: {
        userId: actualUser.id
      },
      include: {
        wholesaleBand: {
          select: {
            id: true,
            name: true,
            bandKey: true,
            pricingPolicy: true
          }
        }
      },
      orderBy: {
        bandCreatedAt: 'desc'
      }
    })

    return NextResponse.json({
      success: true,
      posts: collectedPosts
    })

  } catch (error) {
    console.error('게시물 조회 실패:', error)
    return NextResponse.json({
      success: false,
      error: '게시물을 조회할 수 없습니다.'
    }, { status: 500 })
  }
}