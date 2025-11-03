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

    // 도매 밴드 가격정책 확인
    const wholesaleBands = await prisma.wholesaleBand.findMany({
      where: {
        userId: actualUser.id,
        isActive: true
      }
    })

    // 가격정책이 설정된 밴드들만 필터링하고 파싱
    const bandsWithPolicy = wholesaleBands.map(band => {
      let parsedPolicy = null
      try {
        if (band.pricingPolicy) {
          parsedPolicy = JSON.parse(band.pricingPolicy)
        }
      } catch {
        parsedPolicy = null
      }

      return {
        id: band.id,
        name: band.name,
        bandKey: band.bandKey,
        pricingPolicyRaw: band.pricingPolicy,
        pricingPolicyParsed: parsedPolicy,
        hasPricingPolicy: !!band.pricingPolicy,
        isValidJson: !!parsedPolicy
      }
    })

    // 최근 수집된 게시물 샘플 조회
    const recentPosts = await prisma.collectedPost.findMany({
      where: {
        userId: actualUser.id,
        status: 'PENDING'
      },
      include: {
        wholesaleBand: true
      },
      take: 3,
      orderBy: {
        createdAt: 'desc'
      }
    })

    // 게시물의 가격 옵션과 밴드 정책 매핑 확인
    const postsWithPolicyCheck = recentPosts.map(post => {
      let priceOptions = []
      let bandPolicy = null
      
      try {
        priceOptions = JSON.parse(post.priceOptions || '[]')
      } catch {}

      try {
        if (post.wholesaleBand.pricingPolicy) {
          bandPolicy = JSON.parse(post.wholesaleBand.pricingPolicy)
        }
      } catch {}

      // 가격정책 적용 테스트
      const applyPricingPolicy = (originalPrice: number) => {
        if (!bandPolicy) {
          return Math.round(originalPrice * 1.5) // 기본 50% 마진
        }

        const { method, value } = bandPolicy
        
        switch (method) {
          case 'PERCENTAGE':
            return Math.round(originalPrice * (1 + value / 100))
          case 'FIXED_AMOUNT':
            return originalPrice + value
          case 'MULTIPLY':
            return Math.round(originalPrice * value)
          default:
            return Math.round(originalPrice * 1.5)
        }
      }

      const testPrice = 10000
      const calculatedPrice = applyPricingPolicy(testPrice)

      return {
        postId: post.id,
        postTitle: post.title,
        bandName: post.wholesaleBand.name,
        priceOptionsCount: priceOptions.length,
        priceOptionsRaw: post.priceOptions,
        bandPolicyRaw: post.wholesaleBand.pricingPolicy,
        bandPolicyParsed: bandPolicy,
        testCalculation: {
          originalPrice: testPrice,
          calculatedPrice: calculatedPrice,
          margin: bandPolicy ? `${method}: ${value}` : '기본 50%'
        }
      }
    })

    return NextResponse.json({
      success: true,
      debug: {
        userId: actualUser.id,
        totalBands: wholesaleBands.length,
        bandsWithPolicy,
        recentPosts: postsWithPolicyCheck
      }
    })

  } catch (error) {
    console.error('가격정책 디버깅 실패:', error)
    return NextResponse.json({
      success: false,
      error: '디버깅 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}